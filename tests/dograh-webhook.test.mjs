import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, documentV2 } from "./helpers/fixtures.mjs";

const { applyDograhWebhook, parseDeliveryAttempt, parseDograhWebhookEvent } = loadTs("lib/dograh/transcript-webhook.ts");
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

const failed = (reason, rejectedHost) => async () => ({ status: "error", reason, ...(rejectedHost ? { rejectedHost } : {}) });

// In-memory Firestore: each transaction reads the current document; writes merge into dograh, and a
// null value removes the field (FieldValue.delete() in the adapter). A string download is a success.
function harness(docs, download = async () => raw) {
  const writes = [], skips = [], errors = [], failures = [];
  let downloads = 0;
  const store = {
    transaction: async (id, apply) => apply({
      readDocument: async () => docs[id],
      writePatch: async (patch, { markReviewPending }) => {
        writes.push({ id, patch, markReviewPending });
        const dograh = { ...docs[id].dograh, ...patch };
        for (const key of Object.keys(dograh)) if (dograh[key] === null) delete dograh[key];
        docs[id] = { ...docs[id], dograh, ...(markReviewPending ? { reviewStatus: "pending" } : {}) };
      },
    }),
    fetchTranscript: async (source) => {
      downloads++;
      const result = await download(source);
      return typeof result === "string" ? { status: "ok", text: result } : result;
    },
    onSkip: (reason) => skips.push(reason),
    onDownloadFailure: (failure) => failures.push(failure),
    onError: (error) => errors.push(error),
  };
  return { store, docs, writes, skips, errors, failures, downloads: () => downloads,
    run: (body = payload(), attempt = null) => applyDograhWebhook(body, store, { attempt }) };
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
  for (const [download, expected] of [[async () => raw, "ready"], [async () => "", "empty"], [failed("http_4xx"), "error"]]) {
    const h = harness({ "session-a": callEnded() }, download);
    assert.deepEqual(await h.run(payload({ recording_url: url, call_summary: "Talked about the market." })),
      { status: "ok", changed: true, ...(expected === "ready" ? { reviewSessionId: "session-a" } : {}) });
    assert.equal(h.docs["session-a"].reviewStatus, expected === "ready" ? "pending" : undefined, "only a ready transcript queues a review");
    const { dograh } = h.docs["session-a"];
    assert.equal(dograh.transcriptStatus, expected);
    assert.equal(dograh.startedAt, "2026-11-14T10:00:00.000Z");
    assert.equal(dograh.transcriptUrl, url);
    assert.equal(dograh.recordingUrl, url);
    assert.equal(dograh.summary, "Talked about the market.");
    assert.equal("workflowRunId" in h.writes[0].patch, false, "a stored run ID is never rewritten");
    if (expected === "ready") assert.deepEqual(dograh.transcript, parseDograhTranscriptText(raw));
    if (expected === "empty") assert.deepEqual(dograh.transcript, []);
    assert.equal(dograh.transcriptError, expected === "error" ? "http_4xx" : undefined);
    assert.deepEqual(h.errors, []);
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
  const h = harness({ "session-a": callEnded() }, async () => (fail ? { status: "error", reason: "http_5xx" } : raw));
  await h.run();
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "error");
  assert.equal(h.docs["session-a"].dograh.transcriptError, "http_5xx");
  assert.deepEqual(await h.run(), { status: "ok", changed: false }, "the same failure again changes nothing");
  fail = false;
  assert.deepEqual(await h.run(), { status: "ok", changed: true, reviewSessionId: "session-a" });
  assert.equal(h.docs["session-a"].dograh.transcriptStatus, "ready");
  assert.equal(h.writes.at(-1).patch.transcriptError, null, "a success removes the old reason");
  assert.equal("transcriptError" in h.docs["session-a"].dograh, false);
  assert.ok(parsePracticeSession("session-a", h.docs["session-a"]));
});

test("a ready transcript marks the review pending once (TR-03); a completed review is never queued again", async () => {
  for (const [reviewStatus, queued] of [[undefined, true], ["failed", true], ["pending", true], ["completed", false]]) {
    const h = harness({ "session-a": { ...callEnded(), ...(reviewStatus ? { reviewStatus } : {}) } });
    const outcome = await h.run();
    assert.equal(outcome.reviewSessionId, queued ? "session-a" : undefined, String(reviewStatus));
    assert.equal(h.writes[0].markReviewPending, queued);
    assert.equal(h.docs["session-a"].reviewStatus, queued ? "pending" : "completed");
    assert.deepEqual(await h.run(), { status: "ok", changed: false }, "a redelivery does not start another review");
  }
});

test("X-Dograh-Delivery-Attempt: 1-based; missing or malformed means the last attempt", () => {
  for (const [header, expected] of [["1", 1], ["5", 5], [" 3 ", 3], [null, null], ["", null], ["0", null],
    ["-1", null], ["1.5", null], ["abc", null], ["9999999", null]]) {
    assert.equal(parseDeliveryAttempt(header), expected, String(header));
  }
});

test("a transient failure before the last attempt answers retry and writes nothing (TR-02)", async () => {
  for (const reason of ["timeout", "network", "http_5xx"]) {
    for (const attempt of [1, 2, 3, 4]) {
      const h = harness({ "session-a": callEnded() }, failed(reason));
      assert.deepEqual(await h.run(payload(), attempt), { status: "retry", reason });
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.failures, [{ reason, rejectedHost: undefined, retry: true }]);
    }
    for (const attempt of [5, null]) {
      const h = harness({ "session-a": callEnded() }, failed(reason));
      assert.deepEqual(await h.run(payload(), attempt), { status: "ok", changed: true }, `attempt ${attempt} is the last`);
      assert.equal(h.docs["session-a"].dograh.transcriptStatus, "error");
      assert.equal(h.docs["session-a"].dograh.transcriptError, reason);
      assert.equal(h.failures[0].retry, false);
    }
  }
  const h = harness({ "session-a": callEnded() }, async () => { throw new Error("adapter bug"); });
  assert.deepEqual(await h.run(payload(), 1), { status: "retry", reason: "network" });
  assert.equal(h.errors.length, 1);
});

test("a permanent failure is stored at once with its reason, and the rejected host is reported", async () => {
  for (const reason of ["untrusted_url", "redirect_rejected", "http_4xx", "too_large", "invalid_utf8"]) {
    const h = harness({ "session-a": callEnded() }, failed(reason, "storage.other.test"));
    assert.deepEqual(await h.run(payload(), 1), { status: "ok", changed: true });
    assert.equal(h.docs["session-a"].dograh.transcriptStatus, "error");
    assert.equal(h.docs["session-a"].dograh.transcriptError, reason);
    assert.deepEqual(h.failures, [{ reason, rejectedHost: "storage.other.test", retry: false }]);
    assert.doesNotMatch(JSON.stringify(h.failures), /signature|https:/);
  }
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
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const updates = [], references = [];
  let transactions = 0, allowedHosts, stored = callEnded({ workflowRunId: 31, transcriptStatus: "error", transcriptError: "timeout" });
  let download = { status: "ok", text: raw };
  const { ingestDograhTranscriptWebhook } = loadTs("lib/dograh/server.ts", {
    "@/firebase/admin": { adminDb: {
      collection: (name) => ({ doc: (id) => { references.push(`${name}/${id}`); return { name, id }; } }),
      runTransaction: async (apply) => { transactions++; return apply({
        get: async () => ({ exists: true, data: () => stored }),
        update: (reference, patch) => updates.push({ reference, patch }),
      }); },
    } },
    "./fetch-transcript": { fetchDograhTranscript: async (source, allowed) => {
      assert.equal(source, url); allowedHosts = allowed; return download;
    } },
  });
  assert.deepEqual(await ingestDograhTranscriptWebhook(payload(), null), { status: "ok", changed: true, reviewSessionId: "session-a" });
  assert.equal(transactions, 2);
  assert.deepEqual([...new Set(references)], ["practiceSessions/session-a"]);
  assert.deepEqual(allowedHosts, ["app.dograh.com", "api.dograh.com"]);
  assert.equal(updates.length, 1);
  const { patch } = updates[0];
  assert.equal(patch["dograh.transcriptStatus"], "ready");
  assert.equal(patch["dograh.transcript"][1].role, "learner");
  assert.equal(patch["dograh.transcriptError"].constructor.name, "DeleteTransform", "the old reason is deleted");
  assert.equal(patch.reviewStatus, "pending", "top-level field, written in the same update");
  assert.ok("updatedAt" in patch);
  assert.equal("dograh" in patch, false);

  process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS = " App.Dograh.com , storage.example.test ,";
  stored = callEnded();
  download = { status: "error", reason: "redirect_rejected", rejectedHost: "files.example.test" };
  assert.deepEqual(await ingestDograhTranscriptWebhook(payload(), 2), { status: "ok", changed: true });
  assert.deepEqual(allowedHosts, ["app.dograh.com", "storage.example.test"]);
  assert.equal(updates.at(-1).patch["dograh.transcriptError"], "redirect_rejected");
  assert.equal("reviewStatus" in updates.at(-1).patch, false);
  assert.deepEqual(logs, [["[dograh.webhook.download]", { code: "redirect_rejected", retry: false, host: "files.example.test" }]]);
  download = { status: "error", reason: "timeout" };
  assert.deepEqual(await ingestDograhTranscriptWebhook(payload(), 2), { status: "retry", reason: "timeout" });
});
