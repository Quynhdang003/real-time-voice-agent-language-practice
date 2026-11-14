import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { completed, documentV2, expectationsV2, review, reviewV2, transcriptV2 } from "./helpers/fixtures.mjs";

const { isLearnerQuote, nextCefrLevel, parseSessionReviewV2, quoteKey } = loadTs("lib/practice/review-v2.ts");
const { parsePracticeSession } = loadTs("lib/practice/session.ts");
const valid = (value, expected = expectationsV2) => parseSessionReviewV2(value, expected) !== null;
// Deep copy with one change applied.
const edit = (change) => { const copy = structuredClone(reviewV2); change(copy); return copy; };

test("a complete v2 review passes the full validator and keeps its content", () => {
  assert.deepEqual(parseSessionReviewV2(reviewV2, expectationsV2), reviewV2);
  assert.deepEqual(parseSessionReviewV2(reviewV2), reviewV2, "the stored-review check needs no expectations");
});

test("quotes match one learner turn, ignoring case, whitespace, punctuation and apostrophes, on whole words", () => {
  const turns = ["I don't like   the deadline, honestly!", "My teamwork is good."];
  for (const quote of ["i dont like the deadline", "I don’t like the DEADLINE", "deadline honestly", "teamwork is good"]) {
    assert.ok(isLearnerQuote(quote, turns), quote);
  }
  for (const quote of ["dead", "deadline honestly my teamwork", "I like the deadline", "", "?!", "good team"]) {
    assert.equal(isLearnerQuote(quote, turns), false, quote);
  }
  assert.equal(quoteKey("  Hello,  WORLD! "), "hello world");
});

test("fabricated evidence is rejected wherever it appears (tutor words, invented or merged turns)", () => {
  for (const change of [
    (r) => { r.sessionGoals.targetVocabulary[0].evidence = "We need to meet the deadline tomorrow"; },
    (r) => { r.sessionGoals.targetVocabulary[1].evidence = "What is your biggest strength"; },
    (r) => { r.sessionGoals.weakPoints[0].evidence = "Last year I lead a project and I take ownership of the release. My weakness"; },
    (r) => { r.sessionGoals.scenarioCompleted.evidence = "I accepted the job offer"; },
    (r) => { r.speakingSkills.interaction.evidence = ["Tell me about a project you led"]; },
    (r) => { r.grammarErrors[0].original = "I goed to the office"; },
  ]) assert.equal(valid(edit(change)), false);
});

test("every target word, review word and weak point is judged exactly once (case-insensitive)", () => {
  assert.ok(valid(edit((r) => { r.sessionGoals.targetVocabulary[0].word = "DEADLINE"; })));
  for (const change of [
    (r) => { r.sessionGoals.targetVocabulary.pop(); },
    (r) => { r.sessionGoals.targetVocabulary.push({ word: "budget", status: "not_used", evidence: null, correction: null, explanation: null }); },
    (r) => { r.sessionGoals.targetVocabulary[7] = { ...r.sessionGoals.targetVocabulary[3], word: "Feedback" }; },
    (r) => { r.sessionGoals.weakPoints = []; },
    (r) => { r.sessionGoals.reviewVocabulary = [{ word: "salary", status: "not_used", evidence: null, correction: null, explanation: null }]; },
  ]) assert.equal(valid(edit(change)), false);
  const withReview = { ...expectationsV2, reviewVocabulary: ["budget", "deadline extension", "overtime"] };
  assert.equal(valid(reviewV2, withReview), false, "review words that were never judged");
});

test("status rules: used words quote, misused words are corrected, unused words and unobserved points have nothing", () => {
  for (const change of [
    (r) => { r.sessionGoals.targetVocabulary[0].evidence = null; },
    (r) => { r.sessionGoals.targetVocabulary[2].correction = null; },
    (r) => { r.sessionGoals.targetVocabulary[3].evidence = "My biggest strength is teamwork"; },
    (r) => { r.sessionGoals.targetVocabulary[3].correction = { en: "x", vi: "y" }; },
    (r) => { r.sessionGoals.targetVocabulary[0].status = "maybe"; },
    (r) => { r.sessionGoals.weakPoints[0].evidence = null; },
    (r) => { r.sessionGoals.weakPoints[0] = { point: "Past simple", status: "not_observed", evidence: "Last year I lead a project" }; },
  ]) assert.equal(valid(edit(change)), false);
  assert.ok(valid(edit((r) => { r.sessionGoals.weakPoints[0] = { point: "Past simple", status: "not_observed", evidence: null }; })));
});

test("grammar focus is null exactly when the session has none; examples fit the counts", () => {
  const focus = { correctCount: 1, incorrectCount: 1, examples: [
    { original: "I always help my team", corrected: null, explanation: null },
    { original: "Last year I lead a project", corrected: { en: "Last year I led a project.", vi: "Năm ngoái tôi đã dẫn dắt một dự án." },
      explanation: null },
  ] };
  const withFocus = { ...expectationsV2, grammarFocus: "Past simple" };
  assert.ok(valid(edit((r) => { r.sessionGoals.grammarFocus = focus; }), withFocus));
  assert.equal(valid(reviewV2, withFocus), false, "a session focus that was not judged");
  assert.equal(valid(edit((r) => { r.sessionGoals.grammarFocus = focus; })), false, "a focus the session never had");
  assert.equal(valid(edit((r) => { r.sessionGoals.grammarFocus = { ...focus, incorrectCount: 0 }; }), withFocus), false);
  assert.equal(valid(edit((r) => { r.sessionGoals.grammarFocus = { ...focus, correctCount: 1.5 }; }), withFocus), false);
});

test("shape and limits: version, 1–5 integer scores, 1–3 quotes, bilingual text, lengths and counts", () => {
  for (const change of [
    (r) => { delete r.schemaVersion; },
    (r) => { r.speakingSkills.lexicalRange.score = 6; },
    (r) => { r.speakingSkills.lexicalRange.score = 2.5; },
    (r) => { r.speakingSkills.lexicalRange.score = "3"; },
    (r) => { r.speakingSkills.lexicalRange.evidence = []; },
    (r) => { r.speakingSkills.lexicalRange.evidence = Array(4).fill("My biggest strength is teamwork"); },
    (r) => { delete r.speakingSkills.interaction; },
    (r) => { r.overallFeedback = { en: "Good." }; },
    (r) => { r.overallFeedback.vi = "  "; },
    (r) => { r.overallFeedback.en = "x".repeat(1201); },
    (r) => { r.grammarErrors[0].explanation.en = "x".repeat(301); },
    (r) => { r.grammarErrors = Array(11).fill(r.grammarErrors[0]); },
    (r) => { r.nextWeakPoints = Array(4).fill(r.nextWeakPoints[0]); },
    (r) => { r.nextWeakPoints[0].en = "x".repeat(121); },
    (r) => { r.sessionGoals.scenarioCompleted.completed = "yes"; },
  ]) {
    assert.equal(valid(edit(change)), false);
    assert.equal(parseSessionReviewV2(edit(change)), null, "the stored-review check rejects it too");
  }
  assert.ok(valid(edit((r) => { r.overallFeedback.en = "x".repeat(1200); })));
});

test("stored sessions read both review versions; a corrupt v2 review makes the session invalid_data", () => {
  const v2 = parsePracticeSession("session-a", documentV2({ status: "completed", reviewStatus: "completed", review: reviewV2,
    dograh: { workflowRunId: 31, transcript: transcriptV2, transcriptStatus: "ready" } }));
  assert.deepEqual(v2.review, reviewV2);
  assert.deepEqual(parsePracticeSession("session-a", completed({ review, reviewStatus: "completed" })).review, review);
  assert.equal(parsePracticeSession("session-a", documentV2({ review: { ...reviewV2, nextWeakPoints: "x" } })), null);
  assert.equal(parsePracticeSession("session-a", documentV2({ review: { ...reviewV2, schemaVersion: 3 } })), null);
});

test("the top score is anchored to the next CEFR level; C2 has none", () => {
  assert.deepEqual(["Beginner", "A1", "A2", "B1", "B2", "C1", "C2"].map(nextCefrLevel), ["A1", "A2", "B1", "B2", "C1", "C2", null]);
});
