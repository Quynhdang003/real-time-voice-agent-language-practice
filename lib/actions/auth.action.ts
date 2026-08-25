"use server";

import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/firebase/admin";

const SESSION_COOKIE_NAME = "fluentai_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const RECENT_SIGN_IN_SECONDS = 5 * 60;

export type AuthActionResult =
  | { success: true }
  | { success: false; message: string };

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  photoURL: string | null;
  emailVerified: boolean;
};

type SignUpParams = {
  idToken: string;
  fullName: string;
};

type SignInParams = {
  idToken: string;
};

export async function signUp({ idToken, fullName }: SignUpParams): Promise<AuthActionResult> {
  const name = fullName.trim();

  if (name.length < 2) {
    return { success: false, message: "Full name must contain at least 2 characters." };
  }

  try {
    const decodedToken = await verifyRecentIdToken(idToken);
    const userRecord = await adminAuth.getUser(decodedToken.uid);

    if (!userRecord.email) {
      return { success: false, message: "Your Firebase account does not have an email address." };
    }

    await adminDb.collection("users").doc(decodedToken.uid).set(
      {
        name,
        email: userRecord.email,
        photoURL: userRecord.photoURL ?? null,
        emailVerified: userRecord.emailVerified,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await setSessionCookie(idToken);
    return { success: true };
  } catch (error) {
    logAuthActionError("signUp", error);
    await clearSessionCookieSafely();
    return {
      success: false,
      message: getAuthActionErrorMessage(error, "sign-up"),
    };
  }
}

export async function signIn({ idToken }: SignInParams): Promise<AuthActionResult> {
  try {
    const decodedToken = await verifyRecentIdToken(idToken);
    const userRecord = await adminAuth.getUser(decodedToken.uid);
    const userDocument = adminDb.collection("users").doc(decodedToken.uid);
    const existingUser = await userDocument.get();

    if (!existingUser.exists) {
      await userDocument.set({
        name: userRecord.displayName ?? userRecord.email?.split("@")[0] ?? "Learner",
        email: userRecord.email ?? "",
        photoURL: userRecord.photoURL ?? null,
        emailVerified: userRecord.emailVerified,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await userDocument.set(
        {
          email: userRecord.email ?? "",
          photoURL: userRecord.photoURL ?? null,
          emailVerified: userRecord.emailVerified,
          updatedAt: FieldValue.serverTimestamp(),
          lastLoginAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    await setSessionCookie(idToken);
    return { success: true };
  } catch (error) {
    logAuthActionError("signIn", error);
    await clearSessionCookieSafely();
    return {
      success: false,
      message: getAuthActionErrorMessage(error, "sign-in"),
    };
  }
}

export async function signOut(): Promise<AuthActionResult> {
  await clearSessionCookie();
  return { success: true };
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const [userRecord, userDocument] = await Promise.all([
      adminAuth.getUser(decodedToken.uid),
      adminDb.collection("users").doc(decodedToken.uid).get(),
    ]);
    const profile = userDocument.data();
    const name =
      typeof profile?.name === "string"
        ? profile.name
        : userRecord.displayName ?? userRecord.email?.split("@")[0] ?? "Learner";

    return {
      id: userRecord.uid,
      name,
      email: userRecord.email ?? "",
      photoURL:
        typeof profile?.photoURL === "string"
          ? profile.photoURL
          : userRecord.photoURL ?? null,
      emailVerified: userRecord.emailVerified,
    };
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

async function verifyRecentIdToken(idToken: string) {
  if (!idToken) {
    throw new Error("Missing Firebase ID token.");
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const authenticatedAt = decodedToken.auth_time;
  const nowInSeconds = Math.floor(Date.now() / 1000);

  if (!authenticatedAt || nowInSeconds - authenticatedAt > RECENT_SIGN_IN_SECONDS) {
    throw new Error("Recent authentication is required.");
  }

  return decodedToken;
}

async function setSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
    priority: "high",
  });
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

async function clearSessionCookieSafely() {
  try {
    await clearSessionCookie();
  } catch (error) {
    logAuthActionError("clearSessionCookie", error);
  }
}

function getAuthActionErrorMessage(
  error: unknown,
  flow: "sign-up" | "sign-in",
): string {
  const code = getErrorCode(error);

  if (
    code === "auth/id-token-expired" ||
    code === "auth/id-token-revoked" ||
    code === "auth/argument-error" ||
    (error instanceof Error && error.message === "Recent authentication is required.")
  ) {
    return "Your secure sign-in session expired. Please submit the form again.";
  }

  if (code === "auth/user-disabled") {
    return "This account has been disabled. Please contact support.";
  }

  if (code === "app/invalid-credential") {
    return "Authentication is temporarily unavailable. Please contact support.";
  }

  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Your account was created, but we could not save your profile. Please try signing in.";
  }

  return flow === "sign-up"
    ? "We could not finish creating your account. Please try again."
    : "Unable to complete sign-in. Please try again.";
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  return typeof error.code === "string" ? error.code : undefined;
}

function logAuthActionError(action: string, error: unknown) {
  console.error(`[auth.${action}]`, {
    code: getErrorCode(error) ?? "unknown",
    message: error instanceof Error ? error.message : "Unknown authentication error",
  });
}
