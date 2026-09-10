import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { setup, document, review, completed } from "./helpers/fixtures.mjs";
const domain = loadTs("lib/practice/session.ts");
const { readPracticeSession } = loadTs("lib/practice/read-session.ts");
const { applyPracticeSessionCallEvent, parseCallEvent } = loadTs("lib/practice/call-state.ts");

test("setup supports every configured language/topic/level/duration", () => {
  for (const languageId of Object.keys(domain.practiceLanguages))
    for (const topicId of Object.keys(domain.practiceTopics))
      for (const level of domain.practiceLevels)
        for (const durationMinutes of domain.practiceDurations)
          assert.ok(domain.parsePracticeSetup({ ...setup, languageId, topicId, level, durationMinutes }));
});
test("setup and session IDs reject invalid values", () => {
  for (const value of [null, {}, { ...setup, languageId: "unknown" }, { ...setup, durationMinutes: "5" }])
    assert.equal(domain.parsePracticeSetup(value), null);
  for (const id of [undefined, "", "../a", "a/b", "a".repeat(129), 12]) assert.equal(domain.isPracticeSessionId(id), false);
});
test("session DTO includes validated review but strips ownership and extra fields", () => {
  const result = domain.parsePracticeSession("session-a", completed({ review, reviewStatus: "completed", secret: "private" }));
  assert.deepEqual(result.review, review);
  assert.equal(result.reviewStatus, "completed");
  assert.equal("userId" in result, false);
  assert.equal("secret" in result, false);
  assert.equal(domain.parsePracticeSession("session-a", completed({ review: { ...review, overallScore: 101 } })), null);
});
test("session reader enforces authentication, ownership and data validity", async () => {
  for (const [user, id, doc, expected] of [
    [null, "session-a", document(), "unauthenticated"],
    [{ id: "user-a" }, undefined, document(), "missing_id"],
    [{ id: "user-a" }, "../a", document(), "invalid_id"],
    [{ id: "user-b" }, "session-a", document(), "not_found"],
    [{ id: "user-a" }, "session-a", undefined, "not_found"],
    [{ id: "user-a" }, "session-a", { userId: "user-a" }, "invalid_data"],
    [{ id: "user-a", name: "A", photoURL: null }, "session-a", document(), "ok"],
  ]) {
    const result = await readPracticeSession(id, { getUser: async () => user, readDocument: async () => doc, onError() {} });
    assert.equal(result.status, expected);
  }
});
test("call events reject client-owned status, timestamps and invalid payloads", () => {
  for (const value of [{ event: "connecting", userId: "user-b" }, { event: "connecting", status: "completed" },
    { event: "connected", workflowRunId: 0 }, { event: "connected", workflowRunId: 31, startedAt: "now" },
    { event: "disconnected", durationSeconds: -1 }, { event: "error", endReason: "unknown" }]) assert.equal(parseCallEvent(value), null);
});
test("call lifecycle persists once per transition, preserves run ID and rejects reopening", async () => {
  let doc = document();
  const writes = [];
  const store = { transaction: async (_id, apply) => apply({ readDocument: async () => doc,
    writePatch: async (patch) => { writes.push(patch); doc = { ...doc, ...patch }; } }),
  now: () => "2026-09-10T00:00:00.000Z", onError() {} };
  const apply = (event, user = "user-a") => applyPracticeSessionCallEvent("session-a", user, event, store);
  assert.equal((await apply({ event: "connecting" }, "user-b")).status, "not_found");
  assert.equal(writes.length, 0);
  await apply({ event: "connecting" });
  const connected = { event: "connected", workflowRunId: 31 };
  await apply(connected);
  assert.deepEqual(await apply(connected), { status: "ok", changed: false });
  assert.equal((await apply({ ...connected, workflowRunId: 32 })).status, "conflict");
  const ended = { event: "disconnected", durationSeconds: 30, endReason: "user_ended" };
  await apply(ended);
  assert.equal(doc.status, "completed");
  assert.equal(doc.dograh.workflowRunId, 31);
  assert.deepEqual(await apply(ended), { status: "ok", changed: false });
  assert.equal((await apply({ event: "connecting" })).status, "conflict");
  assert.equal(writes.length, 3);
});
test("call microphone failure marks failed and database errors return unavailable", async () => {
  let patch;
  const store = { transaction: async (_id, apply) => apply({ readDocument: async () => document(), writePatch: async (p) => { patch = p; } }), now: () => "2026-09-10T00:00:00.000Z", onError() {} };
  await applyPracticeSessionCallEvent("session-a", "user-a", { event: "error", endReason: "mic_denied" }, store);
  assert.equal(patch.status, "failed");
  store.transaction = async () => { throw new Error("offline"); };
  assert.equal((await applyPracticeSessionCallEvent("session-a", "user-a", { event: "connecting" }, store)).status, "unavailable");
});
