import { loadTs } from "./load-ts.mjs";
const { createPracticeSessionDetails } = loadTs("lib/practice/session.ts");
export const setup = { languageId: "english", topicId: "travel", level: "A2", durationMinutes: 5, tutorId: "emma" };
export function document(extra = {}) {
  return { ...createPracticeSessionDetails(setup), userId: "user-a", ...extra };
}
export function completed(extra = {}) {
  return document({ status: "completed", dograh: { workflowRunId: 31 }, ...extra });
}
