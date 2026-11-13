import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { documentV2, document, setupV2 } from "./helpers/fixtures.mjs";
const { buildDograhContext, dograhContextKeys, dograhContextLimits, dograhContextBytes } = loadTs("lib/practice/dograh-context.ts");
const { parsePracticeSession, createPracticeSessionDocumentV2 } = loadTs("lib/practice/session.ts");

// Mirrors the Dograh 1.50.0 sanitizer rules for variable names.
const DOGRAH_NAME = /^[^.\s|{}]+$/;

test("v2 context carries session_id first, every key as a string, lists joined and empties as none", () => {
  const session = parsePracticeSession("session-a", documentV2());
  const context = buildDograhContext(session, "Account Name");
  assert.deepEqual(Object.keys(context), [...dograhContextKeys]);
  assert.equal(Object.keys(context)[0], "session_id");
  assert.equal(context.session_id, "session-a");
  assert.ok(Object.values(context).every((value) => typeof value === "string" && value.length > 0));
  assert.equal(context.learner_name, "Quynh");
  assert.equal(context.accent, "british");
  assert.equal(context.level, "B1");
  assert.equal(context.topic, "Job interview");
  assert.equal(context.target_vocabulary, setupV2.targetVocabulary.join("; "));
  assert.equal(context.review_vocabulary, "none");
  assert.equal(context.grammar_focus, "none");
  assert.equal(context.weak_points, "Past simple");
  assert.equal(context.duration_minutes, "15");
  assert.equal(context.tutor_name, "Emma");
  assert.equal(context.language, "English");
});

test("legacy v1 sessions get the learner's default profile and none for missing setup", () => {
  const context = buildDograhContext(parsePracticeSession("session-b", document()), " Learner  Name ");
  assert.equal(context.session_id, "session-b");
  assert.equal(context.learner_name, "Learner Name");
  assert.equal(context.accent, "american");
  assert.equal(context.scenario, "none");
  assert.equal(context.target_vocabulary, "none");
  assert.equal(context.session_mode, "free_talk");
  assert.equal(context.duration_minutes, "5");
});

test("the largest allowed ASCII setup fits Dograh's variable limits", () => {
  const item = (index) => `${String(index).padStart(2, "0")}${"x".repeat(38)}`;
  const largest = createPracticeSessionDocumentV2(
    { learnerName: "n".repeat(40), nativeLanguage: "Vietnamese", level: "C2", accent: "american", speechPace: "normal",
      correctionStyle: "end_of_session", vietnameseAllowed: "only_when_stuck" },
    { topic: "t".repeat(80), scenario: "s".repeat(500), sessionMode: "q_and_a",
      targetVocabulary: Array.from({ length: 12 }, (_, i) => item(i)),
      reviewVocabulary: Array.from({ length: 5 }, (_, i) => item(i + 20)),
      grammarFocus: "g".repeat(100), weakPoints: Array.from({ length: 5 }, (_, i) => `${i}${"w".repeat(119)}`),
      durationMinutes: 20, tutorId: "emma" });
  const context = buildDograhContext(parsePracticeSession("a".repeat(128), { ...largest, userId: "user-a" }), "x");
  const { maxVariables, maxKeyLength, maxValueLength, maxTotalBytes } = dograhContextLimits;
  assert.ok(Object.keys(context).length <= maxVariables);
  for (const [key, value] of Object.entries(context)) {
    assert.ok(DOGRAH_NAME.test(key) && key.length <= maxKeyLength, key);
    assert.ok(value.length <= maxValueLength, key);
  }
  assert.ok(dograhContextBytes(context) <= maxTotalBytes, `size ${dograhContextBytes(context)}`);
});

test("context size counts non-ASCII text the way Python json.dumps does", () => {
  assert.equal(dograhContextBytes({ a: "b" }), 1 + 3);
  assert.equal(dograhContextBytes({ a: "ỳ" }), 1 + 8);
});
