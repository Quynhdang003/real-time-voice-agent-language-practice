// Learner profile: stored per user, pre-filled into every session and editable per session.
// Pure module shared by the browser form and the server; keep React and Firebase SDKs out.
import { isOneOf, isRecord, normalizeText } from "./guards.ts";
import type { FieldErrors, Validated } from "./guards.ts";

export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const accents = ["american", "british"] as const;
export const speechPaces = ["slow", "normal"] as const;
export const correctionStyles = ["gentle_recast", "immediate", "end_of_session"] as const;
export const vietnameseAllowedOptions = ["never", "only_when_stuck"] as const;
export const nativeLanguages = ["Vietnamese"] as const;
export const LEARNER_NAME_MAX_LENGTH = 40;

export type CefrLevel = (typeof cefrLevels)[number];
export type Accent = (typeof accents)[number];
export type SpeechPace = (typeof speechPaces)[number];
export type CorrectionStyle = (typeof correctionStyles)[number];
export type VietnameseAllowed = (typeof vietnameseAllowedOptions)[number];
export type NativeLanguage = (typeof nativeLanguages)[number];

export type LearnerProfile = {
  learnerName: string;
  nativeLanguage: NativeLanguage;
  level: CefrLevel;
  accent: Accent;
  speechPace: SpeechPace;
  correctionStyle: CorrectionStyle;
  vietnameseAllowed: VietnameseAllowed;
};

// Snapshot stored on a v2 session; the session level lives at the document's top level.
export type SessionProfile = Omit<LearnerProfile, "level">;

// Form pre-fill: the level has no default and must be picked on the first session.
export type LearnerProfileDraft = Omit<LearnerProfile, "level"> & { level: CefrLevel | null };

const enumFields = [
  ["nativeLanguage", nativeLanguages, "Choose your native language."],
  ["level", cefrLevels, "Choose your CEFR level (A1–C2)."],
  ["accent", accents, "Choose an accent."],
  ["speechPace", speechPaces, "Choose a speech pace."],
  ["correctionStyle", correctionStyles, "Choose a correction style."],
  ["vietnameseAllowed", vietnameseAllowedOptions, "Choose when Vietnamese is allowed."],
] as const;

// Proposed defaults (context/api-contracts.md → Field rules), used until the learner saves a profile.
export function defaultLearnerProfile(accountName: string): LearnerProfileDraft {
  return {
    learnerName: normalizeText(normalizeText(accountName).slice(0, LEARNER_NAME_MAX_LENGTH)),
    nativeLanguage: "Vietnamese",
    level: null,
    accent: "american",
    speechPace: "normal",
    correctionStyle: "gentle_recast",
    vietnameseAllowed: "only_when_stuck",
  };
}

export function validateLearnerProfile(value: unknown, path = "profile"): Validated<LearnerProfile> {
  if (!isRecord(value)) return { ok: false, fieldErrors: { [path]: "Complete your learner profile." } };
  const fieldErrors: FieldErrors = {};
  const learnerName = normalizeText(value.learnerName);
  if (!learnerName || learnerName.length > LEARNER_NAME_MAX_LENGTH) {
    fieldErrors[`${path}.learnerName`] = `Enter the name your tutor should use (1–${LEARNER_NAME_MAX_LENGTH} characters).`;
  }
  for (const [field, options, message] of enumFields) {
    if (!isOneOf(value[field], options)) fieldErrors[`${path}.${field}`] = message;
  }
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      learnerName,
      nativeLanguage: value.nativeLanguage as NativeLanguage,
      level: value.level as CefrLevel,
      accent: value.accent as Accent,
      speechPace: value.speechPace as SpeechPace,
      correctionStyle: value.correctionStyle as CorrectionStyle,
      vietnameseAllowed: value.vietnameseAllowed as VietnameseAllowed,
    },
  };
}

export type SaveLearnerProfileResult =
  | { status: "ok"; profile: LearnerProfile }
  | { status: "unauthenticated" | "unavailable" }
  | { status: "invalid"; fieldErrors: FieldErrors };

type LearnerProfileStore = {
  // Writes users/{userId}.learnerProfile; userId always comes from the verified session cookie.
  write: (userId: string, profile: LearnerProfile) => Promise<void>;
  onError: (error: unknown) => void;
};

// "Save as default": the only path that changes the stored profile. Creating a session never does.
export async function saveLearnerProfile(
  userId: string, rawProfile: unknown, store: LearnerProfileStore,
): Promise<SaveLearnerProfileResult> {
  if (!userId.trim()) return { status: "unauthenticated" };
  const result = validateLearnerProfile(rawProfile);
  if (!result.ok) return { status: "invalid", fieldErrors: result.fieldErrors };
  try {
    await store.write(userId, result.value);
    return { status: "ok", profile: result.value };
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}

// A stored profile is trusted only if it still passes validation; otherwise the defaults apply.
export function learnerProfileDraft(stored: unknown, accountName: string): LearnerProfileDraft {
  const result = validateLearnerProfile(stored);
  return result.ok ? result.value : defaultLearnerProfile(accountName);
}
