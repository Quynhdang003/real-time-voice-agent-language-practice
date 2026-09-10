// Shared domain configuration. Keep React, icons and Firebase SDKs out of this module.
export const practiceLanguages = {
  english: { id: "english", name: "English" },
  japanese: { id: "japanese", name: "Japanese" },
  korean: { id: "korean", name: "Korean" },
  chinese: { id: "chinese", name: "Chinese" },
  french: { id: "french", name: "French" },
  spanish: { id: "spanish", name: "Spanish" },
} as const;

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

export const practiceLevels = ["Beginner", "A1", "A2", "B1", "B2"] as const;
export const practiceDurations = [5, 10, 15] as const;
export const callStatuses = ["ready", "connecting", "active", "completed", "failed"] as const;
export const callEndReasons = ["user_ended", "mic_denied", "network_error", "dropped"] as const;

export type DograhCall = {
  workflowRunId: number;
  agentId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  endReason?: (typeof callEndReasons)[number];
};

export type LanguageId = keyof typeof practiceLanguages;
export type TopicId = keyof typeof practiceTopics;
export type TutorId = keyof typeof practiceTutors;
export type PracticeLevel = (typeof practiceLevels)[number];
export type PracticeDuration = (typeof practiceDurations)[number];
export type PracticeLanguage = { id: LanguageId; name: string };
export type PracticeTopic = { id: TopicId; name: string };
export type PracticeTutor = { id: TutorId; name: string; role: string };

export type PracticeSetupInput = {
  languageId: LanguageId;
  topicId: TopicId;
  level: PracticeLevel;
  durationMinutes: PracticeDuration;
  tutorId: TutorId;
};

// Serializable, allowlisted page data, not a raw Firestore document.
export type PracticeSession = {
  id: string;
  language: PracticeLanguage;
  topic: PracticeTopic;
  level: PracticeLevel;
  durationMinutes: PracticeDuration;
  tutor: PracticeTutor;
  status: (typeof callStatuses)[number];
  dograh?: DograhCall;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isKeyOf<T extends object>(value: unknown, target: T): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(target, value);
}

function isOneOf<const T extends readonly unknown[]>(value: unknown, options: T): value is T[number] {
  return options.some((option) => option === value);
}

export function isLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}

export function isRunId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isCallDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z");
}

export function parseDograhCall(value: unknown): DograhCall | null {
  if (!isRecord(value) || !isRunId(value.workflowRunId)) return null;
  const result: DograhCall = { workflowRunId: value.workflowRunId };
  if ("agentId" in value) {
    if (!isLabel(value.agentId)) return null;
    result.agentId = value.agentId;
  }
  for (const field of ["startedAt", "endedAt"] as const) {
    if (field in value) {
      if (!isIsoTimestamp(value[field])) return null;
      result[field] = value[field];
    }
  }
  if ("durationSeconds" in value) {
    if (!isCallDuration(value.durationSeconds)) return null;
    result.durationSeconds = value.durationSeconds;
  }
  if ("endReason" in value) {
    if (!isOneOf(value.endReason, callEndReasons)) return null;
    result.endReason = value.endReason;
  }
  return result;
}

export function parsePracticeSetup(value: unknown): PracticeSetupInput | null {
  if (!isRecord(value)) return null;
  const { languageId, topicId, level, durationMinutes, tutorId } = value;
  if (
    !isKeyOf(languageId, practiceLanguages) || !isKeyOf(topicId, practiceTopics) ||
    !isOneOf(level, practiceLevels) || !isOneOf(durationMinutes, practiceDurations) ||
    !isKeyOf(tutorId, practiceTutors)
  ) return null;
  return { languageId, topicId, level, durationMinutes, tutorId };
}

export function createPracticeSessionDetails(setup: PracticeSetupInput): Omit<PracticeSession, "id"> {
  const { id, name, role } = practiceTutors[setup.tutorId];
  return {
    language: { ...practiceLanguages[setup.languageId] },
    topic: { ...practiceTopics[setup.topicId] },
    level: setup.level,
    durationMinutes: setup.durationMinutes,
    tutor: { id, name, role },
    status: "ready",
  };
}

// Supports existing Firestore auto IDs and URL-safe legacy IDs, never document paths.
export function isPracticeSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function parsePracticeSession(id: string, value: unknown): PracticeSession | null {
  if (!isPracticeSessionId(id) || !isRecord(value)) return null;
  const { language, topic, tutor, status, userId } = value;
  if (
    !isRecord(language) || !isRecord(topic) || !isRecord(tutor) ||
    !isLabel(language.name) || !isLabel(topic.name) ||
    !isLabel(tutor.name) || !isLabel(tutor.role) ||
    typeof userId !== "string" || !userId.trim() || !isOneOf(status, callStatuses)
  ) return null;
  const setup = parsePracticeSetup({
    languageId: language.id, topicId: topic.id, tutorId: tutor.id,
    level: value.level, durationMinutes: value.durationMinutes,
  });
  if (!setup) return null;

  const dograh = "dograh" in value ? parseDograhCall(value.dograh) : undefined;
  if (dograh === null) return null;
  // Preserve stored names/roles for old sessions; omit ownership, timestamps and retired fields.
  return {
    id,
    language: { id: setup.languageId, name: language.name },
    topic: { id: setup.topicId, name: topic.name },
    tutor: { id: setup.tutorId, name: tutor.name, role: tutor.role },
    level: setup.level,
    durationMinutes: setup.durationMinutes,
    status,
    ...(dograh ? { dograh } : {}),
  };
}

export function practiceSessionHref(sessionId: string): string {
  return `/voice-call?sessionId=${encodeURIComponent(sessionId)}`;
}
