// Builds the context sent to the Dograh embed widget (data-dograh-context + setContext()).
// Dograh stores it as the run's initial_context, read in prompts as {{initial_context.<key> | fallback}}
// and echoed back by the Webhook node as {{initial_context.session_id}}.
// Firestore keeps typed values (null, arrays); "none" and "; "-joined lists exist only here.
import type { PracticeSession } from "./session.ts";
import { LIST_SEPARATOR } from "./session-setup.ts";
import { defaultLearnerProfile } from "./profile.ts";

export const DOGRAH_NONE = "none";
const LIST_JOINER = `${LIST_SEPARATOR} `;

// session_id comes first: when the total size is exceeded, Dograh drops the later variables.
export const dograhContextKeys = [
  "session_id", "learner_name", "native_language", "level", "accent", "speech_pace", "correction_style",
  "vietnamese_allowed", "topic", "scenario", "session_mode", "target_vocabulary", "review_vocabulary",
  "grammar_focus", "weak_points", "duration_minutes", "tutor_name", "language",
] as const;
export type DograhContextKey = (typeof dograhContextKeys)[number];
export type DograhContext = Record<DograhContextKey, string>;

// Limits enforced by Dograh 1.50.0 (api/services/workflow/embed_context.py).
export const dograhContextLimits = { maxVariables: 50, maxKeyLength: 64, maxValueLength: 2000, maxTotalBytes: 8192 } as const;

function joinList(items: readonly string[] | undefined): string {
  return items && items.length > 0 ? items.join(LIST_JOINER) : DOGRAH_NONE;
}

// v2 sessions carry their own profile snapshot and setup. Legacy v1 sessions get the default
// profile for the signed-in learner and "none" for the setup fields they never had.
export function buildDograhContext(session: PracticeSession, learnerName: string): DograhContext {
  const profile = session.profile ?? defaultLearnerProfile(learnerName);
  const setup = session.setup;
  const context: DograhContext = {
    session_id: session.id,
    learner_name: profile.learnerName || DOGRAH_NONE,
    native_language: profile.nativeLanguage,
    level: session.level,
    accent: profile.accent,
    speech_pace: profile.speechPace,
    correction_style: profile.correctionStyle,
    vietnamese_allowed: profile.vietnameseAllowed,
    topic: session.topic.name,
    scenario: setup?.scenario ?? DOGRAH_NONE,
    session_mode: setup?.sessionMode ?? "free_talk",
    target_vocabulary: joinList(setup?.targetVocabulary),
    review_vocabulary: joinList(setup?.reviewVocabulary),
    grammar_focus: setup?.grammarFocus ?? DOGRAH_NONE,
    weak_points: joinList(setup?.weakPoints),
    duration_minutes: String(session.durationMinutes),
    tutor_name: session.tutor.name,
    language: session.language.name,
  };
  return context;
}

// Size as Dograh counts it: key length + Python json.dumps(value) with ensure_ascii,
// so every non-ASCII UTF-16 code unit costs 6 bytes (\uXXXX).
export function dograhContextBytes(context: Record<string, string>): number {
  let total = 0;
  for (const [key, value] of Object.entries(context)) {
    const ascii = JSON.stringify(value).replace(/[^\x00-\x7f]/g, "\\uXXXX");
    total += key.length + ascii.length;
  }
  return total;
}
