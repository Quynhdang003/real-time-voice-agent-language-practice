// Review v2 (RV-01): bilingual judgments of the session goals and 1–5 speaking-skill scores, each backed
// by the learner's own words. Pure module shared by the server (Gemini output) and the review page.
// Keep React and Firebase SDKs out; it is also loaded by the --experimental-strip-types tests.
import { isOneOf, isRecord, textKey } from "./guards.ts";
import { setupLimits } from "./session-setup.ts";

export type Bilingual = { en: string; vi: string };
export const vocabularyStatuses = ["used_correctly", "used_incorrectly", "not_used"] as const;
export const weakPointStatuses = ["improved", "still_present", "not_observed"] as const;
export const speakingSkillKeys = ["grammarAccuracy", "lexicalRange", "fluencyCoherence", "interaction"] as const;
export const skillScores = [1, 2, 3, 4, 5] as const;
export type VocabularyStatus = (typeof vocabularyStatuses)[number];
export type WeakPointStatus = (typeof weakPointStatuses)[number];
export type SpeakingSkillKey = (typeof speakingSkillKeys)[number];
export type SkillScore = (typeof skillScores)[number];

export type VocabularyJudgment = {
  word: string; status: VocabularyStatus; evidence: string | null;
  correction: Bilingual | null; explanation: Bilingual | null;
};
export type GrammarFocusExample = { original: string; corrected: Bilingual | null; explanation: Bilingual | null };
export type GrammarFocusResult = { correctCount: number; incorrectCount: number; examples: GrammarFocusExample[] };
export type WeakPointJudgment = { point: string; status: WeakPointStatus; evidence: string | null };
export type ScenarioResult = { completed: boolean; comment: Bilingual; evidence: string | null };
export type SkillAssessment = { score: SkillScore; evidence: string[]; comment: Bilingual };
export type GrammarError = { original: string; corrected: Bilingual; explanation: Bilingual };
export type SessionReviewV2 = {
  schemaVersion: 2;
  overallFeedback: Bilingual;
  sessionGoals: {
    targetVocabulary: VocabularyJudgment[];
    reviewVocabulary: VocabularyJudgment[];
    grammarFocus: GrammarFocusResult | null;
    weakPoints: WeakPointJudgment[];
    scenarioCompleted: ScenarioResult;
  };
  speakingSkills: Record<SpeakingSkillKey, SkillAssessment>;
  grammarErrors: GrammarError[];
  nextWeakPoints: Bilingual[];
};

export const reviewLimits = {
  text: 300,
  overallFeedback: 1200,
  nextWeakPoint: 120,
  grammarFocusExamples: 6,
  grammarErrors: 10,
  nextWeakPoints: 3,
  skillEvidence: 3,
  count: 1000,
} as const;

// What a generated review must match: the session's goals and the learner's turns.
export type ReviewExpectations = {
  targetVocabulary: readonly string[];
  reviewVocabulary: readonly string[];
  grammarFocus: string | null;
  weakPoints: readonly string[];
  learnerTurns: readonly string[];
};

// Quotes are compared case-insensitively, ignoring whitespace and punctuation, on whole words, so a
// speech-recognition comma or a curly apostrophe does not reject a real quote.
export function quoteKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en")
    .replace(/['‘’`]/g, "")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// True when the quote appears in a single learner turn.
export function isLearnerQuote(quote: string, learnerTurns: readonly string[]): boolean {
  const key = quoteKey(quote);
  return key.length > 0 && learnerTurns.some((turn) => ` ${quoteKey(turn)} `.includes(` ${key} `));
}

class InvalidReview extends Error {}
function fail(): never {
  throw new InvalidReview();
}

function text(value: unknown, max: number = reviewLimits.text): string {
  if (typeof value !== "string") fail();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) fail();
  return trimmed;
}
function nullableText(value: unknown, max: number = reviewLimits.text): string | null {
  return value === null ? null : text(value, max);
}
function bilingual(value: unknown, max: number = reviewLimits.text): Bilingual {
  if (!isRecord(value)) fail();
  return { en: text(value.en, max), vi: text(value.vi, max) };
}
function nullableBilingual(value: unknown): Bilingual | null {
  return value === null ? null : bilingual(value);
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) fail();
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > reviewLimits.count) fail();
  return value;
}
function oneOf<const T extends readonly unknown[]>(value: unknown, options: T): T[number] {
  if (!isOneOf(value, options)) fail();
  return value;
}

function vocabulary(value: unknown, max: number): VocabularyJudgment[] {
  return list(value, max).map((item) => {
    if (!isRecord(item)) fail();
    const judgment: VocabularyJudgment = {
      word: text(item.word, setupLimits.vocabularyItem.max),
      status: oneOf(item.status, vocabularyStatuses),
      evidence: nullableText(item.evidence),
      correction: nullableBilingual(item.correction),
      explanation: nullableBilingual(item.explanation),
    };
    // A used word quotes the learner; a misused word is corrected; an unused word has neither.
    if (judgment.status === "not_used" ? judgment.evidence !== null || judgment.correction !== null
      : judgment.evidence === null) fail();
    if (judgment.status === "used_incorrectly" && judgment.correction === null) fail();
    return judgment;
  });
}

function grammarFocus(value: unknown): GrammarFocusResult | null {
  if (value === null) return null;
  if (!isRecord(value)) fail();
  const result: GrammarFocusResult = {
    correctCount: count(value.correctCount),
    incorrectCount: count(value.incorrectCount),
    examples: list(value.examples, reviewLimits.grammarFocusExamples).map((item) => {
      if (!isRecord(item)) fail();
      return { original: text(item.original), corrected: nullableBilingual(item.corrected),
        explanation: nullableBilingual(item.explanation) };
    }),
  };
  // An example with a correction is an incorrect use; the examples cannot outnumber the counts.
  const incorrect = result.examples.filter((example) => example.corrected !== null).length;
  if (incorrect > result.incorrectCount || result.examples.length - incorrect > result.correctCount) fail();
  return result;
}

function weakPoints(value: unknown): WeakPointJudgment[] {
  return list(value, setupLimits.weakPoints.max).map((item) => {
    if (!isRecord(item)) fail();
    const judgment: WeakPointJudgment = {
      point: text(item.point, setupLimits.weakPoints.itemMax),
      status: oneOf(item.status, weakPointStatuses),
      evidence: nullableText(item.evidence),
    };
    if ((judgment.status === "not_observed") !== (judgment.evidence === null)) fail();
    return judgment;
  });
}

function skill(value: unknown): SkillAssessment {
  if (!isRecord(value)) fail();
  const evidence = list(value.evidence, reviewLimits.skillEvidence).map((quote) => text(quote));
  if (evidence.length === 0) fail();
  return { score: oneOf(value.score, skillScores), evidence, comment: bilingual(value.comment) };
}

function parseStructure(value: unknown): SessionReviewV2 {
  if (!isRecord(value) || value.schemaVersion !== 2) fail();
  const goals = value.sessionGoals;
  const skills = value.speakingSkills;
  if (!isRecord(goals) || !isRecord(skills) || !isRecord(goals.scenarioCompleted)) fail();
  const scenario = goals.scenarioCompleted;
  if (typeof scenario.completed !== "boolean") fail();
  return {
    schemaVersion: 2,
    overallFeedback: bilingual(value.overallFeedback, reviewLimits.overallFeedback),
    sessionGoals: {
      targetVocabulary: vocabulary(goals.targetVocabulary, setupLimits.targetVocabulary.max),
      reviewVocabulary: vocabulary(goals.reviewVocabulary, setupLimits.reviewVocabulary.max),
      grammarFocus: grammarFocus(goals.grammarFocus),
      weakPoints: weakPoints(goals.weakPoints),
      scenarioCompleted: { completed: scenario.completed, comment: bilingual(scenario.comment),
        evidence: nullableText(scenario.evidence) },
    },
    speakingSkills: {
      grammarAccuracy: skill(skills.grammarAccuracy),
      lexicalRange: skill(skills.lexicalRange),
      fluencyCoherence: skill(skills.fluencyCoherence),
      interaction: skill(skills.interaction),
    },
    grammarErrors: list(value.grammarErrors, reviewLimits.grammarErrors).map((item) => {
      if (!isRecord(item)) fail();
      return { original: text(item.original), corrected: bilingual(item.corrected), explanation: bilingual(item.explanation) };
    }),
    nextWeakPoints: list(value.nextWeakPoints, reviewLimits.nextWeakPoints)
      .map((item) => bilingual(item, reviewLimits.nextWeakPoint)),
  };
}

// Each expected item must be judged exactly once (case-insensitive), and nothing else.
function judgesExactly(items: readonly string[], expected: readonly string[]): boolean {
  const keys = items.map(textKey);
  const wanted = new Set(expected.map(textKey));
  return keys.length === wanted.size && new Set(keys).size === keys.length && keys.every((key) => wanted.has(key));
}

function checkExpectations(review: SessionReviewV2, expected: ReviewExpectations): void {
  const goals = review.sessionGoals;
  if (!judgesExactly(goals.targetVocabulary.map((item) => item.word), expected.targetVocabulary) ||
    !judgesExactly(goals.reviewVocabulary.map((item) => item.word), expected.reviewVocabulary) ||
    !judgesExactly(goals.weakPoints.map((item) => item.point), expected.weakPoints) ||
    (goals.grammarFocus === null) !== (expected.grammarFocus === null)) fail();

  // Every quote must be the learner's own words; tutor turns never count as evidence.
  const quotes = [
    ...goals.targetVocabulary.map((item) => item.evidence),
    ...goals.reviewVocabulary.map((item) => item.evidence),
    ...goals.weakPoints.map((item) => item.evidence),
    ...(goals.grammarFocus?.examples.map((item) => item.original) ?? []),
    goals.scenarioCompleted.evidence,
    ...speakingSkillKeys.flatMap((key) => review.speakingSkills[key].evidence),
    ...review.grammarErrors.map((item) => item.original),
  ];
  for (const quote of quotes) if (quote !== null && !isLearnerQuote(quote, expected.learnerTurns)) fail();
}

// Without expectations: the stored-review check (shape and limits). With them: the full validator used
// before a generated review is stored; any failure means invalid_output, which can be retried.
export function parseSessionReviewV2(value: unknown, expected?: ReviewExpectations): SessionReviewV2 | null {
  try {
    const review = parseStructure(value);
    if (expected) checkExpectations(review, expected);
    return review;
  } catch (error) {
    if (error instanceof InvalidReview) return null;
    throw error;
  }
}

// The level the top score is anchored to (5 = the skill already meets the next CEFR level).
const nextLevels: Record<string, string> = { Beginner: "A1", A1: "A2", A2: "B1", B1: "B2", B2: "C1", C1: "C2" };
export function nextCefrLevel(level: string): string | null {
  return nextLevels[level] ?? null;
}
