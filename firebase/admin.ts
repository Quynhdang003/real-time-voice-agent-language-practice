import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = normalizeEnvironmentValue(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = normalizeEnvironmentValue(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizeEnvironmentValue(process.env.FIREBASE_PRIVATE_KEY)
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function normalizeEnvironmentValue(value: string | undefined): string {
  return (
    value
      ?.trim()
      .replace(/,\s*$/, "")
      .trim()
      .replace(/^["']/, "")
      .replace(/["']$/, "") ?? ""
  );
}

const adminApp = getFirebaseAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
