import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, documentV2 } from "./helpers/fixtures.mjs";

const { applyDograhWebhook, parseDograhWebhookEvent } = loadTs("lib/dograh/transcript-webhook.ts");
const { parseDograhTranscriptText } = loadTs("lib/dograh/transcript-parser.ts");
const { parsePracticeSession } = loadTs("lib/practice/session.ts");
const url = "https://storage.example.test/31.txt?signature=secret";
const raw = "[2026-11-14T10:00:00Z] assistant: Hello Quynh\n[2026-11-14T10:00:05Z] user: I went to the market";
// The rendered Webhook node payload (dograh/workflow-spec.md): every value is a string.
const payload = (extra = {}) => ({
  spec: "fluentai-v2", session_id: "session-a", workflow_run_id: "31", transcript_url: url, recording_url: "",
  call_summary: "", call_duration_seconds: "42", call_disposition: "completed", ...extra,
});
const callEnded = (dograh = { workflowRunId: 31, startedAt: "2026-11-14T10:00:00.000Z" }) =>
  documentV2({ status: "completed", dograh });

// In-memory Firestore: each transaction reads the current document; writes merge into dograh.
function harness(docs, download = async () => raw) {
  const writes = [], skips = [], errors = [];
  let downloads = 0;
  const store = {
    transaction: async (id, apply) => apply({
      readDocument: async () => docs[id],
      writePatch: async (patch) => {
        writes.push({ id, patch });
        docs[id] = { ...docs[id], dograh: { ...docs[id].dograh, ...patch } };
      },
    }),
    fetchTranscript: async (source) => { downloads++; return download(source); },
    onSkip: (reason) => skips.push(reason),
    onError: (error) => errors.push(error),
  };
  return { store, docs, writes, skips, errors, downloads: () => downloads,
    run: (body = payload()) => applyDograhWebhook(body, store) };
}

test("parses the flat v2 payload; \"\" means not sent and unknown keys are ignored", () => {
  assert.deepEqual(parseDograhWebhookEvent(payload()), { sessionId: "session-a", workflowRunId: 31, transcriptUrl: url });
  assert.deepEqual(parseDograhWebhookEvent(payload({ workflow_run_id: 31, transcript_url: null, recording_url: url,
    call_summary: "s".repeat(5000) })), { sessionId: "session-a", workflowRunId: 31, recordingUrl: url, summary: "s".repeat(4000) });
  assert.equal(parseDograhWebhookEvent(payload({ workflow_run_id: "9007199254740991" })).workflowRunId, Number.MAX_SAFE_INTEGER);
});

test("rejects a payload without a valid session_id, run ID, URL or summary", () => {
  for (const value of [null, [], {}, { workflow_run_id: 31, transcript_url: url }, payload({ session_id: "" }),
    payload({ session_id: undefined }), payload({ session_id: "a/b" }), payload({ session_id: "a".repeat(129) }),
    payload({ workflow_run_id: "" }), payload({ workflow_run_id: "0" }), payload({ workflow_run_id: "-1" }),
    payload({ workflow_run_id: "1.5" }), payload({ workflow_run_id: "031" }), payload({ workflow_run_id: "abc" }),
    payload({ workflow_run_id: "9007199254740993" }), payload({ workflow_run_id: 0 }),
    payload({ transcript_url: "file:///etc/passwd" }), payload({ recording_url: "javascript:alert(1)" }),
    payload({ transcript_url: `https://a.test/${"x".repeat(2000)}` }), payload({ transcript_url: 5 }),
    payload({ call_summary: 42 })]) {
    assert.equal(parseDograhWebhookEvent(value), null, JSON.stringify(value)?.slice(0, 120));
  }
});

test("links a delivery by session_id: download → parse → ready, empty or error; call fields are kept", async () => {
  for (const [download, expected] of [[async () => raw, "ready"], [async () => "", "empty"],
    [async () => { throw new Error("Unable to download the Dograh transcript."); }, "error"]]) {
    const h = harness({ "session-a": callEnded() }, download);
    assert.deepEqual(await h.run(payload({ recording_url: url, call_summary: "Talked about the market." })),
      { status: "ok", changed: true });
    const { dograh } = h.docs["session-a"];
    assert.equal(dograh.transcriptStatus, expected);
    assert.equal(dograh.startedAt, "2026-11-14T10:00:00.000Z");
    assert.equal(dograh.transcriptUrl, url);
    assert.equal(dograh.recordingUrl, url);
    assert.equal(dograh.summary, "Talked about the market.");
    assert.equal("workflowRunId" in h.writes[0].patch, false, "a stored run ID is never rewritten");
    if (expected === "ready") assert.deepEqual(dograh.transcript, parseDograhTranscriptText(raw));
    if (expected === "empty") assert.deepEqual(dograh.transcript, []);
    assert.equal(h.errors.length, expected === "error" ? 1 : 0);
    assert.ok(parsePracticeSession("session-a", h.docs["session-a"]), "the session stays readable");
  }
});

test("a call without speech (no transcript_url) is stored as empty without a download", async () => {
  const h = harness({ "session-a": callEnded() });
  assert.equal((await h.run(payload({ transcript_url: "" }))).status, "ok");
  assert.equal(h.downloads(), 0);
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "empty");
  assert.equal("transcriptUrl" in h.docs["session-a"].dograh, false);
});

test("an unknown session, another run's delivery or a corrupt session is skipped with no download or write", async () => {
  for (const [docs, reason] of [
    [{}, "not_found"],
    [{ "session-a": callEnded({ workflowRunId: 30, startedAt: "2026-11-14T10:00:00.000Z" }) }, "run_mismatch"],
    [{ "session-a": { userId: "user-a", status: "unknown" } }, "invalid_data"],
  ]) {
    const h = harness(docs);
    assert.deepEqual(await h.run(), { status: "skipped", reason });
    assert.equal(h.downloads(), 0);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.skips, [reason]);
  }
});

test("an old session holding the same run ID is never touched (lookup by session_id only)", async () => {
  const old = completed({ dograh: { workflowRunId: 31, transcriptStatus: "error", transcriptUrl: "https://old.test/31" } });
  const h = harness({ "old-session": structuredClone(old), "session-a": callEnded() });
  assert.equal((await h.run()).status, "ok");
  assert.deepEqual(h.docs["old-session"], old);
  assert.deepEqual(h.writes.map((write) => write.id), ["session-a"]);
});

test("stores the run ID when the browser's connected save failed", async () => {
  const h = harness({ "session-a": documentV2({ status: "connecting" }) });
  assert.equal((await h.run()).status, "ok");
  assert.equal(h.docs["session-a"].dograh.workflowRunId, 31);
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "ready");
  assert.ok(parsePracticeSession("session-a", h.docs["session-a"]));
});

test("a redelivery is a no-op that never downloads again; an error can be retried", async () => {
  for (const body of [raw, ""]) {
    const h = harness({ "session-a": callEnded() }, async () => body);
    await h.run();
    assert.deepEqual(await h.run(), { status: "ok", changed: false });
    assert.equal(h.downloads(), 1);
    assert.equal(h.writes.length, 1);
  }
  let fail = true;
  const h = harness({ "session-a": callEnded() }, async () => { if (fail) throw new Error("offline"); return raw; });
  await h.run();
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "error");
  fail = false;
  assert.deepEqual(await h.run(), { status: "ok", changed: true });
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "ready");
});

test("a concurrent delivery that finished first wins: the fresh read sees ready and nothing is written", async () => {
  const h = harness({ "session-a": callEnded() });
  h.store.fetchTranscript = async () => {
    h.docs["session-a"] = callEnded({ workflowRunId: 31, transcriptStatus: "ready", transcript: parseDograhTranscriptText(raw) });
    return "[2026-11-14T10:00:00Z] user: other";
  };
  assert.deepEqual(await h.run(), { status: "ok", changed: false });
  assert.deepEqual(h.writes, []);
  assert.equal(h.docs["session-a"].dograh.transcript[1].text, "I went to the market");
});

test("storage failures return unavailable (Dograh retries 5xx)", async () => {
  const h = harness({ "session-a": callEnded() });
  h.store.transaction = async () => { throw new Error("firestore offline"); };
  assert.deepEqual(await h.run(), { status: "unavailable" });
  assert.equal(h.errors.length, 1);
  assert.deepEqual(await h.run({ session_id: "session-a" }), { status: "invalid_payload" });
});

test("Firebase adapter: a transaction per phase on practiceSessions/{session_id}, nested dograh.* update", async (t) => {
  const previous = process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS;
  delete process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS;
  t.after(() => { if (previous !== undefined) process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS = previous; });
  t.mock.method(console, "warn", () => {});
  const updates = [], references = [];
  let transactions = 0, allowedHosts;
  const { ingestDograhTranscriptWebhook } = loadTs("lib/dograh/server.ts", {
    "@/firebase/admin": { adminDb: {
      collection: (name) => ({ doc: (id) => { references.push(`${name}/${id}`); return { name, id }; } }),
      runTransaction: async (apply) => { transactions++; return apply({
        get: async () => ({ exists: true, data: () => callEnded() }),
        update: (reference, patch) => updates.push({ reference, patch }),
      }); },
    } },
    "./fetch-transcript": { fetchDograhTranscript: async (source, allowed) => {
      assert.equal(source, url); allowedHosts = allowed; return raw;
    } },
  });
  assert.deepEqual(await ingestDograhTranscriptWebhook(payload()), { status: "ok", changed: true });
  assert.equal(transactions, 2);
  assert.deepEqual([...new Set(references)], ["practiceSessions/session-a"]);
  assert.deepEqual(allowedHosts, ["app.dograh.com"]);
  assert.equal(updates.length, 1);
  const { patch } = updates[0];
  assert.equal(patch["dograh.transcriptStatus"], "ready");
  assert.equal(patch["dograh.transcript"][1].role, "learner");
  assert.ok("updatedAt" in patch);
  assert.equal("dograh" in patch, false);
});
