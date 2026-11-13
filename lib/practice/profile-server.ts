import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { learnerProfileDraft, saveLearnerProfile } from "./profile";
import type { LearnerProfileDraft } from "./profile";

// userId must come from authenticated server code, never from request JSON.
export async function updateLearnerProfile(userId: string, rawProfile: unknown) {
  return saveLearnerProfile(userId, rawProfile, {
    write: async (uid, profile) => {
      await adminDb.collection("users").doc(uid).set(
        { learnerProfile: { ...profile, updatedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    },
    onError: (error) => console.error("[learnerProfile.save]", { code: error instanceof Error ? error.name : "unknown" }),
  });
}

// Pre-fill for the session form. A read failure falls back to the defaults instead of blocking practice.
export async function getLearnerProfileDraft(user: { id: string; name: string }): Promise<LearnerProfileDraft> {
  try {
    const snapshot = await adminDb.collection("users").doc(user.id).get();
    return learnerProfileDraft(snapshot.data()?.learnerProfile, user.name);
  } catch (error) {
    console.error("[learnerProfile.read]", { code: error instanceof Error ? error.name : "unknown" });
    return learnerProfileDraft(undefined, user.name);
  }
}
