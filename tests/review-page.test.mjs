import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, documentV2, review, reviewV2, transcriptV2 } from "./helpers/fixtures.mjs";

const require = createRequire(import.meta.url);
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { parsePracticeSession } = loadTs("lib/practice/session.ts");
const { generateStepFor, reviewPageStateOf, reviewStateKey, skillLevelLabel } = loadTs("lib/practice/review-view.ts");
const { generatePracticeSessionReview } = loadTs("lib/practice/review-state.ts");
const refreshes = [];
const mocks = { "next/navigation": { useRouter: () => ({ refresh: () => refreshes.push(1) }) } };
const { ReviewPanel } = loadTs("components/fluent/review-panel.tsx", mocks);
const { ReviewV2View } = loadTs("components/fluent/review-v2-view.tsx");

// Session fixtures for every review state; all are completed calls.
const ended = (extra = {}) => parsePracticeSession("session-a", documentV2({ status: "completed",
  dograh: { workflowRunId: 31, transcript: transcriptV2, transcriptStatus: "ready" }, ...extra }));
const fixtures = {
  waiting_transcript: ended({ dograh: { workflowRunId: 31 } }),
  transcript_error: ended({ dograh: { workflowRunId: 31, transcriptStatus: "error", transcriptError: "redirect_rejected" } }),
  no_speech: ended({ dograh: { workflowRunId: 31, transcriptStatus: "empty", transcript: [] } }),
  no_learner: ended({ dograh: { workflowRunId: 31, transcriptStatus: "ready", transcript: [transcriptV2[0]] } }),
  generating: ended({ reviewStatus: "pending" }),
  processing: ended({ reviewStatus: "processing" }),
  failed: ended({ reviewStatus: "failed" }),
  done_v2: ended({ reviewStatus: "completed", review: reviewV2 }),
  done_v1: parsePracticeSession("session-a", completed({ reviewStatus: "completed", review })),
};
const render = (session) => renderToStaticMarkup(createElement(ReviewPanel, { session }));

test("each stored session maps to one page state", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(fixtures).map(([name, session]) => [name, reviewPageStateOf(session)])), {
    waiting_transcript: "waiting_transcript", transcript_error: "transcript_error", no_speech: "no_speech", no_learner: "no_speech",
    generating: "generating", processing: "generating", failed: "failed", done_v2: "done", done_v1: "done",
  });
});

test("each state renders its banner; only failures offer Try again (fixtures)", () => {
  for (const [name, title, role, button] of [
    ["waiting_transcript", "Waiting for the transcript", "status", null],
    ["generating", "Generating your review", "status", null],
    ["processing", "Generating your review", "status", null],
    ["failed", "The review could not be generated", "alert", "Try again"],
    ["transcript_error", "No transcript", "alert", null],
    ["no_speech", "Nothing to review", "status", null],
    ["no_learner", "Nothing to review", "status", null],
  ]) {
    const html = render(fixtures[name]);
    assert.match(html, new RegExp(title), name);
    assert.match(html, new RegExp(`role="${role}"`), name);
    assert.equal(html.includes("Try again"), button === "Try again", name);
    assert.doesNotMatch(html, /Overall feedback|Pronunciation/, name);
  }
  assert.match(render(fixtures.waiting_transcript), /Your transcript is on its way/);
  assert.match(render(fixtures.generating), /I am ready for the interview/, "the transcript is shown while the review is pending");
});

test("a v2 review renders the goals, the 1–5 skills with level labels and both languages; no pronunciation card", () => {
  const html = render(fixtures.done_v2);
  for (const text of ["Overall feedback", "Scenario completed", "Session goals", "Target vocabulary", "Used correctly",
    "Used incorrectly", "Not used", "Still present", "Speaking skills", "Grammar accuracy", "Lexical range",
    "Fluency &amp; coherence", "Interaction", "Below B1", "At B1", "Above B1", "Grammar errors", "Next time",
    "I took ownership of the release.", "lang=\"vi\"", "Năm ngoái tôi đã dẫn dắt một dự án.", "“Last year I lead a project”"]) {
    assert.ok(html.includes(text), text);
  }
  assert.doesNotMatch(html, /Pronunciation|Waiting for the transcript|Review vocabulary|Grammar focus/);
  const withFocus = structuredClone(reviewV2);
  withFocus.sessionGoals.grammarFocus = { correctCount: 2, incorrectCount: 1, examples: [] };
  withFocus.speakingSkills.interaction.score = 5;
  const focusHtml = renderToStaticMarkup(createElement(ReviewV2View, { review: withFocus, level: "B1" }));
  assert.match(focusHtml, /Grammar focus/);
  assert.match(focusHtml, /2 correct/);
  assert.match(focusHtml, /Meets B2/);
});

test("a v1 review keeps its earlier layout, without the pronunciation card", () => {
  const html = render(fixtures.done_v1);
  assert.match(html, /earlier format/);
  assert.match(html, /Score 80 out of 100/);
  assert.match(html, /I went yesterday/);
  assert.doesNotMatch(html, /Pronunciation|Session goals/);
});

test("skill labels anchor 1–5 to the session level; C2 tops out near-native", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((score) => skillLevelLabel(score, "A2")),
    ["Well below A2", "Below A2", "At A2", "Above A2", "Meets B1"]);
  assert.equal(skillLevelLabel(5, "C2"), "Top of C2 (near-native)");
});

test("the panel key changes with the stored transcript and review status (remount resets local state)", () => {
  const keys = new Set([fixtures.waiting_transcript, fixtures.generating, fixtures.failed, fixtures.done_v2].map(reviewStateKey));
  assert.equal(keys.size, 4);
  assert.equal(reviewStateKey(fixtures.generating), reviewStateKey(ended({ reviewStatus: "pending" })));
});

test("generate-review answers: busy means poll again, failures stop with a message (N-02b)", () => {
  assert.equal(generateStepFor({ ok: true }), "refresh");
  for (const reason of ["already_processing", "transcript_pending", "not_ready"]) assert.equal(generateStepFor({ ok: false, reason }), "retry_later");
  assert.equal(generateStepFor({ ok: false, reason: "transcript_empty" }), "no_speech");
  assert.equal(generateStepFor({ ok: false, reason: "transcript_error" }), "transcript_error");
  for (const reason of ["quota", "invalid_output", "unavailable", "not_found", undefined]) assert.equal(generateStepFor({ ok: false, reason }), "failed");
});

test("two tabs: the second tab polls while the first generates, then gets the saved review", async () => {
  let doc = documentV2({ status: "completed", reviewStatus: "pending",
    dograh: { workflowRunId: 31, transcript: transcriptV2, transcriptStatus: "ready" } });
  let release;
  const store = {
    transaction: async (_id, apply) => apply({ readDocument: async () => doc,
      markProcessing: async (claimedAt) => { doc = { ...doc, reviewStatus: "processing", reviewClaimedAt: claimedAt }; } }),
    generate: () => new Promise((resolve) => { release = resolve; }),
    writeCompleted: async (_id, value) => { doc = { ...doc, review: value, reviewStatus: "completed" }; return true; },
    writeFailed: async () => true,
    now: () => "2026-11-14T10:00:00.000Z",
    onError: (error) => { throw error; },
  };
  const tabA = generatePracticeSessionReview("session-a", "user-a", store);
  await new Promise((resolve) => setImmediate(resolve));
  const busy = await generatePracticeSessionReview("session-a", "user-a", store);
  assert.equal(generateStepFor({ ok: false, reason: busy.status }), "retry_later");
  release({ status: "ok", review: reviewV2 });
  assert.equal((await tabA).status, "ok");
  const next = await generatePracticeSessionReview("session-a", "user-a", store);
  assert.equal(generateStepFor({ ok: next.status === "ok" }), "refresh");
  assert.equal(reviewPageStateOf(parsePracticeSession("session-a", doc)), "done");
});
