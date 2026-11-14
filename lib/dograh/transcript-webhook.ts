import { isPracticeSessionId, isRecord, parsePracticeSession } from "@/lib/practice/session";
import type { PracticeSession, TranscriptError, TranscriptStatus, TranscriptTurn } from "@/lib/practice/session";
import type { TranscriptDownload } from "./fetch-transcript";
import { parseDograhTranscriptText } from "./transcript-parser";

const MAX_SUMMARY_LENGTH = 4000;
const MAX_URL_LENGTH = 2000;

// The flat v2 payload rendered by the Webhook node (dograh/workflow-spec.md). Dograh renders every
// placeholder as a string and a missing one as "", so "" means "not sent".
export type DograhWebhookEvent = {
  sessionId: string;
  workflowRunId: number;
  transcriptUrl?: string;
  recordingUrl?: string;
  summary?: string;
};

const absent = (value: unknown) => value === undefined || value === null || value === "";

// undefined = not sent, null = invalid.
function optionalUrl(value: unknown): string | undefined | null {
  if (absent(value)) return undefined;
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return null;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function toRunId(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const runId = Number(value);
  return Number.isSafeInteger(runId) ? runId : null;
}

// Allowlist: spec, call_duration_seconds, call_disposition and any other key are ignored.
export function parseDograhWebhookEvent(value: unknown): DograhWebhookEvent | null {
  if (!isRecord(value) || !isPracticeSessionId(value.session_id)) return null;
  const workflowRunId = toRunId(value.workflow_run_id);
  const transcriptUrl = optionalUrl(value.transcript_url);
  const recordingUrl = optionalUrl(value.recording_url);
  if (workflowRunId === null || transcriptUrl === null || recordingUrl === null) return null;
  if (!absent(value.call_summary) && typeof value.call_summary !== "string") return null;

  const event: DograhWebhookEvent = { sessionId: value.session_id, workflowRunId };
  if (transcriptUrl !== undefined) event.transcriptUrl = transcriptUrl;
  if (recordingUrl !== undefined) event.recordingUrl = recordingUrl;
  if (typeof value.call_summary === "string" && value.call_summary !== "") {
    event.summary = value.call_summary.slice(0, MAX_SUMMARY_LENGTH);
  }
  return event;
}

// Written as nested dograh.* fields, so the call fields saved by the browser are kept.
export type TranscriptPatch = {
  workflowRunId?: number;
  transcriptUrl?: string;
  recordingUrl?: string;
  summary?: string;
  transcript?: TranscriptTurn[];
  transcriptStatus?: TranscriptStatus;
  // null removes a reason left by an earlier failed delivery.
  transcriptError?: TranscriptError | null;
};
export type SkipReason = "not_found" | "run_mismatch" | "invalid_data";
export type WebhookOutcome =
  // reviewSessionId: the transcript is ready and the review was marked pending, so the route starts
  // the review with after() (TR-03).
  | { status: "ok"; changed: boolean; reviewSessionId?: string }
  | { status: "skipped"; reason: SkipReason }
  // A transient download failure before Dograh's last attempt: answer 503 so Dograh retries.
  | { status: "retry"; reason: TranscriptError }
  | { status: "invalid_payload" | "unavailable" };

// Dograh retries 408/425/429/5xx and network errors, at most 5 attempts in total (verified in the
// open-source delivery task, 2026-11-14). X-Dograh-Delivery-Attempt is 1-based, so 5 is the last.
export const MAX_DELIVERY_ATTEMPTS = 5;
const TRANSIENT_ERRORS: readonly TranscriptError[] = ["timeout", "network", "http_5xx"];

// null when the header is missing or malformed: no retry can be counted on, so it is the last attempt.
export function parseDeliveryAttempt(header: string | null): number | null {
  if (header === null || !/^[1-9]\d{0,5}$/.test(header.trim())) return null;
  return Number(header.trim());
}

type WebhookTransaction = {
  readDocument: () => Promise<unknown>;
  // markReviewPending sets the top-level reviewStatus to "pending" in the same write.
  writePatch: (patch: TranscriptPatch, options: { markReviewPending: boolean }) => Promise<void>;
};
export type WebhookStore = {
  // The adapter runs the callback atomically: the read, the decision and the write.
  transaction: <T>(sessionId: string, apply: (transaction: WebhookTransaction) => Promise<T>) => Promise<T>;
  fetchTranscript: (url: string) => Promise<TranscriptDownload>;
  onSkip: (reason: SkipReason) => void;
  onDownloadFailure: (failure: { reason: TranscriptError; rejectedHost?: string; retry: boolean }) => void;
  onError: (error: unknown) => void;
};

type Decision =
  | { kind: "skip"; reason: SkipReason }
  | { kind: "done" }
  | { kind: "proceed"; session: PracticeSession };

// The session is found only by session_id; the run ID is a cross-check (run IDs repeat across
// Dograh instances, so a lookup by run ID could reach an old session).
function decide(sessionId: string, document: unknown, event: DograhWebhookEvent): Decision {
  if (!isRecord(document)) return { kind: "skip", reason: "not_found" };
  const session = parsePracticeSession(sessionId, document);
  if (!session) return { kind: "skip", reason: "invalid_data" };
  const storedRunId = session.dograh?.workflowRunId;
  if (storedRunId !== undefined && storedRunId !== event.workflowRunId) return { kind: "skip", reason: "run_mismatch" };
  const transcriptStatus = session.dograh?.transcriptStatus;
  // A redelivery must not download an expired signed URL again or replace a stored transcript.
  if (transcriptStatus === "ready" || transcriptStatus === "empty") return { kind: "done" };
  return { kind: "proceed", session };
}

type Download =
  | { transcript: TranscriptTurn[]; transcriptStatus: "ready" | "empty" }
  | { transcriptStatus: "error"; transcriptError: TranscriptError };

function buildPatch(session: PracticeSession, event: DograhWebhookEvent, download: Download): TranscriptPatch {
  const patch: TranscriptPatch = {};
  // Missing when the browser's "connected" save failed; the call-state machine never sets it later.
  if (session.dograh?.workflowRunId === undefined) patch.workflowRunId = event.workflowRunId;
  if (event.transcriptUrl !== undefined) patch.transcriptUrl = event.transcriptUrl;
  if (event.recordingUrl !== undefined) patch.recordingUrl = event.recordingUrl;
  if (event.summary !== undefined) patch.summary = event.summary;
  if (download.transcriptStatus === "error") return { ...patch, ...download };
  return { ...patch, ...download, ...(session.dograh?.transcriptError !== undefined ? { transcriptError: null } : {}) };
}

function isUnchanged(session: PracticeSession, patch: TranscriptPatch): boolean {
  const stored = session.dograh;
  return stored !== undefined && (Object.keys(patch) as (keyof TranscriptPatch)[]).every((key) =>
    key === "transcript"
      ? JSON.stringify(stored.transcript) === JSON.stringify(patch.transcript)
      : stored[key] === patch[key]);
}

export async function applyDograhWebhook(
  rawPayload: unknown, store: WebhookStore, delivery: { attempt: number | null } = { attempt: null },
): Promise<WebhookOutcome> {
  const event = parseDograhWebhookEvent(rawPayload);
  if (!event) return { status: "invalid_payload" };
  const finish = (decision: Exclude<Decision, { kind: "proceed" }>): WebhookOutcome => {
    if (decision.kind === "done") return { status: "ok", changed: false };
    store.onSkip(decision.reason);
    return { status: "skipped", reason: decision.reason };
  };
  try {
    const first = await store.transaction(event.sessionId,
      async (transaction) => decide(event.sessionId, await transaction.readDocument(), event));
    if (first.kind !== "proceed") return finish(first);

    // The download runs outside any transaction; no transcript_url means the call had no speech.
    let download: Download = { transcript: [], transcriptStatus: "empty" };
    if (event.transcriptUrl !== undefined) {
      let result: TranscriptDownload;
      try {
        result = await store.fetchTranscript(event.transcriptUrl);
      } catch (error) {
        store.onError(error);
        result = { status: "error", reason: "network" };
      }
      if (result.status === "ok") {
        const turns = parseDograhTranscriptText(result.text);
        download = { transcript: turns, transcriptStatus: turns.length > 0 ? "ready" : "empty" };
      } else {
        const isFinal = delivery.attempt === null || delivery.attempt >= MAX_DELIVERY_ATTEMPTS;
        const retry = TRANSIENT_ERRORS.includes(result.reason) && !isFinal;
        store.onDownloadFailure({ reason: result.reason, rejectedHost: result.rejectedHost, retry });
        // Nothing is written before a retry; Dograh sends the same payload again.
        if (retry) return { status: "retry", reason: result.reason };
        download = { transcriptStatus: "error", transcriptError: result.reason };
      }
    }

    // Decide again on a fresh read: another delivery may have finished meanwhile.
    const second = await store.transaction(event.sessionId, async (transaction): Promise<
      Exclude<Decision, { kind: "proceed" }> | { kind: "written"; markReviewPending: boolean }> => {
      const decision = decide(event.sessionId, await transaction.readDocument(), event);
      if (decision.kind !== "proceed") return decision;
      const patch = buildPatch(decision.session, event, download);
      if (isUnchanged(decision.session, patch)) return { kind: "done" };
      // A completed review is never regenerated automatically.
      const markReviewPending = patch.transcriptStatus === "ready" && decision.session.reviewStatus !== "completed";
      await transaction.writePatch(patch, { markReviewPending });
      return { kind: "written", markReviewPending };
    });
    if (second.kind !== "written") return finish(second);
    return { status: "ok", changed: true, ...(second.markReviewPending ? { reviewSessionId: event.sessionId } : {}) };
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
