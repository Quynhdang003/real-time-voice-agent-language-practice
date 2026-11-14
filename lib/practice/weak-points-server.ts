import "server-only";
import { adminDb } from "@/firebase/admin";
import { mergeCarryOver, weakPointSourcesFrom } from "./weak-points";
import type { CarriedWeakPoint } from "./weak-points";

// v1 reviews are skipped, so a few more than the 3 sources are read.
const CANDIDATE_SESSIONS = 10;

// The learner's latest completed reviews → the weak points that carry over (RV-03). Needs the composite index
// practiceSessions (userId ↑, reviewStatus ↑, createdAt ↓), created by hand in the Firebase console. Without it,
// or on any read failure, nothing carries over and the form simply starts empty.
export async function getWeakPointCarryOver(userId: string): Promise<CarriedWeakPoint[]> {
  try {
    const snapshot = await adminDb.collection("practiceSessions")
      .where("userId", "==", userId)
      .where("reviewStatus", "==", "completed")
      .orderBy("createdAt", "desc")
      .limit(CANDIDATE_SESSIONS)
      .select("review")
      .get();
    return mergeCarryOver(weakPointSourcesFrom(snapshot.docs.map((doc) => ({ id: doc.id, review: doc.get("review") }))));
  } catch (error) {
    // A missing index is FAILED_PRECONDITION (code 9); the provider message (with the index link) is not logged.
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error("[practiceSession.carryOver]", { code });
    return [];
  }
}
