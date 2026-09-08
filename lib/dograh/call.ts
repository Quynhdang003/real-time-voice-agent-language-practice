import { isRecord, isRunId } from "../practice/session.ts";
import type { CallEvent } from "../practice/call-state.ts";
import type { DograhWidget } from "./widget.ts";

export type VoiceStatus = "ready" | "connecting" | "active" | "ending" | "completed" | "failed";
export type VoiceState = { status: VoiceStatus; error: string; elapsed: number };
type Dependencies = {
  widget: DograhWidget;
  durationMinutes: number;
  save: (event: CallEvent) => Promise<void>;
  change: (state: VoiceState) => void;
  completed: () => void;
  release: () => void;
  now?: () => number;
};

export function createVoiceCall(deps: Dependencies) {
  let state: VoiceState = { status: "ready", error: "", elapsed: 0 };
  let disposed = false;
  let finished = false;
  let connectedAt: number | undefined;
  let requestedEnd = false;
  let failure: "mic_denied" | "network_error" | "dropped" | undefined;
  let queue = Promise.resolve();
  let saveFailed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const now = deps.now ?? Date.now;
  const change = (patch: Partial<VoiceState>) => {
    state = { ...state, ...patch };
    if (!disposed) deps.change(state);
  };
  const clear = () => { clearInterval(timer); clearTimeout(deadline); };
  const save = (event: CallEvent) => {
    // A failed predecessor must prevent later events from overtaking it.
    queue = queue.then(() => deps.save(event));
    void queue.catch(() => {
      saveFailed = true;
      change({ error: "Unable to save the call state. Check your connection before leaving this page." });
    });
    return queue;
  };
  const detach = () => {
    deps.widget.onCallConnected(null);
    deps.widget.onCallDisconnected(null);
    deps.widget.onCallEnd(null);
    deps.widget.onError(null);
    deps.widget.onStatusChange(null);
  };
  const finish = async () => {
    if (disposed || finished) return;
    finished = true;
    clear();
    const elapsed = connectedAt === undefined ? 0 : Math.max(0, Math.round((now() - connectedAt) / 1000));
    // Dograh reports disconnected before updating its final connectionStatus.
    const failed = failure ?? (deps.widget.getState().connectionStatus === "failed" ? "dropped" : undefined);
    detach();
    // Destroying the isolated widget document also cancels a pending start/mic
    // request, which end() alone does not cancel in the upstream widget.
    deps.release();
    const normal = connectedAt !== undefined && !failed;
    change({ status: normal ? "completed" : "failed", elapsed,
      ...(!normal && !state.error ? { error: "The call could not finish. Start a new practice session to try again." } : {}) });
    try {
      await save(connectedAt === undefined
        ? { event: "error", endReason: failed ?? "dropped" }
        : { event: "disconnected", durationSeconds: elapsed,
          ...(failed ? { endReason: failed === "mic_denied" ? "dropped" : failed } : requestedEnd ? { endReason: "user_ended" as const } : {}) });
      if (!disposed && normal && !saveFailed) deps.completed();
    } catch { /* save() exposes the persistence error; keep the user on this page. */ }
  };
  const end = (userEnded = true) => {
    if (finished || disposed || !["connecting", "active"].includes(state.status)) return;
    requestedEnd = userEnded;
    change({ status: "ending" });
    clear();
    deadline = setTimeout(() => { failure = "dropped"; void finish(); }, 5_000);
    try {
      void Promise.resolve(deps.widget.end()).then(finish, () => { failure = "dropped"; void finish(); });
    } catch { failure = "dropped"; void finish(); }
  };
  const fail = (reason: "mic_denied" | "network_error" | "dropped", message: string) => {
    if (finished || disposed) return;
    failure = reason;
    change({ error: message });
    end(false);
  };
  deps.widget.onCallConnected((payload) => {
    if (disposed || finished || state.status !== "connecting") return;
    if (!isRecord(payload) || !isRunId(payload.workflowRunId)) {
      fail("dropped", "Dograh did not return a valid call ID.");
      return;
    }
    connectedAt = now();
    clearTimeout(deadline);
    change({ status: "active" });
    void save({ event: "connected", workflowRunId: payload.workflowRunId })
      .catch(() => fail("network_error", "Unable to save the connected call. The call has been stopped."));
    timer = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((now() - connectedAt!) / 1000));
      change({ elapsed });
      if (elapsed >= deps.durationMinutes * 60) end(false);
    }, 500);
  });
  deps.widget.onCallDisconnected(() => { queueMicrotask(() => { void finish(); }); });
  deps.widget.onCallEnd(() => { queueMicrotask(() => { void finish(); }); });
  deps.widget.onStatusChange((status) => {
    if (status === "failed") queueMicrotask(() => {
      if (!finished && !failure) fail("dropped", state.error || "The voice connection was interrupted. Please start a new session.");
    });
  });
  deps.widget.onError((error) => {
    // Error can originate in another window, so instanceof Error is unsuitable.
    const message = isRecord(error) && typeof error.message === "string" ? error.message : "";
    const denied = /permission denied|notallowederror|permissiondeniederror/i.test(message);
    fail(denied ? "mic_denied" : "dropped", denied
      ? "Microphone access was denied. Allow microphone access in your browser, then start a new practice session."
      : /no microphone|notfounderror/i.test(message) ? "No microphone found. Connect one and start a new practice session."
      : /already in use/i.test(message) ? "Your microphone is busy. Close the other app and start a new practice session."
      : "Unable to connect to Dograh. Check the voice service and your network, then start a new practice session.");
  });
  return {
    start() {
      if (disposed || finished || state.status !== "ready") return;
      change({ status: "connecting" });
      void save({ event: "connecting" }).catch(() => fail("network_error", "Unable to save the call. The call has been stopped."));
      deadline = setTimeout(() => fail("network_error", "Connecting took too long. Check your microphone permission and network."), 45_000);
      // Invoke directly within the user's click, before awaiting any request.
      try { void Promise.resolve(deps.widget.start()).catch(() => fail("dropped", "Dograh could not start the call.")); }
      catch { fail("dropped", "Dograh could not start the call."); }
    },
    end,
    offline() { if (state.status === "connecting" || state.status === "active") fail("network_error", "You are offline. The call has been stopped."); },
    dispose() {
      if (disposed) return;
      if (!finished && state.status !== "ready") {
        failure = "dropped";
        // Best effort when navigating away; fetch keepalive cannot guarantee delivery.
        void finish();
      }
      disposed = true;
      clear();
      detach();
      try { void Promise.resolve(deps.widget.end()).catch(() => {}); } catch { /* Document removal releases media. */ }
      deps.release();
    },
  };
}
