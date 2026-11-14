// Review page rules (RV-02): which state a session shows, what to do with a generate-review answer, and the
// level labels of the 1–5 skill scores. Pure; shared by the client panel and the tests.
import type { PracticeSession } from "./session.ts";
import type { SkillScore } from "./review-v2.ts";
import { nextCefrLevel } from "./review-v2.ts";

// Dograh retries a delivery for about 7.5 minutes (30 s → 240 s backoff), and a review claim is a 3-minute
// lease, so 10 minutes of waiting covers both before the page asks the learner to check again.
export const REVIEW_POLL_INTERVAL_MS = 5_000;
export const REVIEW_WAIT_LIMIT_MS = 10 * 60 * 1000;

export type ReviewPageState =
  | "waiting_transcript" | "transcript_error" | "no_speech" | "generating" | "failed" | "done";

// For a session whose call is completed; the page handles every other call status.
export function reviewPageStateOf(session: PracticeSession): ReviewPageState {
  if (session.reviewStatus === "completed" && session.review) return "done";
  const transcriptStatus = session.dograh?.transcriptStatus;
  if (transcriptStatus === undefined) return "waiting_transcript";
  if (transcriptStatus === "error") return "transcript_error";
  const turns = session.dograh?.transcript ?? [];
  if (transcriptStatus === "empty" || !turns.some((turn) => turn.role === "learner")) return "no_speech";
  if (session.reviewStatus === "failed") return "failed";
  return "generating";
}

// The panel remounts when this changes (React key), so its local state never outlives the server state.
export function reviewStateKey(session: PracticeSession): string {
  return [session.id, session.dograh?.transcriptStatus ?? "none", session.reviewStatus ?? "none"].join(":");
}

export type GenerateStep = "refresh" | "retry_later" | "failed" | "no_speech" | "transcript_error";

// What the panel does with a POST .../generate-review answer.
export function generateStepFor(response: { ok: boolean; reason?: string }): GenerateStep {
  if (response.ok) return "refresh";
  switch (response.reason) {
    case "already_processing": // another tab or the webhook's background review holds the claim
    case "transcript_pending":
    case "not_ready": // the browser's end-of-call event is still being saved
      return "retry_later";
    case "transcript_empty":
      return "no_speech";
    case "transcript_error":
      return "transcript_error";
    default:
      return "failed";
  }
}

const anchors: Record<Exclude<SkillScore, 5>, (level: string) => string> = {
  1: (level) => `Well below ${level}`,
  2: (level) => `Below ${level}`,
  3: (level) => `At ${level}`,
  4: (level) => `Above ${level}`,
};

export function skillLevelLabel(score: SkillScore, level: string): string {
  if (score !== 5) return anchors[score](level);
  const next = nextCefrLevel(level);
  return next ? `Meets ${next}` : "Top of C2 (near-native)";
}
