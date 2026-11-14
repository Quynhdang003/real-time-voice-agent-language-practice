import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { readPracticeSession } from "./read-session";
import { applyPracticeSessionCallEvent } from "./call-state";
import { generateBackgroundReview, generatePracticeSessionReview } from "./review-state";
import type { ReviewStore } from "./review-state";
import { createPracticeSessionForUser } from "./create-session";
import { dailyCallLimit } from "./call-quota";
import { getWeakPointCarryOver } from "./weak-points-server";
import { generateSessionReview } from "@/lib/ai/review";

// POST /api/practice-setup. The users/{uid} read and all writes run in one transaction (ACC-01, LIM-01).
export async function createPracticeSession(userId: string, body: unknown) {
  // Outside the transaction: the source IDs only record where the pre-filled weak points came from.
  const carriedWeakPoints = await getWeakPointCarryOver(userId);
  return createPracticeSessionForUser(userId, body, {
    carriedWeakPoints,
    adminUid: process.env.ADMIN_UID,
    dailyCallLimit: dailyCallLimit(process.env.PRACTICE_DAILY_CALL_LIMIT),
    now: () => new Date(),
    transaction: (apply) => adminDb.runTransaction(async (transaction) => {
      const userReference = adminDb.collection("users").doc(userId);
      return apply({
        readUser: async () => {
          const snapshot = await transaction.get(userReference);
          return snapshot.exists ? snapshot.data() : undefined;
        },
        writeUser: (patch) => {
          transaction.set(userReference, { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        },
        createSession: (document) => {
          const reference = adminDb.collection("practiceSessions").doc();
          transaction.create(reference, {
            ...document, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          });
          return reference.id;
        },
      });
    }),
    onError: (error) => console.error("[practiceSetup.create]", { code: error instanceof Error ? error.name : "unknown" }),
  });
}
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
// Writes the result only while the session still holds this claim (TR-03 lease).
function writeIfClaimed(sessionId: string, claimedAt: string, patch: Record<string, unknown>): Promise<boolean> {
  return adminDb.runTransaction(async (transaction) => {
    const reference = adminDb.collection("practiceSessions").doc(sessionId);
    const snapshot = await transaction.get(reference);
    const data = snapshot.exists ? snapshot.data() : undefined;
    if (data?.reviewStatus !== "processing" || data.reviewClaimedAt !== claimedAt) return false;
    transaction.update(reference, { ...patch, reviewClaimedAt: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

const reviewStore: ReviewStore = {
  transaction: (id, apply) => adminDb.runTransaction(async (transaction) => {
    const reference = adminDb.collection("practiceSessions").doc(id);
    return apply({
      readDocument: async () => {
        const snapshot = await transaction.get(reference);
        return snapshot.exists ? snapshot.data() : undefined;
      },
      markProcessing: async (claimedAt) => {
        transaction.update(reference, {
          reviewStatus: "processing", reviewClaimedAt: claimedAt, updatedAt: FieldValue.serverTimestamp(),
        });
      },
    });
  }),
  generate: generateSessionReview,
  writeCompleted: (id, review, claimedAt) => writeIfClaimed(id, claimedAt, { review, reviewStatus: "completed" }),
  writeFailed: (id, claimedAt) => writeIfClaimed(id, claimedAt, { reviewStatus: "failed" }),
  now: () => new Date().toISOString(),
  onError: (error) => console.error("[practiceSession.review]", { code: error instanceof Error ? error.name : "unknown" }),
};

export async function createPracticeSessionReview(sessionId: unknown, userId: string) {
  return generatePracticeSessionReview(sessionId, userId, reviewStore);
}

// Run by the transcript webhook through after(); it must never throw.
export async function runBackgroundSessionReview(sessionId: string): Promise<void> {
  const outcome = await generateBackgroundReview(sessionId, reviewStore);
  // not_ready: the browser has not reported the end of the call yet; the review page claims it later.
  if (outcome.status !== "ok") console.warn("[practiceSession.review.background]", { code: outcome.status });
}