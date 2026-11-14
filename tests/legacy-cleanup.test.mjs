import test from "node:test";
import assert from "node:assert/strict";
import { legacyCleanupGroup } from "../scripts/legacy-sessions-rule.mjs";
import { completed, document, documentV2, review } from "./helpers/fixtures.mjs";

test("DATA-01 deletes only v1 sessions that never called, or completed without a transcript", () => {
  for (const [data, expected] of [
    [document(), "a"],
    [document({ status: "completed", dograh: { workflowRunId: 12 } }), "b"],
    [document({ status: "completed", dograh: { workflowRunId: 12, transcript: [], transcriptStatus: "empty" } }), "b"],
    [document({ status: "completed", dograh: { workflowRunId: 40, transcriptStatus: "error" } }), "b"],
    [completed(), null], // has transcript turns
    [completed({ review, reviewStatus: "completed" }), null],
    [document({ status: "completed", dograh: { workflowRunId: 12 }, review }), null],
    [document({ status: "ready", dograh: { workflowRunId: 3 } }), null],
    [document({ status: "failed" }), null],
    [document({ status: "connecting" }), null],
    [document({ status: "active", dograh: { workflowRunId: 9 } }), null],
    [documentV2(), null],
    [documentV2({ status: "completed", dograh: { workflowRunId: 31 } }), null],
    [null, null],
  ]) assert.equal(legacyCleanupGroup(data), expected, JSON.stringify(data)?.slice(0, 100));
});
