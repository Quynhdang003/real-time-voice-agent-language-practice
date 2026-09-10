import { loadTs } from "./load-ts.mjs";
const { createPracticeSessionDetails } = loadTs("lib/practice/session.ts");
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
