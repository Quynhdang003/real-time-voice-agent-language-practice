import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, review } from "./helpers/fixtures.mjs";
const { generatePracticeSessionReview } = loadTs("lib/practice/review-state.ts");

function harness(initial = completed()) {
  let doc = initial;
  const calls = [];
  const store = {
    transaction: async (_id, apply) => apply({ readDocument: async () => doc,
      markProcessing: async () => { doc.reviewStatus = "processing"; calls.push("claim"); } }),
    generate: async () => { calls.push("generate"); return { status: "ok", review }; },
    writeCompleted: async (_id, value) => { calls.push("complete"); doc = { ...doc, review: value, reviewStatus: "completed" }; },
    writeFailed: async () => { calls.push("failed"); doc.reviewStatus = "failed"; },
    onError: () => calls.push("error"),
  };
  return { store, calls, doc: () => doc, run: (id = "session-a", user = "user-a") => generatePracticeSessionReview(id, user, store) };
}
test("review validates session IDs before opening a transaction", async () => {
  for (const id of ["", "../a", "a/b", "a".repeat(129), 123]) {
    const h = harness();
    h.store.transaction = async () => assert.fail("invalid ID must not reach database");
    assert.equal((await h.run(id)).status, "invalid_id");
  }
});
test("review gates authentication, ownership, completion and transcript states", async () => {
  for (const [doc, user, expected] of [
    [completed(), "", "unauthenticated"], [completed(), "user-b", "not_found"],
    [completed({ status: "active" }), "user-a", "not_ready"],
    [completed({ reviewStatus: "processing" }), "user-a", "already_processing"],
    [completed({ dograh: { workflowRunId: 31 } }), "user-a", "transcript_pending"],
    [completed({ dograh: { workflowRunId: 31, transcriptStatus: "empty", transcript: [] } }), "user-a", "transcript_empty"],
    [completed({ dograh: { workflowRunId: 31, transcriptStatus: "error" } }), "user-a", "transcript_error"],
  ]) {
    const h = harness(doc);
    assert.equal((await h.run("session-a", user)).status, expected);
    assert.deepEqual(h.calls, []);
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
