import { isCallDuration, isLabel, isPracticeSessionId, isRecord, isRunId, parsePracticeSession } from "./session.ts";
import type { PracticeSession } from "./session.ts";
import { isOwnedSession } from "./read-session.ts";

type FailureReason = "mic_denied" | "network_error" | "dropped";
type DisconnectReason = "user_ended" | "network_error" | "dropped";
export type CallEvent =
  | { event: "connecting" }
  | { event: "connected"; workflowRunId: number; agentId?: string }
  | { event: "disconnected"; durationSeconds: number; endReason?: DisconnectReason }
  | { event: "error"; endReason: FailureReason };

export type CallPatch = Pick<PracticeSession, "status" | "dograh">;
export type CallUpdateResult = { status: "ok"; changed: boolean } |
  { status: "unauthenticated" | "invalid_id" | "invalid_update" | "not_found" | "invalid_data" | "conflict" | "unavailable" };

export function parseCallEvent(value: unknown): CallEvent | null {
  if (!isRecord(value)) return null;
  const only = (...fields: string[]) => Object.keys(value).every((key) => fields.includes(key));
  switch (value.event) {
    case "connecting":
      return only("event") ? { event: "connecting" } : null;
    case "connected":
      if (!only("event", "workflowRunId", "agentId") || !isRunId(value.workflowRunId) ||
        ("agentId" in value && !isLabel(value.agentId))) return null;
      return { event: "connected", workflowRunId: value.workflowRunId,
        ...(typeof value.agentId === "string" ? { agentId: value.agentId } : {}) };
    case "disconnected":
      if (!only("event", "durationSeconds", "endReason") || !isCallDuration(value.durationSeconds) ||
        ("endReason" in value && value.endReason !== "user_ended" && value.endReason !== "network_error" && value.endReason !== "dropped")) return null;
      return { event: "disconnected", durationSeconds: value.durationSeconds,
        ...(value.endReason !== undefined ? { endReason: value.endReason as DisconnectReason } : {}) };
    case "error":
      if (!only("event", "endReason") ||
        (value.endReason !== "mic_denied" && value.endReason !== "network_error" && value.endReason !== "dropped")) return null;
      return { event: "error", endReason: value.endReason };
    default: return null;
  }
}

// null = conflict, undefined = a harmless duplicate. Never return client objects as patches.
function transition(session: PracticeSession, update: CallEvent, now: () => string): CallPatch | null | undefined {
  const { status, dograh } = session;
  if (update.event === "connecting") {
    if (status === "connecting" && !dograh) return undefined;
    return status === "ready" && !dograh ? { status: "connecting" } : null;
  }
  if (update.event === "connected") {
    if (status === "active" && dograh?.workflowRunId === update.workflowRunId && dograh.agentId === update.agentId) return undefined;
    if (status !== "connecting" || dograh) return null;
    return { status: "active", dograh: { workflowRunId: update.workflowRunId,
      ...(update.agentId !== undefined ? { agentId: update.agentId } : {}), startedAt: now() } };
  }
  if (status === "completed" || status === "failed") {
    if (update.event === "disconnected" && dograh && dograh.durationSeconds === update.durationSeconds &&
      dograh.endReason === update.endReason) return undefined;
    if (update.event === "error" && status === "failed" && (!dograh ||
      (dograh.durationSeconds === undefined && dograh.endReason === update.endReason))) return undefined;
    // Pre-run failures have no reason field; repeated errors are no-ops, never new writes.
    return null;
  }
  if (update.event === "error") {
    return { status: "failed", ...(dograh ? { dograh: { ...dograh, endedAt: now(), endReason: update.endReason } } : {}) };
  }
  if (status !== "active" && status !== "connecting") return null;
  if (status === "active" && !dograh) return null;
  const failed = status === "connecting" || update.endReason === "network_error" || update.endReason === "dropped";
  return { status: failed ? "failed" : "completed", ...(dograh ? { dograh: {
    ...dograh, endedAt: now(), durationSeconds: update.durationSeconds,
    ...(update.endReason !== undefined ? { endReason: update.endReason } : {}),
  } } : {}) };
}

type CallTransaction = {
  readDocument: () => Promise<unknown>;
  writePatch: (patch: CallPatch) => Promise<void>;
};
export type CallStateStore = {
  // The server adapter must run the entire callback atomically, including the ownership read.
  transaction: (sessionId: string, apply: (transaction: CallTransaction) => Promise<CallUpdateResult>) => Promise<CallUpdateResult>;
  now: () => string;
  onError: (error: unknown) => void;
};

export async function applyPracticeSessionCallEvent(
  sessionId: unknown, userId: string, rawUpdate: unknown, store: CallStateStore,
): Promise<CallUpdateResult> {
  if (!userId.trim()) return { status: "unauthenticated" };
  if (!isPracticeSessionId(sessionId)) return { status: "invalid_id" };
  const update = parseCallEvent(rawUpdate);
  if (!update) return { status: "invalid_update" };
  try {
    return await store.transaction(sessionId, async (transaction) => {
      const document = await transaction.readDocument();
      if (!isOwnedSession(document, userId)) return { status: "not_found" };
      const session = parsePracticeSession(sessionId, document);
      if (!session) return { status: "invalid_data" };
      const patch = transition(session, update, store.now);
      if (patch === null) return { status: "conflict" };
      if (patch === undefined) return { status: "ok", changed: false };
      await transaction.writePatch(patch);
      return { status: "ok", changed: true };
    });
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
