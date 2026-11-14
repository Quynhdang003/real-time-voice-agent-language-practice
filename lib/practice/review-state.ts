import { isOwnedSession } from "./read-session";
import { isPracticeSessionId, isRecord, parsePracticeSession } from "./session";
import type { PracticeSession, StoredReview, TranscriptTurn } from "./session";
import type { SessionReviewV2 } from "./review-v2";

export type ReviewOutcome =
  | { status: "ok"; review: StoredReview }
  | { status: "unauthenticated" | "invalid_id" | "not_found" | "invalid_data"
      | "not_ready" | "transcript_pending" | "transcript_empty" | "transcript_error"
      | "already_processing" | "quota" | "invalid_output" | "unavailable" };

// A "processing" claim older than this may be taken over: the invocation that made it was cut off
// (Vercel stops a function at its maxDuration of 60 s) or crashed before writing a result.
export const REVIEW_LEASE_MS = 3 * 60 * 1000;

// What Gemini needs besides the transcript (RV-01). A v1 session has no setup, so its goals are empty.
export type ReviewContext = {
  level: string;
  topic: string;
  scenario: string | null;
  sessionMode: string | null;
  goals: { targetVocabulary: string[]; reviewVocabulary: string[]; grammarFocus: string | null; weakPoints: string[] };
};

export function reviewContextOf(session: PracticeSession): ReviewContext {
  const setup = session.setup;
  return {
    level: session.level,
    topic: session.topic.name,
    scenario: setup?.scenario ?? null,
    sessionMode: setup?.sessionMode ?? null,
    goals: {
      targetVocabulary: setup?.targetVocabulary ?? [],
      reviewVocabulary: setup?.reviewVocabulary ?? [],
      grammarFocus: setup?.grammarFocus ?? null,
      weakPoints: setup?.weakPoints ?? [],
    },
  };
}
type Claim =
  | { proceed: true; transcript: TranscriptTurn[]; context: ReviewContext; claimedAt: string }
  | { proceed: false; outcome: ReviewOutcome };

type ReviewTransaction = { readDocument: () => Promise<unknown>; markProcessing: (claimedAt: string) => Promise<void> };
export type ReviewStore = {
  transaction: (sessionId: string, apply: (transaction: ReviewTransaction) => Promise<Claim>) => Promise<Claim>;
  generate: (transcript: TranscriptTurn[], context: ReviewContext) => Promise<
    { status: "ok"; review: SessionReviewV2 } | { status: "quota" | "invalid_output" | "unavailable" }>;
  // Each write runs only while the session still holds this claim (reviewStatus "processing" with the
  // same reviewClaimedAt), and resolves false when the claim was taken over.
  writeCompleted: (sessionId: string, review: SessionReviewV2, claimedAt: string) => Promise<boolean>;
  writeFailed: (sessionId: string, claimedAt: string) => Promise<boolean>;
  now: () => string;
  onError: (error: unknown) => void;
};

function holdsLease(document: Record<string, unknown>, now: string): boolean {
  const claimedAt = typeof document.reviewClaimedAt === "string" ? Date.parse(document.reviewClaimedAt) : NaN;
  // A claim without a valid time (made before TR-03) counts as expired.
  return Number.isFinite(claimedAt) && Date.parse(now) - claimedAt < REVIEW_LEASE_MS;
}

// owner null: the webhook's background trigger, which found the session by session_id.
async function runReview(sessionId: string, owner: string | null, store: ReviewStore): Promise<ReviewOutcome> {
  try {
    const claim = await store.transaction(sessionId, async (transaction) => {
      const document = await transaction.readDocument();
      if (!isRecord(document) || (owner !== null && !isOwnedSession(document, owner))) {
        return { proceed: false, outcome: { status: "not_found" } };
      }
      const session = parsePracticeSession(sessionId, document);
      if (!session) return { proceed: false, outcome: { status: "invalid_data" } };
      if (session.reviewStatus === "completed" && session.review) {
        return { proceed: false, outcome: { status: "ok", review: session.review } };
      }
      if (session.status !== "completed") return { proceed: false, outcome: { status: "not_ready" } };
      const now = store.now();
      if (session.reviewStatus === "processing" && holdsLease(document, now)) {
        return { proceed: false, outcome: { status: "already_processing" } };
      }

      const transcriptStatus = session.dograh?.transcriptStatus;
      if (transcriptStatus === "error") return { proceed: false, outcome: { status: "transcript_error" } };
      if (transcriptStatus === "empty") return { proceed: false, outcome: { status: "transcript_empty" } };
      if (transcriptStatus !== "ready" || !session.dograh?.transcript?.length) {
        return { proceed: false, outcome: { status: "transcript_pending" } };
      }
      // Only learner turns are assessed; a call where the learner never spoke has nothing to review.
      if (!session.dograh.transcript.some((turn) => turn.role === "learner")) {
        return { proceed: false, outcome: { status: "transcript_empty" } };
      }

      await transaction.markProcessing(now);
      return { proceed: true, transcript: session.dograh.transcript, claimedAt: now, context: reviewContextOf(session) };
    });
    if (!claim.proceed) return claim.outcome;

    const result = await store.generate(claim.transcript, claim.context);
    if (result.status !== "ok") {
      const written = await store.writeFailed(sessionId, claim.claimedAt);
      return written ? { status: result.status } : { status: "already_processing" };
    }
    // A result whose claim was taken over is dropped; the newer claim writes its own.
    const written = await store.writeCompleted(sessionId, result.review, claim.claimedAt);
    return written ? { status: "ok", review: result.review } : { status: "already_processing" };
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}

// The review page and its Try again button (POST .../generate-review), for the session's owner only.
export async function generatePracticeSessionReview(
  sessionId: unknown, userId: string, store: ReviewStore,
): Promise<ReviewOutcome> {
  if (!userId.trim()) return { status: "unauthenticated" };
  if (!isPracticeSessionId(sessionId)) return { status: "invalid_id" };
  return runReview(sessionId, userId, store);
}

// Started with after() by the transcript webhook, which has no user; the same claim and lease apply.
export async function generateBackgroundReview(sessionId: unknown, store: ReviewStore): Promise<ReviewOutcome> {
  if (!isPracticeSessionId(sessionId)) return { status: "invalid_id" };
  return runReview(sessionId, null, store);
}
