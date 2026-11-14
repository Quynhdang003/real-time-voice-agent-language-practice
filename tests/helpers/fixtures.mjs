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

// Review v2 (RV-01) for a session with setupV2: every target word and weak point judged once, every quote from
// a learner turn of transcriptV2.
const bi = (en, vi) => ({ en, vi });
export const transcriptV2 = [
  { role: "tutor", text: "Welcome! Let's start the interview. Are you ready?", at: "00:00" },
  { role: "learner", text: "Hello, I am ready for the interview.", at: "00:03" },
  { role: "tutor", text: "Great. What is your biggest strength?", at: "00:06" },
  { role: "learner", text: "My biggest strength is teamwork, I always help my team to meet the deadline.", at: "00:09" },
  { role: "tutor", text: "Tell me about a project you led.", at: "00:15" },
  { role: "learner", text: "Last year I lead a project and I take ownership of the release.", at: "00:18" },
  { role: "learner", text: "My weakness is that I sometimes talk too fast.", at: "00:25" },
  { role: "learner", text: "My career goal is to become a senior developer.", at: "00:31" },
];
const used = (word, evidence) => ({ word, status: "used_correctly", evidence, correction: null, explanation: null });
const unused = (word) => ({ word, status: "not_used", evidence: null, correction: null, explanation: null });
const skill = (score, evidence) => ({ score, evidence, comment: bi("Clear answers at this level.", "Câu trả lời rõ ràng ở trình độ này.") });
export const reviewV2 = {
  schemaVersion: 2,
  overallFeedback: bi("You answered every question and used most target words.", "Bạn đã trả lời mọi câu hỏi và dùng phần lớn từ mục tiêu."),
  sessionGoals: {
    targetVocabulary: [
      used("deadline", "help my team to meet the deadline"),
      used("teamwork", "My biggest strength is teamwork"),
      { word: "take ownership", status: "used_incorrectly", evidence: "I take ownership of the release",
        correction: bi("I took ownership of the release.", "Tôi đã chịu trách nhiệm cho bản phát hành."),
        explanation: bi("Use the past simple for last year.", "Dùng thì quá khứ đơn cho năm ngoái.") },
      unused("feedback"),
      used("strength", "My biggest strength is teamwork"),
      used("weakness", "My weakness is that I sometimes talk too fast"),
      used("career goal", "My career goal is to become a senior developer"),
      unused("salary"),
    ],
    reviewVocabulary: [],
    grammarFocus: null,
    weakPoints: [{ point: "Past simple", status: "still_present", evidence: "Last year I lead a project" }],
    scenarioCompleted: { completed: true, comment: bi("You finished the interview.", "Bạn đã hoàn thành buổi phỏng vấn."),
      evidence: "I am ready for the interview" },
  },
  speakingSkills: {
    grammarAccuracy: skill(2, ["Last year I lead a project"]),
    lexicalRange: skill(3, ["My biggest strength is teamwork"]),
    fluencyCoherence: skill(3, ["I always help my team to meet the deadline", "My career goal is to become a senior developer"]),
    interaction: skill(4, ["Hello, I am ready for the interview."]),
  },
  grammarErrors: [{ original: "Last year I lead a project",
    corrected: bi("Last year I led a project.", "Năm ngoái tôi đã dẫn dắt một dự án."),
    explanation: bi("\"Lead\" becomes \"led\" in the past.", "\"Lead\" thành \"led\" ở quá khứ.") }],
  nextWeakPoints: [bi("Past simple of irregular verbs (lead → led)", "Quá khứ đơn của động từ bất quy tắc (lead → led)")],
};
export const expectationsV2 = {
  targetVocabulary: setupV2.targetVocabulary, reviewVocabulary: setupV2.reviewVocabulary,
  grammarFocus: setupV2.grammarFocus, weakPoints: setupV2.weakPoints,
  learnerTurns: transcriptV2.filter((turn) => turn.role === "learner").map((turn) => turn.text),
};
