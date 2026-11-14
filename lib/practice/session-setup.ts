// Session setup v2: the per-session variables entered on the home form.
// Pure module shared by the browser form and the server; keep React and Firebase SDKs out.
import { isKeyOf, isOneOf, isRecord, normalizeText, textKey } from "./guards.ts";
import type { FieldErrors, Validated } from "./guards.ts";
import { practiceTutors } from "./catalog.ts";
import type { TutorId } from "./catalog.ts";
import { validateLearnerProfile } from "./profile.ts";
import type { LearnerProfile } from "./profile.ts";
import { TRIAL_DURATION_MINUTES } from "./access.ts";
import type { SessionKind, TrialDuration } from "./access.ts";

export const sessionModes = ["role_play", "free_talk", "q_and_a", "debate"] as const;
export const sessionDurations = [10, 15, 20] as const;
export const setupLimits = {
  topic: { min: 3, max: 80 },
  scenario: { min: 10, max: 500 },
  vocabularyItem: { max: 40 },
  targetVocabulary: { min: 8, max: 12 },
  reviewVocabulary: { min: 3, max: 5 },
  grammarFocus: { max: 100 },
  weakPoints: { max: 5, itemMax: 120 },
} as const;
// Joins lists in the Dograh context, so it may not appear inside an item.
export const LIST_SEPARATOR = ";";

export type SessionMode = (typeof sessionModes)[number];
export type SessionDuration = (typeof sessionDurations)[number];
export type SessionSetup = {
  topic: string;
  scenario: string;
  sessionMode: SessionMode;
  targetVocabulary: string[];
  reviewVocabulary: string[];
  grammarFocus: string | null;
  weakPoints: string[];
  // 10/15/20 for a full session; always 1 for a trial session (ACC-01).
  durationMinutes: SessionDuration | TrialDuration;
  tutorId: TutorId;
};
// The session kind decides the duration rule; the server derives it from the account's access, never the body.
export type SetupOptions = { kind?: SessionKind };

// The `setup` map stored on a v2 session; topic, duration and tutor live at the document's top level.
export type StoredSessionSetup = Pick<SessionSetup,
  "scenario" | "sessionMode" | "targetVocabulary" | "reviewVocabulary" | "grammarFocus" | "weakPoints">;
export type PracticeSetupRequest = { profile: LearnerProfile; setup: SessionSetup };

// Normalizes each item and drops blank ones; anything that is not an array of strings is rejected.
function normalizeList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return value.map(normalizeText).filter(Boolean);
}

function listError(items: string[], itemMax: number, label: string): string | null {
  if (items.some((item) => item.includes(LIST_SEPARATOR))) return `${label} cannot contain "${LIST_SEPARATOR}".`;
  if (items.some((item) => item.length > itemMax)) return `Each ${label.toLowerCase()} item must be ${itemMax} characters or fewer.`;
  if (new Set(items.map(textKey)).size !== items.length) return `${label} items must be unique (case-insensitive).`;
  return null;
}

function textError(text: string, min: number, max: number, label: string): string | null {
  return text.length < min || text.length > max ? `${label} must be ${min}–${max} characters.` : null;
}

export function validateSessionSetup(value: unknown, path = "setup", { kind = "full" }: SetupOptions = {}): Validated<SessionSetup> {
  if (!isRecord(value)) return { ok: false, fieldErrors: { [path]: "Complete the session setup." } };
  const trial = kind === "trial";
  const fieldErrors: FieldErrors = {};
  const set = (field: string, message: string | null) => { if (message) fieldErrors[`${path}.${field}`] = message; };
  const { topic: topicLimit, scenario: scenarioLimit, vocabularyItem, targetVocabulary: targetLimit,
    reviewVocabulary: reviewLimit, grammarFocus: grammarLimit, weakPoints: weakLimit } = setupLimits;

  const topic = normalizeText(value.topic);
  set("topic", textError(topic, topicLimit.min, topicLimit.max, "Topic"));
  const scenario = normalizeText(value.scenario);
  set("scenario", textError(scenario, scenarioLimit.min, scenarioLimit.max, "Scenario"));
  if (!isOneOf(value.sessionMode, sessionModes)) set("sessionMode", "Choose a session mode.");
  // A trial always lasts 1 minute, so its body's duration is ignored.
  if (!trial && !isOneOf(value.durationMinutes, sessionDurations)) set("durationMinutes", "Choose 10, 15 or 20 minutes.");
  if (!isKeyOf(value.tutorId, practiceTutors)) set("tutorId", "Choose a tutor.");

  const targetVocabulary = normalizeList(value.targetVocabulary);
  if (!targetVocabulary) set("targetVocabulary", "Target vocabulary must be a list of words or phrases.");
  else set("targetVocabulary", listError(targetVocabulary, vocabularyItem.max, "Target vocabulary") ??
    (targetVocabulary.length < targetLimit.min || targetVocabulary.length > targetLimit.max
      ? `Add ${targetLimit.min}–${targetLimit.max} target words or phrases.` : null));

  const reviewVocabulary = normalizeList(value.reviewVocabulary);
  if (!reviewVocabulary) set("reviewVocabulary", "Review vocabulary must be a list of words or phrases.");
  else {
    const targetKeys = new Set((targetVocabulary ?? []).map(textKey));
    set("reviewVocabulary", listError(reviewVocabulary, vocabularyItem.max, "Review vocabulary") ??
      (reviewVocabulary.length > 0 && (reviewVocabulary.length < reviewLimit.min || reviewVocabulary.length > reviewLimit.max)
        ? `Add ${reviewLimit.min}–${reviewLimit.max} review words, or leave it empty.`
        : reviewVocabulary.some((item) => targetKeys.has(textKey(item)))
          ? "Review vocabulary cannot repeat a target word." : null));
  }

  const grammarText = normalizeText(value.grammarFocus);
  if (value.grammarFocus !== undefined && value.grammarFocus !== null && typeof value.grammarFocus !== "string") {
    set("grammarFocus", "Grammar focus must be text.");
  } else if (grammarText.length > grammarLimit.max) {
    set("grammarFocus", `Grammar focus must be ${grammarLimit.max} characters or fewer.`);
  }

  const weakPoints = normalizeList(value.weakPoints);
  if (!weakPoints) set("weakPoints", "Weak points must be a list.");
  else set("weakPoints", listError(weakPoints, weakLimit.itemMax, "Weak points") ??
    (weakPoints.length > weakLimit.max ? `Keep at most ${weakLimit.max} weak points.` : null));

  if (Object.keys(fieldErrors).length > 0 || !targetVocabulary || !reviewVocabulary || !weakPoints) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    value: {
      topic,
      scenario,
      sessionMode: value.sessionMode as SessionMode,
      targetVocabulary,
      reviewVocabulary,
      grammarFocus: grammarText || null,
      weakPoints,
      durationMinutes: trial ? TRIAL_DURATION_MINUTES : value.durationMinutes as SessionDuration,
      tutorId: value.tutorId as TutorId,
    },
  };
}

// Body of POST /api/practice-setup (v2): the session's profile snapshot plus its setup.
export function validatePracticeSetupRequest(value: unknown, options: SetupOptions = {}): Validated<PracticeSetupRequest> {
  if (!isRecord(value)) return { ok: false, fieldErrors: { request: "Complete your profile and session setup." } };
  const profile = validateLearnerProfile(value.profile, "profile");
  const setup = validateSessionSetup(value.setup, "setup", options);
  if (!profile.ok || !setup.ok) {
    return { ok: false, fieldErrors: { ...(profile.ok ? {} : profile.fieldErrors), ...(setup.ok ? {} : setup.fieldErrors) } };
  }
  return { ok: true, value: { profile: profile.value, setup: setup.value } };
}
