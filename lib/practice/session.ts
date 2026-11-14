// Shared domain configuration. Keep React, icons and Firebase SDKs out of this module.
import { isBoundedText, isKeyOf, isOneOf, isRecord } from "./guards.ts";
import { practiceDurations, practiceLanguages, practiceLevels, practiceTopics, practiceTutors } from "./catalog.ts";
import type {
  LanguageId, PracticeDuration, PracticeLanguage, PracticeLevel, PracticeTopic, PracticeTutor, TopicId, TutorId,
} from "./catalog.ts";

export { practiceDurations, practiceLanguages, practiceLevels, practiceTopics, practiceTutors } from "./catalog.ts";
export type {
  LanguageId, PracticeDuration, PracticeLanguage, PracticeLevel, PracticeTopic, PracticeTutor, TopicId, TutorId,
} from "./catalog.ts";
import { validateLearnerProfile } from "./profile.ts";
import type { CefrLevel, LearnerProfile, SessionProfile } from "./profile.ts";
import { validateSessionSetup } from "./session-setup.ts";
import type { SessionSetup, StoredSessionSetup } from "./session-setup.ts";
import { TRIAL_DURATION_MINUTES, sessionKinds } from "./access.ts";
import type { SessionKind } from "./access.ts";

export const callStatuses = ["ready", "connecting", "active", "completed", "failed"] as const;
export const callEndReasons = ["user_ended", "mic_denied", "network_error", "dropped"] as const;
export type DograhCall = {
  workflowRunId: number;
  agentId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  endReason?: (typeof callEndReasons)[number];
  transcriptUrl?: string;
  recordingUrl?: string;
  summary?: string;
  transcript?: TranscriptTurn[];
  transcriptStatus?: TranscriptStatus;
  // Why the download failed (TR-02); only with transcriptStatus "error". Never a URL.
  transcriptError?: TranscriptError;
};

export type PracticeSetupInput = {
  languageId: LanguageId;
  topicId: TopicId;
  level: PracticeLevel;
  durationMinutes: PracticeDuration;
  tutorId: TutorId;
};

export const transcriptStatuses = ["ready", "empty", "error"] as const;
export const transcriptErrors = [
  "untrusted_url", "redirect_rejected", "http_4xx", "http_5xx", "timeout", "too_large", "invalid_utf8", "network",
] as const;
export const reviewStatuses = ["pending", "processing", "completed", "failed"] as const;
export type TranscriptStatus = (typeof transcriptStatuses)[number];
export type TranscriptError = (typeof transcriptErrors)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];
export type TranscriptTurn = { role: "tutor" | "learner"; text: string; at: string };
export type ReviewCorrection = { original: string; corrected: string; explanation: string };
export type ReviewVocabularyItem = { word: string; definition: string };
export type SessionReview = {
  overallScore: number;
  metrics: { fluency: number; grammar: number; vocabulary: number };
  strengths: string[];
  corrections: ReviewCorrection[];
  vocabulary: ReviewVocabularyItem[];
  tutorFeedback: string;
};

export type CustomTopic = { id: "custom"; name: string };

// Serializable, allowlisted page data, not a raw Firestore document.
// v1 sessions use the catalog topic and legacy level/duration; v2 adds the profile snapshot and setup.
export type PracticeSession = {
  id: string;
  schemaVersion: 1 | 2;
  // v2 only: "trial" (1 minute, ACC-01) or "full"; v2 documents without it are full.
  kind?: SessionKind;
  language: PracticeLanguage;
  topic: PracticeTopic | CustomTopic;
  level: PracticeLevel | CefrLevel;
  durationMinutes: PracticeDuration | SessionSetup["durationMinutes"];
  tutor: PracticeTutor;
  status: (typeof callStatuses)[number];
  profile?: SessionProfile;
  setup?: StoredSessionSetup;
  dograh?: DograhCall;
  review?: SessionReview;
  reviewStatus?: ReviewStatus;
};

export { isRecord } from "./guards.ts";

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
export function isTranscriptTurn(value: unknown): value is TranscriptTurn {
  return isRecord(value) && (value.role === "tutor" || value.role === "learner") &&
    isBoundedText(value.text, 4000) && typeof value.at === "string" && value.at.length <= 64;
}

export function parseTranscript(value: unknown): TranscriptTurn[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const turns: TranscriptTurn[] = [];
  for (const item of value) {
    if (!isTranscriptTurn(item)) return null;
    turns.push({ role: item.role, text: item.text, at: item.at });
  }
  return turns;
}

function isScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function parseSessionReview(value: unknown): SessionReview | null {
  if (!isRecord(value) || !isScore(value.overallScore) || !isRecord(value.metrics)) return null;
  const { fluency, grammar, vocabulary: vocabScore } = value.metrics;
  if (!isScore(fluency) || !isScore(grammar) || !isScore(vocabScore)) return null;
  if (!Array.isArray(value.strengths) || value.strengths.length > 10 ||
    !value.strengths.every((item) => isBoundedText(item, 300))) return null;
  if (!Array.isArray(value.corrections) || value.corrections.length > 20) return null;
  const corrections: ReviewCorrection[] = [];
  for (const item of value.corrections) {
    if (!isRecord(item) || !isBoundedText(item.original, 500) ||
      !isBoundedText(item.corrected, 500) || !isBoundedText(item.explanation, 500)) return null;
    corrections.push({ original: item.original, corrected: item.corrected, explanation: item.explanation });
  }
  if (!Array.isArray(value.vocabulary) || value.vocabulary.length > 20) return null;
  const vocabulary: ReviewVocabularyItem[] = [];
  for (const item of value.vocabulary) {
    if (!isRecord(item) || !isBoundedText(item.word, 100) || !isBoundedText(item.definition, 300)) return null;
    vocabulary.push({ word: item.word, definition: item.definition });
  }
  if (!isBoundedText(value.tutorFeedback, 2000)) return null;
  return {
    overallScore: value.overallScore,
    metrics: { fluency, grammar, vocabulary: vocabScore },
    strengths: [...value.strengths] as string[],
    corrections, vocabulary, tutorFeedback: value.tutorFeedback,
  };
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
  for (const field of ["transcriptUrl", "recordingUrl"] as const) {
    if (field in value) {
      if (typeof value[field] !== "string" || (value[field] as string).length > 2000) return null;
      result[field] = value[field] as string;
    }
  }
  if ("summary" in value) {
    if (typeof value.summary !== "string" || value.summary.length > 4000) return null;
    result.summary = value.summary;
  }
  if ("transcript" in value) {
    const transcript = parseTranscript(value.transcript);
    if (transcript === null) return null;
    result.transcript = transcript;
  }
  if ("transcriptStatus" in value) {
    if (!isOneOf(value.transcriptStatus, transcriptStatuses)) return null;
    result.transcriptStatus = value.transcriptStatus;
  }
  if ("transcriptError" in value) {
    if (!isOneOf(value.transcriptError, transcriptErrors)) return null;
    result.transcriptError = value.transcriptError;
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

// New sessions are English only; every practiceLanguages entry stays readable for legacy sessions.
export const creatablePracticeLanguageIds = ["english"] as const satisfies readonly LanguageId[];

// v1 document (no schemaVersion). No route creates these any more; tests use it to build legacy fixtures.
export function createPracticeSessionDetails(setup: PracticeSetupInput): Omit<PracticeSession, "id" | "schemaVersion"> {
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

// v2 document fields (without userId and timestamps). Practice is always English.
// The kind comes from the account's access on the server (ACC-01); a trial always lasts 1 minute.
export function createPracticeSessionDocumentV2(profile: LearnerProfile, setup: SessionSetup, kind: SessionKind = "full") {
  const { id, name, role } = practiceTutors[setup.tutorId];
  const session: Omit<PracticeSession, "id"> & {
    schemaVersion: 2; kind: SessionKind; profile: SessionProfile; setup: StoredSessionSetup;
  } = {
    schemaVersion: 2,
    kind,
    language: { ...practiceLanguages[creatablePracticeLanguageIds[0]] },
    topic: { id: "custom", name: setup.topic },
    level: profile.level,
    durationMinutes: kind === "trial" ? TRIAL_DURATION_MINUTES : setup.durationMinutes,
    tutor: { id, name, role },
    status: "ready",
    profile: {
      learnerName: profile.learnerName, nativeLanguage: profile.nativeLanguage, accent: profile.accent,
      speechPace: profile.speechPace, correctionStyle: profile.correctionStyle, vietnameseAllowed: profile.vietnameseAllowed,
    },
    setup: {
      scenario: setup.scenario, sessionMode: setup.sessionMode, targetVocabulary: setup.targetVocabulary,
      reviewVocabulary: setup.reviewVocabulary, grammarFocus: setup.grammarFocus, weakPoints: setup.weakPoints,
    },
  };
  return session;
}

type SessionDetails = Pick<PracticeSession,
  "schemaVersion" | "kind" | "language" | "topic" | "level" | "durationMinutes" | "tutor" | "profile" | "setup">;

// v1: catalog topic, legacy levels and durations. Stored names/roles are preserved for old sessions.
function parseSessionDetailsV1(value: Record<string, unknown>): SessionDetails | null {
  const { language, topic, tutor } = value;
  if (!isRecord(language) || !isRecord(topic) || !isRecord(tutor) || !isLabel(language.name) ||
    !isLabel(topic.name) || !isLabel(tutor.name) || !isLabel(tutor.role)) return null;
  const setup = parsePracticeSetup({
    languageId: language.id, topicId: topic.id, tutorId: tutor.id,
    level: value.level, durationMinutes: value.durationMinutes,
  });
  if (!setup) return null;
  return {
    schemaVersion: 1,
    language: { id: setup.languageId, name: language.name },
    topic: { id: setup.topicId, name: topic.name },
    tutor: { id: setup.tutorId, name: tutor.name, role: tutor.role },
    level: setup.level,
    durationMinutes: setup.durationMinutes,
  };
}

// v2: free-text topic, CEFR level, profile snapshot and setup, re-validated with the creation rules.
function parseSessionDetailsV2(value: Record<string, unknown>): SessionDetails | null {
  const { language, topic, tutor, profile, setup } = value;
  if (!isRecord(language) || !isKeyOf(language.id, practiceLanguages) || !isLabel(language.name) ||
    !isRecord(topic) || topic.id !== "custom" || !isRecord(tutor) || !isLabel(tutor.name) ||
    !isLabel(tutor.role) || !isRecord(profile) || !isRecord(setup)) return null;
  // Sessions created before ACC-01 have no kind and are full. A trial must last exactly 1 minute.
  const kind = value.kind === undefined ? "full" : value.kind;
  if (!isOneOf(kind, sessionKinds)) return null;
  if (kind === "trial" && value.durationMinutes !== TRIAL_DURATION_MINUTES) return null;
  const parsedProfile = validateLearnerProfile({ ...profile, level: value.level });
  const parsedSetup = validateSessionSetup({
    ...setup, topic: topic.name, durationMinutes: value.durationMinutes, tutorId: tutor.id,
  }, "setup", { kind });
  if (!parsedProfile.ok || !parsedSetup.ok) return null;
  const p = parsedProfile.value;
  const s = parsedSetup.value;
  return {
    schemaVersion: 2,
    kind,
    language: { id: language.id, name: language.name },
    topic: { id: "custom", name: s.topic },
    tutor: { id: s.tutorId, name: tutor.name, role: tutor.role },
    level: p.level,
    durationMinutes: s.durationMinutes,
    profile: {
      learnerName: p.learnerName, nativeLanguage: p.nativeLanguage, accent: p.accent,
      speechPace: p.speechPace, correctionStyle: p.correctionStyle, vietnameseAllowed: p.vietnameseAllowed,
    },
    setup: {
      scenario: s.scenario, sessionMode: s.sessionMode, targetVocabulary: s.targetVocabulary,
      reviewVocabulary: s.reviewVocabulary, grammarFocus: s.grammarFocus, weakPoints: s.weakPoints,
    },
  };
}

// Supports existing Firestore auto IDs and URL-safe legacy IDs, never document paths.
export function isPracticeSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function parsePracticeSession(id: string, value: unknown): PracticeSession | null {
  if (!isPracticeSessionId(id) || !isRecord(value)) return null;
  const { status, userId } = value;
  if (typeof userId !== "string" || !userId.trim() || !isOneOf(status, callStatuses)) return null;
  // Documents without schemaVersion are v1. Unknown versions are rejected rather than guessed.
  if ("schemaVersion" in value && value.schemaVersion !== 2) return null;
  const details = value.schemaVersion === 2 ? parseSessionDetailsV2(value) : parseSessionDetailsV1(value);
  if (!details) return null;

  const dograh = "dograh" in value ? parseDograhCall(value.dograh) : undefined;
  if (dograh === null) return null;
  let review: SessionReview | undefined;
  if ("review" in value) {
    const parsedReview = parseSessionReview(value.review);
    if (parsedReview === null) return null;
    review = parsedReview;
  }
  let reviewStatus: ReviewStatus | undefined;
  if ("reviewStatus" in value) {
    if (!isOneOf(value.reviewStatus, reviewStatuses)) return null;
    reviewStatus = value.reviewStatus;
  }
  // Omit ownership, timestamps and extra fields.
  return {
    id,
    ...details,
    status,
    ...(dograh ? { dograh } : {}),
    ...(review ? { review } : {}),
    ...(reviewStatus ? { reviewStatus } : {}),
  };
}

export function practiceSessionHref(page: "voice-call" | "review", sessionId: string): string {
  return `/${page}?sessionId=${encodeURIComponent(sessionId)}`;
}
