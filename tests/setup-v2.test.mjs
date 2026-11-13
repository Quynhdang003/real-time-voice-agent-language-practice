import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
const profileModule = loadTs("lib/practice/profile.ts");
const setupModule = loadTs("lib/practice/session-setup.ts");

const profile = {
  learnerName: "  Quynh   Dang ", nativeLanguage: "Vietnamese", level: "B1", accent: "british",
  speechPace: "slow", correctionStyle: "end_of_session", vietnameseAllowed: "never",
};
const words = (count, prefix = "word") => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);
const setup = {
  topic: "Job interview", scenario: "You are a hiring manager interviewing me for a junior developer role.",
  sessionMode: "role_play", targetVocabulary: words(8), reviewVocabulary: [], grammarFocus: "",
  weakPoints: [], durationMinutes: 10, tutorId: "emma",
};
const errorsOf = (result) => (result.ok ? {} : result.fieldErrors);

test("learner profile normalizes the name and accepts every enum value", () => {
  const result = profileModule.validateLearnerProfile(profile);
  assert.equal(result.ok, true);
  assert.equal(result.value.learnerName, "Quynh Dang");
  for (const level of profileModule.cefrLevels) assert.ok(profileModule.validateLearnerProfile({ ...profile, level }).ok);
});

test("learner profile reports every invalid field by path", () => {
  const errors = errorsOf(profileModule.validateLearnerProfile({ learnerName: "x".repeat(41), level: "Beginner" }));
  for (const field of ["learnerName", "nativeLanguage", "level", "accent", "speechPace", "correctionStyle", "vietnameseAllowed"])
    assert.ok(errors[`profile.${field}`], field);
  assert.ok(errorsOf(profileModule.validateLearnerProfile({ ...profile, learnerName: "   " }))["profile.learnerName"]);
  assert.deepEqual(errorsOf(profileModule.validateLearnerProfile(null)), { profile: "Complete your learner profile." });
});

test("default profile uses the account name and leaves the level unset", () => {
  const draft = profileModule.defaultLearnerProfile(" Learner Name ");
  assert.deepEqual(draft, { learnerName: "Learner Name", nativeLanguage: "Vietnamese", level: null, accent: "american",
    speechPace: "normal", correctionStyle: "gentle_recast", vietnameseAllowed: "only_when_stuck" });
  assert.equal(profileModule.learnerProfileDraft({ ...profile, accent: "australian" }, "A").learnerName, "A");
  assert.equal(profileModule.learnerProfileDraft(profile, "A").accent, "british");
});

test("saving a profile validates first and writes only for the authenticated user", async () => {
  const writes = [];
  const store = { write: async (uid, value) => { writes.push([uid, value]); }, onError() {} };
  assert.equal((await profileModule.saveLearnerProfile(" ", profile, store)).status, "unauthenticated");
  const invalid = await profileModule.saveLearnerProfile("user-a", { ...profile, level: "Z9" }, store);
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.fieldErrors["profile.level"]);
  assert.equal(writes.length, 0);
  const saved = await profileModule.saveLearnerProfile("user-a", { ...profile, userId: "user-b", extra: true }, store);
  assert.equal(saved.status, "ok");
  assert.deepEqual(writes, [["user-a", saved.profile]]);
  assert.equal("userId" in saved.profile || "extra" in saved.profile, false);
  store.write = async () => { throw new Error("offline"); };
  assert.equal((await profileModule.saveLearnerProfile("user-a", profile, store)).status, "unavailable");
});

test("session setup normalizes text and stores empty optionals as null or []", () => {
  const result = setupModule.validateSessionSetup({ ...setup, topic: "  Job   interview ", grammarFocus: "   ",
    targetVocabulary: [...words(8), "   "], weakPoints: undefined });
  assert.equal(result.ok, true);
  assert.equal(result.value.topic, "Job interview");
  assert.equal(result.value.grammarFocus, null);
  assert.deepEqual(result.value.reviewVocabulary, []);
  assert.deepEqual(result.value.weakPoints, []);
  assert.equal(result.value.targetVocabulary.length, 8);
});

test("session setup enforces vocabulary counts, uniqueness, separator and overlap", () => {
  const field = (extra, name) => errorsOf(setupModule.validateSessionSetup({ ...setup, ...extra }))[`setup.${name}`];
  assert.ok(field({ targetVocabulary: words(7) }, "targetVocabulary"));
  assert.ok(field({ targetVocabulary: words(13) }, "targetVocabulary"));
  assert.equal(setupModule.validateSessionSetup({ ...setup, targetVocabulary: words(12) }).ok, true);
  assert.ok(field({ targetVocabulary: [...words(7), "Word 1"] }, "targetVocabulary"));
  assert.ok(field({ targetVocabulary: [...words(7), "a;b"] }, "targetVocabulary"));
  assert.ok(field({ targetVocabulary: [...words(7), "x".repeat(41)] }, "targetVocabulary"));
  assert.ok(field({ targetVocabulary: "word 1; word 2" }, "targetVocabulary"));
  assert.ok(field({ reviewVocabulary: words(2, "old") }, "reviewVocabulary"));
  assert.ok(field({ reviewVocabulary: words(6, "old") }, "reviewVocabulary"));
  assert.ok(field({ reviewVocabulary: ["old 1", "old 2", "WORD 1"] }, "reviewVocabulary"));
  assert.equal(setupModule.validateSessionSetup({ ...setup, reviewVocabulary: words(3, "old") }).ok, true);
});

test("session setup enforces text lengths, enums, durations and weak points", () => {
  const errors = errorsOf(setupModule.validateSessionSetup({ ...setup, topic: "ab", scenario: "short",
    sessionMode: "lecture", durationMinutes: 5, tutorId: "bob", grammarFocus: "g".repeat(101),
    weakPoints: [...words(5, "weak"), "weak 6"] }));
  for (const name of ["topic", "scenario", "sessionMode", "durationMinutes", "tutorId", "grammarFocus", "weakPoints"])
    assert.ok(errors[`setup.${name}`], name);
  for (const durationMinutes of [10, 15, 20]) assert.ok(setupModule.validateSessionSetup({ ...setup, durationMinutes }).ok);
  assert.ok(errorsOf(setupModule.validateSessionSetup({ ...setup, scenario: "s".repeat(501) }))["setup.scenario"]);
  assert.ok(errorsOf(setupModule.validateSessionSetup({ ...setup, grammarFocus: 3 }))["setup.grammarFocus"]);
  assert.equal(setupModule.validateSessionSetup({ ...setup, weakPoints: ["Past tense", "Articles"] }).ok, true);
});

test("v2 session documents round-trip through the parser; v1 documents stay readable", async () => {
  const { profileV2, setupV2, documentV2, document } = await import("./helpers/fixtures.mjs");
  const domain = loadTs("lib/practice/session.ts");
  const stored = documentV2();
  assert.equal(stored.schemaVersion, 2);
  assert.deepEqual(stored.language, { id: "english", name: "English" });
  assert.deepEqual(stored.topic, { id: "custom", name: "Job interview" });
  assert.equal(stored.level, "B1");
  assert.equal("level" in stored.profile, false);
  const session = domain.parsePracticeSession("session-a", stored);
  assert.equal(session.schemaVersion, 2);
  assert.equal(session.durationMinutes, 15);
  assert.equal(session.profile.accent, "british");
  assert.deepEqual(session.setup.targetVocabulary, setupV2.targetVocabulary);
  assert.equal(session.setup.grammarFocus, null);
  assert.equal("userId" in session, false);
  for (const corrupt of [documentV2({ level: "Beginner" }), documentV2({ durationMinutes: 5 }),
    documentV2({ setup: { ...stored.setup, targetVocabulary: ["one"] } }), documentV2({ schemaVersion: 3 }),
    documentV2({ topic: { id: "travel", name: "Travel" } }), documentV2({ profile: { ...profileV2, accent: "x" } })])
    assert.equal(domain.parsePracticeSession("session-a", corrupt), null);
  assert.equal(domain.parsePracticeSession("session-a", document()).schemaVersion, 1);
});

test("practice setup request merges profile and setup field errors", () => {
  const { profileV2, setupV2 } = { profileV2: profile, setupV2: setup };
  assert.ok(setupModule.validatePracticeSetupRequest({ profile: profileV2, setup: setupV2 }).ok);
  const errors = errorsOf(setupModule.validatePracticeSetupRequest({ profile: { ...profileV2, level: null },
    setup: { ...setupV2, targetVocabulary: [] } }));
  assert.ok(errors["profile.level"]);
  assert.ok(errors["setup.targetVocabulary"]);
  assert.ok(errorsOf(setupModule.validatePracticeSetupRequest(null)).request);
});
