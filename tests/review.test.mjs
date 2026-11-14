import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, review } from "./helpers/fixtures.mjs";
const { generateBackgroundReview, generatePracticeSessionReview, REVIEW_LEASE_MS } = loadTs("lib/practice/review-state.ts");

const start = Date.parse("2026-11-14T10:00:00.000Z");
const at = (ms) => new Date(start + ms).toISOString();

// In-memory session; writes follow the adapter's rule: only while the claim still holds.
function harness(initial = completed()) {
  let doc = initial;
  let clock = 0;
  const calls = [];
  const writeIfClaimed = (claimedAt, patch) => {
    if (doc.reviewStatus !== "processing" || doc.reviewClaimedAt !== claimedAt) return false;
    doc = { ...doc, ...patch };
    delete doc.reviewClaimedAt;
    return true;
  };
  const store = {
    transaction: async (_id, apply) => apply({ readDocument: async () => doc,
      markProcessing: async (claimedAt) => { doc = { ...doc, reviewStatus: "processing", reviewClaimedAt: claimedAt }; calls.push("claim"); } }),
    generate: async () => { calls.push("generate"); return { status: "ok", review }; },
    writeCompleted: async (_id, value, claimedAt) => { calls.push("complete"); return writeIfClaimed(claimedAt, { review: value, reviewStatus: "completed" }); },
    writeFailed: async (_id, claimedAt) => { calls.push("failed"); return writeIfClaimed(claimedAt, { reviewStatus: "failed" }); },
    now: () => at(clock),
    onError: () => calls.push("error"),
  };
  return { store, calls, doc: () => doc, setDoc: (value) => { doc = value; }, tick: (ms) => { clock += ms; },
    run: (id = "session-a", user = "user-a") => generatePracticeSessionReview(id, user, store),
    background: (id = "session-a") => generateBackgroundReview(id, store) };
}
test("review validates session IDs before opening a transaction", async () => {
  for (const id of ["", "../a", "a/b", "a".repeat(129), 123]) {
    const h = harness();
    h.store.transaction = async () => assert.fail("invalid ID must not reach database");
    assert.equal((await h.run(id)).status, "invalid_id");
    assert.equal((await h.background(id)).status, "invalid_id");
  }
});
test("review gates authentication, ownership, completion and transcript states", async () => {
  for (const [doc, user, expected] of [
    [completed(), "", "unauthenticated"], [completed(), "user-b", "not_found"],
    [completed({ status: "active" }), "user-a", "not_ready"],
    [completed({ reviewStatus: "processing", reviewClaimedAt: at(-60_000) }), "user-a", "already_processing"],
    [completed({ dograh: { workflowRunId: 31 } }), "user-a", "transcript_pending"],
    [completed({ dograh: { workflowRunId: 31, transcriptStatus: "empty", transcript: [] } }), "user-a", "transcript_empty"],
    [completed({ dograh: { workflowRunId: 31, transcriptStatus: "error", transcriptError: "http_4xx" } }), "user-a", "transcript_error"],
  ]) {
    const h = harness(doc);
    assert.equal((await h.run("session-a", user)).status, expected);
    assert.deepEqual(h.calls, []);
  }
});
test("pending (set by the webhook) is claimed like a missing status", async () => {
  const h = harness(completed({ reviewStatus: "pending" }));
  assert.deepEqual(await h.run(), { status: "ok", review });
  assert.equal(h.doc().reviewStatus, "completed");
  assert.equal("reviewClaimedAt" in h.doc(), false);
});
test("a processing claim is a 3-minute lease: valid until then, taken over after (TR-03)", async () => {
  assert.equal(REVIEW_LEASE_MS, 180_000);
  for (const [claimedAt, expected] of [[at(-179_999), "already_processing"], [at(-180_000), "ok"],
    [at(-600_000), "ok"], [undefined, "ok"], ["not a time", "ok"]]) {
    const h = harness(completed({ reviewStatus: "processing", ...(claimedAt ? { reviewClaimedAt: claimedAt } : {}) }));
    assert.equal((await h.run()).status, expected, String(claimedAt));
  }
});
test("a result whose claim was taken over is dropped; the newer claim writes its own", async () => {
  const h = harness();
  let release;
  h.store.generate = () => new Promise((resolve) => { release = resolve; });
  const first = h.run();
  await new Promise((resolve) => setImmediate(resolve));
  h.tick(REVIEW_LEASE_MS);
  h.store.generate = async () => ({ status: "ok", review: { ...review, tutorFeedback: "Second." } });
  assert.equal((await h.run()).status, "ok");
  release({ status: "ok", review });
  assert.deepEqual(await first, { status: "already_processing" });
  assert.equal(h.doc().review.tutorFeedback, "Second.");
  const failing = harness();
  failing.store.generate = async () => {
    failing.setDoc({ ...failing.doc(), reviewClaimedAt: at(1) });
    return { status: "quota" };
  };
  assert.deepEqual(await failing.run(), { status: "already_processing" });
  assert.equal(failing.doc().reviewStatus, "processing");
});
test("the background review needs no user, uses the same claim and never repeats a completed one", async () => {
  const h = harness(completed({ userId: "user-b", reviewStatus: "pending" }));
  assert.deepEqual(await h.background(), { status: "ok", review });
  assert.deepEqual(h.calls, ["claim", "generate", "complete"]);
  assert.deepEqual(await h.background(), { status: "ok", review });
  assert.deepEqual(h.calls, ["claim", "generate", "complete"]);
  for (const [doc, expected] of [[null, "not_found"], [completed({ status: "active", reviewStatus: "pending" }), "not_ready"],
    [completed({ reviewStatus: "processing", reviewClaimedAt: at(0) }), "already_processing"]]) {
    const other = harness(doc);
    assert.equal((await other.background()).status, expected);
    assert.deepEqual(other.calls, []);
  }
});
test("successful review is persisted and repeat requests use saved result", async () => {
  const h = harness();
  assert.deepEqual(await h.run(), { status: "ok", review });
  assert.deepEqual(await h.run(), { status: "ok", review });
  assert.deepEqual(h.calls, ["claim", "generate", "complete"]);
});
test("provider failures mark failed and allow another attempt", async () => {
  for (const status of ["quota", "invalid_output", "unavailable"]) {
    const h = harness();
    h.store.generate = async () => ({ status });
    assert.equal((await h.run()).status, status);
    assert.equal(h.doc().reviewStatus, "failed");
    h.store.generate = async () => ({ status: "ok", review });
    assert.equal((await h.run()).status, "ok");
  }
});
test("second request sees processing while the first generation is in flight", async () => {
  const h = harness();
  let release, started;
  const ready = new Promise((resolve) => { started = resolve; });
  h.store.generate = () => { started(); return new Promise((resolve) => { release = resolve; }); };
  const first = h.run();
  await ready;
  assert.equal((await h.run()).status, "already_processing");
  release({ status: "ok", review });
  assert.equal((await first).status, "ok");
});
test("unexpected persistence failure is surfaced without claiming completion", async () => {
  const h = harness();
  h.store.writeCompleted = async () => { throw new Error("offline"); };
  assert.equal((await h.run()).status, "unavailable");
  assert.notEqual(h.doc().reviewStatus, "completed");
});
test("Gemini adapter validates structured output and maps quota errors", async () => {
  for (const [response, expected] of [
    [{ text: JSON.stringify(review) }, "ok"], [{ text: "not json" }, "invalid_output"],
    [{ text: JSON.stringify({ ...review, overallScore: 101 }) }, "invalid_output"], [{}, "invalid_output"],
    [new Error("429 RESOURCE_EXHAUSTED"), "quota"], [new Error("provider offline"), "unavailable"],
  ]) {
    const { generateSessionReview } = loadTs("lib/ai/review.ts", {
      "./gemini": { gemini: { models: { generateContent: async () => { if (response instanceof Error) throw response; return response; } } } },
    });
    assert.equal((await generateSessionReview(completed().dograh.transcript, { language: "English", topic: "Travel", level: "A2" })).status, expected);
  }
});
