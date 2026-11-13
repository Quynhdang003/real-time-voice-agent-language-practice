import { loadTs } from "./load-ts.mjs";
const { createPracticeSessionDetails, createPracticeSessionDocumentV2 } = loadTs("lib/practice/session.ts");
export const profileV2 = { learnerName: "Quynh", nativeLanguage: "Vietnamese", level: "B1", accent: "british",
  speechPace: "slow", correctionStyle: "gentle_recast", vietnameseAllowed: "only_when_stuck" };
export const setupV2 = { topic: "Job interview", scenario: "You are a hiring manager interviewing me for a junior developer role.",
  sessionMode: "role_play", targetVocabulary: ["deadline", "teamwork", "take ownership", "feedback", "strength",
    "weakness", "career goal", "salary"], reviewVocabulary: [], grammarFocus: null, weakPoints: ["Past simple"],
  durationMinutes: 15, tutorId: "emma" };
export function documentV2(extra = {}) {
  return { ...createPracticeSessionDocumentV2(profileV2, setupV2), userId: "user-a", ...extra };
}
export const setup = { languageId: "english", topicId: "travel", level: "A2", durationMinutes: 5, tutorId: "emma" };
export const review = { overallScore: 80, metrics: { fluency: 80, grammar: 75, vocabulary: 85 },
  strengths: ["Clear answers"], corrections: [{ original: "I go yesterday", corrected: "I went yesterday", explanation: "Use past tense." }],
  vocabulary: [{ word: "ticket", definition: "Permission to travel" }], tutorFeedback: "Keep practicing." };
export const transcript = [{ role: "learner", text: "I go yesterday", at: "00:01" }];
export function document(extra = {}) {
  return { ...createPracticeSessionDetails(setup), userId: "user-a", ...extra };
}
export function completed(extra = {}) {
  return document({ status: "completed", dograh: { workflowRunId: 31, transcript, transcriptStatus: "ready" }, ...extra });
}
