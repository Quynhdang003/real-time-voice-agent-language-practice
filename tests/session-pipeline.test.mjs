import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { document, review } from "./helpers/fixtures.mjs";

test("session → call → downloaded transcript → review → owned read (in-memory services)", async () => {
  const { applyPracticeSessionCallEvent } = loadTs("lib/practice/call-state.ts");
  const { applyDograhTranscriptEvent } = loadTs("lib/dograh/transcript-webhook.ts");
  const { fetchDograhTranscript } = loadTs("lib/dograh/fetch-transcript.ts");
  const { generatePracticeSessionReview } = loadTs("lib/practice/review-state.ts");
  const { readPracticeSession } = loadTs("lib/practice/read-session.ts");
  let doc = document();
  const onError = (error) => { throw error; };
  const callStore = { transaction: async (_id, apply) => apply({ readDocument: async () => doc,
    writePatch: async (patch) => { doc = { ...doc, ...patch }; } }),
  now: () => "2026-09-10T00:00:00.000Z", onError };
  for (const event of [{ event: "connecting" }, { event: "connected", workflowRunId: 31 },
    { event: "disconnected", durationSeconds: 30, endReason: "user_ended" }]) {
    assert.equal((await applyPracticeSessionCallEvent("session-a", "user-a", event, callStore)).status, "ok");
  }
  assert.equal(doc.status, "completed");
  await applyDograhTranscriptEvent({ workflow_run_id: 31, transcript_url: "https://storage.example.test/31.txt" }, {
    findSessionByRunId: async (id) => id === doc.dograh.workflowRunId ? { sessionId: "session-a", dograh: doc.dograh } : null,
    fetchTranscript: (url) => fetchDograhTranscript(url, ["storage.example.test"], async () => new Response("[00:01] user: I go yesterday")),
    writePatch: async (_id, patch) => { doc.dograh = { ...doc.dograh, ...patch }; }, onError,
  });
  assert.equal(doc.dograh.transcriptStatus, "ready");
  const outcome = await generatePracticeSessionReview("session-a", "user-a", {
    transaction: async (_id, apply) => apply({ readDocument: async () => doc, markProcessing: async () => { doc.reviewStatus = "processing"; } }),
    generate: async (transcript, context) => {
      assert.equal(transcript[0].text, "I go yesterday"); assert.equal(context.language, "English");
      return { status: "ok", review };
    },
    writeCompleted: async (_id, value) => { doc.review = value; doc.reviewStatus = "completed"; },
    writeFailed: async () => assert.fail("unexpected generation failure"), onError,
  });
  assert.equal(outcome.status, "ok");
  const reader = { getUser: async () => ({ id: "user-a", name: "A", photoURL: null }), readDocument: async () => doc, onError };
  const result = await readPracticeSession("session-a", reader);
  assert.deepEqual(result.session.review, review);
  reader.getUser = async () => ({ id: "user-b" });
  assert.equal((await readPracticeSession("session-a", reader)).status, "not_found");
});
