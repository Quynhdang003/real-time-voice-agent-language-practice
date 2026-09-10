import { isOwnedSession } from "./read-session";
import { isPracticeSessionId, parsePracticeSession } from "./session";
import type { SessionReview, TranscriptTurn } from "./session";

export type ReviewOutcome =
  | { status: "ok"; review: SessionReview }
  | { status: "unauthenticated" | "invalid_id" | "not_found" | "invalid_data"
      | "not_ready" | "transcript_pending" | "transcript_empty" | "transcript_error"
      | "already_processing" | "quota" | "invalid_output" | "unavailable" };

type ReviewContext = { language: string; topic: string; level: string };
type Claim =
  | { proceed: true; transcript: TranscriptTurn[]; context: ReviewContext }
  | { proceed: false; outcome: ReviewOutcome };

type ReviewTransaction = { readDocument: () => Promise<unknown>; markProcessing: () => Promise<void> };
export type ReviewStore = {
  transaction: (sessionId: string, apply: (transaction: ReviewTransaction) => Promise<Claim>) => Promise<Claim>;
  generate: (transcript: TranscriptTurn[], context: ReviewContext) => Promise<
    { status: "ok"; review: SessionReview } | { status: "quota" | "invalid_output" | "unavailable" }>;
  writeCompleted: (sessionId: string, review: SessionReview) => Promise<void>;
  writeFailed: (sessionId: string) => Promise<void>;
  onError: (error: unknown) => void;
};

export async function generatePracticeSessionReview(
  sessionId: unknown, userId: string, store: ReviewStore,
): Promise<ReviewOutcome> {
  if (!userId.trim()) return { status: "unauthenticated" };
  if (!isPracticeSessionId(sessionId)) return { status: "invalid_id" };
  try {
    const claim = await store.transaction(sessionId, async (transaction) => {
      const document = await transaction.readDocument();
      if (!isOwnedSession(document, userId)) return { proceed: false, outcome: { status: "not_found" } };
      const session = parsePracticeSession(sessionId, document);
      if (!session) return { proceed: false, outcome: { status: "invalid_data" } };
      if (session.reviewStatus === "completed" && session.review) {
        return { proceed: false, outcome: { status: "ok", review: session.review } };
      }
      if (session.status !== "completed") return { proceed: false, outcome: { status: "not_ready" } };
      if (session.reviewStatus === "processing") return { proceed: false, outcome: { status: "already_processing" } };

      const transcriptStatus = session.dograh?.transcriptStatus;
      if (transcriptStatus === "error") return { proceed: false, outcome: { status: "transcript_error" } };
      if (transcriptStatus === "empty") return { proceed: false, outcome: { status: "transcript_empty" } };
      if (transcriptStatus !== "ready" || !session.dograh?.transcript?.length) {
        return { proceed: false, outcome: { status: "transcript_pending" } };
      }

      await transaction.markProcessing();
      return { proceed: true, transcript: session.dograh.transcript,
        context: { language: session.language.name, topic: session.topic.name, level: session.level } };
    });
    if (!claim.proceed) return claim.outcome;

    const result = await store.generate(claim.transcript, claim.context);
    if (result.status !== "ok") {
      await store.writeFailed(sessionId);
      return { status: result.status };
    }
    await store.writeCompleted(sessionId, result.review);
    return { status: "ok", review: result.review };
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
