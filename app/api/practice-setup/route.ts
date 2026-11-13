import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { createPracticeSessionDocumentV2 } from "@/lib/practice/session";
import { validatePracticeSetupRequest } from "@/lib/practice/session-setup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, message: "You must be signed in to start a practice session." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "The practice setup request is not valid JSON." },
      { status: 400 },
    );
  }

  // Body: {profile, setup}. New sessions are always English v2 documents.
  const setupRequest = validatePracticeSetupRequest(body);
  if (!setupRequest.ok) {
    return NextResponse.json(
      { success: false, message: "Please fix the highlighted fields.", fieldErrors: setupRequest.fieldErrors },
      { status: 400 },
    );
  }

  try {
    const sessionDocument = adminDb.collection("practiceSessions").doc();
    await sessionDocument.set({
      ...createPracticeSessionDocumentV2(setupRequest.value.profile, setupRequest.value.setup),
      userId: user.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(
      { success: true, sessionId: sessionDocument.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("[practiceSetup.POST]", {
      code: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { success: false, message: "We could not create your practice session. Please try again." },
      { status: 500 },
    );
  }
}
