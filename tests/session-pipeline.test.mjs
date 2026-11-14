import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { document, review } from "./helpers/fixtures.mjs";

test("session → call → webhook → background review → owned read (in-memory services)", async () => {
  const { applyPracticeSessionCallEvent } = loadTs("lib/practice/call-state.ts");
  const { applyDograhWebhook } = loadTs("lib/dograh/transcript-webhook.ts");
  const { fetchDograhTranscript } = loadTs("lib/dograh/fetch-transcript.ts");
  const { generateBackgroundReview, generatePracticeSessionReview } = loadTs("lib/practice/review-state.ts");
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
  // The Dograh storage link redirects once; the target is allowlisted.
  const delivery = await applyDograhWebhook({ session_id: "session-a", workflow_run_id: "31",
    transcript_url: "https://api.dograh.test/download/31", recording_url: "", call_summary: "" }, {
    transaction: async (id, apply) => apply({ readDocument: async () => (id === "session-a" ? doc : undefined),
      writePatch: async (patch, { markReviewPending }) => {
        doc = { ...doc, dograh: { ...doc.dograh, ...patch }, ...(markReviewPending ? { reviewStatus: "pending" } : {}) };
      } }),
    fetchTranscript: (url) => fetchDograhTranscript(url, ["api.dograh.test", "storage.example.test"], async (source) =>
      source.hostname === "api.dograh.test"
        ? new Response(null, { status: 302, headers: { location: "https://storage.example.test/31.txt?sig=1" } })
        : new Response("[00:01] user: I go yesterday")),
    onSkip: (reason) => assert.fail(reason), onDownloadFailure: (failure) => assert.fail(failure.reason), onError,
  }, { attempt: 1 });
  assert.deepEqual(delivery, { status: "ok", changed: true, reviewSessionId: "session-a" });
  assert.equal(doc.dograh.transcriptStatus, "ready");
  assert.equal(doc.reviewStatus, "pending");

  // The route starts this with after(); the review page's request then gets the saved review.
  const reviewStore = {
    transaction: async (_id, apply) => apply({ readDocument: async () => doc,
      markProcessing: async (claimedAt) => { doc = { ...doc, reviewStatus: "processing", reviewClaimedAt: claimedAt }; } }),
    generate: async (transcript, context) => {
      assert.equal(transcript[0].text, "I go yesterday"); assert.equal(context.language, "English");
      return { status: "ok", review };
    },
    writeCompleted: async (_id, value, claimedAt) => {
      assert.equal(doc.reviewClaimedAt, claimedAt);
      doc = { ...doc, review: value, reviewStatus: "completed" };
      return true;
    },
    writeFailed: async () => assert.fail("unexpected generation failure"),
    now: () => "2026-09-10T00:01:00.000Z", onError,
  };
  assert.equal((await generateBackgroundReview("session-a", reviewStore)).status, "ok");
  reviewStore.generate = async () => assert.fail("a completed review is never generated again");
  assert.deepEqual(await generatePracticeSessionReview("session-a", "user-a", reviewStore), { status: "ok", review });
  const reader = { getUser: async () => ({ id: "user-a", name: "A", photoURL: null }), readDocument: async () => doc, onError };
  const result = await readPracticeSession("session-a", reader);
  assert.deepEqual(result.session.review, review);
  reader.getUser = async () => ({ id: "user-b" });
  assert.equal((await readPracticeSession("session-a", reader)).status, "not_found");
});
