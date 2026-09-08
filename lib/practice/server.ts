import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { readPracticeSession } from "./read-session";
import { applyPracticeSessionCallEvent } from "./call-state";

// userId must come from authenticated server code, never from request JSON.
export async function updatePracticeSessionCallState(sessionId: unknown, userId: string, update: unknown) {
  return applyPracticeSessionCallEvent(sessionId, userId, update, {
    transaction: (id, apply) => adminDb.runTransaction(async (transaction) => {
      const reference = adminDb.collection("practiceSessions").doc(id);
      return apply({
        readDocument: async () => {
          const snapshot = await transaction.get(reference);
          return snapshot.exists ? snapshot.data() : undefined;
        },
        writePatch: async (patch) => {
          transaction.update(reference, { ...patch, updatedAt: FieldValue.serverTimestamp() });
        },
      });
    }),
    now: () => new Date().toISOString(),
    onError: () => console.error("[practiceSession.call] unavailable"),
  });
}

export async function getPracticeSession(sessionId: unknown) {
  return readPracticeSession(sessionId, {
    getUser: getCurrentUser,
    readDocument: async (id) => {
      const snapshot = await adminDb.collection("practiceSessions").doc(id).get();
      return snapshot.exists ? snapshot.data() : undefined;
    },
    onError: (error) => {
      // Avoid logging the document, credentials or provider error messages.
      console.error("[practiceSession.read]", {
        code: error instanceof Error ? error.name : "unknown",
      });
    },
  });
}
