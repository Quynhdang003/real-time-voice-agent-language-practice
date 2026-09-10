import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { document } from "./helpers/fixtures.mjs";

test("session → call → completion → owned read (in-memory services)", async () => {
  const { applyPracticeSessionCallEvent } = loadTs("lib/practice/call-state.ts");
  const { readPracticeSession } = loadTs("lib/practice/read-session.ts");
  let doc = document();
  const onError = (error) => { throw error; };
  const callStore = {
    transaction: async (_id, apply) => apply({
      readDocument: async () => doc,
      writePatch: async (patch) => { doc = { ...doc, ...patch }; },
    }),
    now: () => "2026-09-10T00:00:00.000Z",
    onError,
  };

  for (const event of [
    { event: "connecting" },
    { event: "connected", workflowRunId: 31 },
    { event: "disconnected", durationSeconds: 30, endReason: "user_ended" },
  ]) {
    assert.equal((await applyPracticeSessionCallEvent("session-a", "user-a", event, callStore)).status, "ok");
  }

  assert.equal(doc.status, "completed");
  assert.equal(doc.dograh.workflowRunId, 31);
  assert.equal(doc.dograh.durationSeconds, 30);
  const reader = {
    getUser: async () => ({ id: "user-a", name: "A", photoURL: null }),
    readDocument: async () => doc,
    onError,
  };
  const result = await readPracticeSession("session-a", reader);
  assert.equal(result.status, "ok");
  assert.equal(result.session.status, "completed");
  reader.getUser = async () => ({ id: "user-b" });
  assert.equal((await readPracticeSession("session-a", reader)).status, "not_found");
});
