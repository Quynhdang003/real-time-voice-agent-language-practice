// Static practice catalog shared by every practice module. Re-exported by session.ts.
// Keep React, icons and Firebase SDKs out of this module.

export const practiceLanguages = {
  english: { id: "english", name: "English" },
  japanese: { id: "japanese", name: "Japanese" },
  korean: { id: "korean", name: "Korean" },
  chinese: { id: "chinese", name: "Chinese" },
  french: { id: "french", name: "French" },
  spanish: { id: "spanish", name: "Spanish" },
} as const;

// v1 catalog topics. v2 sessions store a free-text topic as { id: "custom", name }.
export const practiceTopics = {
  daily: { id: "daily", name: "Daily Conversation" },
  travel: { id: "travel", name: "Travel" },
  restaurant: { id: "restaurant", name: "Restaurant" },
  interview: { id: "interview", name: "Job Interview" },
  shopping: { id: "shopping", name: "Shopping" },
  "free-talk": { id: "free-talk", name: "Free Talk" },
} as const;

export const practiceTutors = {
  emma: {
    id: "emma",
    name: "Emma",
    role: "Language Tutor",
    description: "Friendly tutor focused on everyday conversations.",
    specialties: ["Everyday conversation", "Vocabulary"],
  },
} as const;

// v1 levels and durations; still readable for legacy sessions.
export const practiceLevels = ["Beginner", "A1", "A2", "B1", "B2"] as const;
export const practiceDurations = [5, 10, 15] as const;

export type LanguageId = keyof typeof practiceLanguages;
export type TopicId = keyof typeof practiceTopics;
export type TutorId = keyof typeof practiceTutors;
export type PracticeLevel = (typeof practiceLevels)[number];
export type PracticeDuration = (typeof practiceDurations)[number];
export type PracticeLanguage = { id: LanguageId; name: string };
export type PracticeTopic = { id: TopicId; name: string };
export type PracticeTutor = { id: TutorId; name: string; role: string };
