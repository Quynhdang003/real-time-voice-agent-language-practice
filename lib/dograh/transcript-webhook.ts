import { isRecord } from "@/lib/practice/session";
import type { TranscriptStatus, TranscriptTurn } from "@/lib/practice/session";
import { parseDograhTranscriptText } from "./transcript-parser";

const MAX_SUMMARY_LENGTH = 4000;

export type DograhTranscriptEvent = {
  workflowRunId: number;
  transcriptUrl?: string;
  recordingUrl?: string;
  summary?: string;
};

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function toRunId(value: unknown): number | null {
  const runId = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null;
}

export function parseDograhWebhookEvent(value: unknown): DograhTranscriptEvent | null {
  if (!isRecord(value)) return null;
  const workflowRunId = toRunId(value.workflow_run_id);
  if (workflowRunId === null) return null;

  const event: DograhTranscriptEvent = { workflowRunId };
  if (value.transcript_url != null) {
    if (!isHttpUrl(value.transcript_url)) return null;
    event.transcriptUrl = value.transcript_url;
  }
  if (value.recording_url != null) {
    if (!isHttpUrl(value.recording_url)) return null;
    event.recordingUrl = value.recording_url;
  }
  const gatheredContext = value.gathered_context;
  if (isRecord(gatheredContext) && typeof gatheredContext.call_summary === "string") {
    event.summary = gatheredContext.call_summary.slice(0, MAX_SUMMARY_LENGTH);
  }
  return event;
}

export type TranscriptPatch = {
  transcriptUrl?: string; recordingUrl?: string; summary?: string;
  transcript?: TranscriptTurn[]; transcriptStatus?: TranscriptStatus;
};
export type TranscriptApplyResult =
  | { status: "ok"; changed: boolean }
  | { status: "not_found" | "invalid_payload" | "unavailable" };

type TranscriptStore = {
  findSessionByRunId: (runId: number) => Promise<{ sessionId: string; dograh?: TranscriptPatch } | null>;
  // May throw; a download/parse failure must not crash the whole webhook.
  fetchTranscript: (url: string) => Promise<string>;
  writePatch: (sessionId: string, patch: TranscriptPatch) => Promise<void>;
  onError: (error: unknown) => void;
};

export async function applyDograhTranscriptEvent(
  rawPayload: unknown, store: TranscriptStore,
): Promise<TranscriptApplyResult> {
  const event = parseDograhWebhookEvent(rawPayload);
  if (!event) return { status: "invalid_payload" };
  try {
    const match = await store.findSessionByRunId(event.workflowRunId);
    if (!match) return { status: "not_found" };

    const patch: TranscriptPatch = {};
    if (event.transcriptUrl !== undefined) patch.transcriptUrl = event.transcriptUrl;
    if (event.recordingUrl !== undefined) patch.recordingUrl = event.recordingUrl;
    if (event.summary !== undefined) patch.summary = event.summary;

    // A duplicate delivery must not redownload an expired signed URL or
    // downgrade a transcript already downloaded successfully.
    const alreadyDownloaded = match.dograh?.transcriptUrl === event.transcriptUrl &&
      Array.isArray(match.dograh?.transcript) &&
      (match.dograh?.transcriptStatus === "ready" || match.dograh?.transcriptStatus === "empty");
    if (event.transcriptUrl !== undefined && !alreadyDownloaded) {
      try {
        const raw = await store.fetchTranscript(event.transcriptUrl);
        const turns = parseDograhTranscriptText(raw);
        patch.transcript = turns;
        patch.transcriptStatus = turns.length > 0 ? "ready" : "empty";
      } catch (error) {
        store.onError(error);
        patch.transcriptStatus = "error";
      }
    }

    const unchanged = match.dograh !== undefined &&
      (Object.keys(patch) as (keyof TranscriptPatch)[]).every((key) =>
        key === "transcript"
          ? JSON.stringify(match.dograh?.transcript) === JSON.stringify(patch.transcript)
          : match.dograh?.[key] === patch[key]);
    if (unchanged) return { status: "ok", changed: false };

    await store.writePatch(match.sessionId, patch);
    return { status: "ok", changed: true };
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
