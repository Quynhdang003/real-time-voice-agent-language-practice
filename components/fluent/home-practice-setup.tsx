"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock, MessagesSquare, Mic, Plane, Save, Utensils } from "lucide-react";
import { AccessBanner } from "@/components/fluent/access-banner";
import { ChipInput } from "@/components/fluent/chip-input";
import { OptionPills } from "@/components/fluent/option-pills";
import { SessionCard } from "@/components/fluent/session-card";
import { TutorCard } from "@/components/fluent/tutor-card";
import type { PracticeSessionSummary, Tutor } from "@/components/fluent/types";
import { Input } from "@/components/ui/input";
import {
  TRIAL_DURATION_MINUTES, accessStatuses, formatAccessDate, type AccessStatus, type AccessView,
} from "@/lib/practice/access";
import { isOneOf, isRecord, type FieldErrors } from "@/lib/practice/guards";
import {
  LEARNER_NAME_MAX_LENGTH, accents, cefrLevels, correctionStyles, speechPaces, validateLearnerProfile,
  vietnameseAllowedOptions, type Accent, type CorrectionStyle, type LearnerProfileDraft, type SpeechPace,
  type VietnameseAllowed,
} from "@/lib/practice/profile";
import {
  sessionDurations, sessionModes, setupLimits, validatePracticeSetupRequest, type SessionDuration, type SessionMode,
} from "@/lib/practice/session-setup";
import {
  creatablePracticeLanguageIds, practiceLanguages, practiceSessionHref, practiceTopics, practiceTutors, type TutorId,
} from "@/lib/practice/session";

// Practice is English only; the language stays in the session data so it can be extended later.
const practiceLanguage = practiceLanguages[creatablePracticeLanguageIds[0]];
const tutors: Tutor[] = Object.values(practiceTutors);
const topicSuggestions = Object.values(practiceTopics).map((topic) => topic.name);

const accentLabels: Record<Accent, string> = { american: "American", british: "British" };
const paceLabels: Record<SpeechPace, string> = { slow: "Slow", normal: "Normal" };
const correctionLabels: Record<CorrectionStyle, string> = {
  gentle_recast: "Gentle recast", immediate: "Immediate", end_of_session: "End of session",
};
const vietnameseLabels: Record<VietnameseAllowed, string> = { never: "Never", only_when_stuck: "Only when stuck" };
const modeLabels: Record<SessionMode, string> = {
  role_play: "Role play", free_talk: "Free talk", q_and_a: "Q&A", debate: "Debate",
};
const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const recentSessions: PracticeSessionSummary[] = [
  { id: "restaurant", title: "Restaurant Conversation", language: "English", level: "A2", duration: "8 min", score: 82, icon: Utensils, iconClassName: "bg-orange-50 text-orange-500" },
  { id: "travel", title: "Travel", language: "English", level: "A2", duration: "10 min", score: 76, icon: Plane, iconClassName: "bg-sky-50 text-sky-500" },
  { id: "conversation", title: "Daily Conversation", language: "English", level: "A2", duration: "6 min", score: 85, icon: MessagesSquare, iconClassName: "bg-violet-50 text-violet-500" },
];

const inputClassName = "h-12 rounded-xl border-app-border bg-white px-4 text-sm text-app-text outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-app-primary focus-visible:ring-4 focus-visible:ring-indigo-100";

type ProfileStatus = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

type HomePracticeSetupProps = {
  userName: string;
  initialProfile: LearnerProfileDraft;
  initialAccess: AccessView;
  initialWeakPoints?: string[];
};

export function HomePracticeSetup({ userName, initialProfile, initialAccess, initialWeakPoints = [] }: HomePracticeSetupProps) {
  const router = useRouter();
  // Display only (ACC-02): the server decides the session kind again when the session is created.
  const [access, setAccess] = useState<AccessView>(initialAccess);
  const kind = access.level === "trial" ? "trial" : "full";
  const blocked = access.level === "blocked";
  // LIM-01: approved learners have a daily call limit; the admin and trial accounts have no quota.
  const quota = access.quota;
  const limitReached = quota !== null && quota.remaining === 0;
  const cannotStart = blocked || limitReached;
  const [profile, setProfile] = useState<LearnerProfileDraft>(initialProfile);
  const [topic, setTopic] = useState("");
  const [scenario, setScenario] = useState("");
  const [sessionMode, setSessionMode] = useState<SessionMode>("role_play");
  const [targetVocabulary, setTargetVocabulary] = useState<string[]>([]);
  const [reviewVocabulary, setReviewVocabulary] = useState<string[]>([]);
  const [grammarFocus, setGrammarFocus] = useState("");
  const [weakPoints, setWeakPoints] = useState<string[]>(initialWeakPoints);
  const [durationMinutes, setDurationMinutes] = useState<SessionDuration>(sessionDurations[0]);
  const [tutorId, setTutorId] = useState<TutorId>("emma");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({ kind: "idle" });
  const firstName = userName.trim().split(/\s+/)[0] || "Learner";
  const { targetVocabulary: targetLimit, reviewVocabulary: reviewLimit, weakPoints: weakLimit } = setupLimits;

  function clearError(path: string) {
    setFieldErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function updateProfile<K extends keyof LearnerProfileDraft>(key: K, value: LearnerProfileDraft[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    clearError(`profile.${key}`);
    setProfileStatus({ kind: "idle" });
  }

  function setupField<T>(name: string, setter: (value: T) => void) {
    return (value: T) => { setter(value); clearError(`setup.${name}`); };
  }

  async function saveProfileAsDefault() {
    const result = validateLearnerProfile(profile);
    if (!result.ok) {
      setFieldErrors((current) => ({ ...current, ...result.fieldErrors }));
      setProfileStatus({ kind: "error", message: "Fix the highlighted profile fields first." });
      return;
    }
    setProfileStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/learner-profile", {
        method: "PUT", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(result.value),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 401) { router.push("/sign-in"); return; }
      if (!response.ok) {
        setFieldErrors((current) => ({ ...current, ...fieldErrorsOf(body) }));
        setProfileStatus({ kind: "error", message: messageOf(body, "Unable to save your profile. Please try again.") });
        return;
      }
      setProfileStatus({ kind: "saved", message: "Saved as your default profile." });
    } catch {
      setProfileStatus({ kind: "error", message: "Unable to reach the server. Check your connection and try again." });
    }
  }

  async function startVoicePractice() {
    if (isStarting || cannotStart) return;
    const request = validatePracticeSetupRequest({
      profile,
      setup: { topic, scenario, sessionMode, targetVocabulary, reviewVocabulary, grammarFocus, weakPoints, durationMinutes, tutorId },
    }, { kind });
    if (!request.ok) {
      setFieldErrors(request.fieldErrors);
      setFormError("Please fix the highlighted fields before starting.");
      return;
    }
    setIsStarting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/practice-setup", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(request.value),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 401) { router.push("/sign-in"); return; }
      // The trial was used meanwhile (e.g. in another tab): show the banner with the request form.
      if (response.status === 403) {
        const status = accessStatusOf(body);
        setAccess((current) => ({ ...current, level: "blocked", trialUsed: true, status: status ?? current.status }));
        setFormError(messageOf(body, "Your free trial call has been used. Full access needs the admin's approval."));
        setIsStarting(false);
        return;
      }
      // The daily limit was reached meanwhile (e.g. in another tab).
      if (response.status === 429) {
        const reached = limitOf(body);
        if (reached) setAccess((current) => ({ ...current, quota: { ...reached, used: reached.limit, remaining: 0 } }));
        setFormError(messageOf(body, "You have used today's calls. The limit resets at midnight (Vietnam time)."));
        setIsStarting(false);
        return;
      }
      if (!response.ok || !isSuccessfulPracticeSetup(body)) {
        setFieldErrors(fieldErrorsOf(body));
        throw new Error(messageOf(body, "We could not create your practice session. Please try again."));
      }
      router.push(practiceSessionHref("voice-call", body.sessionId));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We could not create your practice session. Please try again.");
      setIsStarting(false);
    }
  }

  const errorOf = (path: string) => fieldErrors[path];
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
      <section className="mb-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Welcome back</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-app-text sm:text-5xl">Good evening, {firstName} 👋</h1>
          <p className="mt-4 text-lg leading-8 text-app-muted">Ready for today&apos;s English speaking practice?</p>
        </div>
      </section>

      <AccessBanner access={access} onChange={setAccess} />

      <section className="mb-12" aria-labelledby="practice-heading">
        <div className="mb-5">
          <h2 id="practice-heading" className="text-2xl font-bold tracking-tight text-app-text">Start a new practice</h2>
          <p className="mt-1 text-sm text-app-muted">Plan today&apos;s conversation, then talk with your tutor.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section aria-labelledby="session-heading" className="space-y-7 rounded-2xl border border-app-border bg-white p-6 shadow-card lg:p-8">
            <header>
              <h3 id="session-heading" className="text-base font-bold text-app-text">Session</h3>
              <p className="mt-1 text-sm text-app-muted">What you will practice in this conversation.</p>
            </header>

            <Field id="setup-topic" label="Topic" error={errorOf("setup.topic")}
              help={`${setupLimits.topic.min}–${setupLimits.topic.max} characters, e.g. Job interview.`}>
              <Input id="setup-topic" value={topic} maxLength={setupLimits.topic.max} placeholder="What do you want to talk about?"
                onChange={(event) => setupField("topic", setTopic)(event.target.value)} aria-invalid={Boolean(errorOf("setup.topic"))}
                aria-describedby={describedBy("setup-topic", errorOf("setup.topic"))} className={inputClassName} />
              <div className="mt-2 flex flex-wrap gap-2" aria-label="Topic suggestions">
                {topicSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setupField("topic", setTopic)(suggestion)}
                    className="rounded-full border border-app-border bg-slate-50 px-3 py-1 text-xs font-medium text-app-muted transition hover:border-indigo-300 hover:text-app-primary focus:outline-none focus:ring-2 focus:ring-indigo-100">
                    {suggestion}
                  </button>
                ))}
              </div>
            </Field>

            <Field id="setup-scenario" label="Scenario" error={errorOf("setup.scenario")}
              counter={`${scenario.length}/${setupLimits.scenario.max}`}
              help="The situation and the tutor's role, e.g. You are a hiring manager at a tech startup interviewing me.">
              <textarea id="setup-scenario" value={scenario} maxLength={setupLimits.scenario.max} rows={3}
                onChange={(event) => setupField("scenario", setScenario)(event.target.value)}
                aria-invalid={Boolean(errorOf("setup.scenario"))} aria-describedby={describedBy("setup-scenario", errorOf("setup.scenario"))}
                placeholder="Describe the setting and who the tutor plays."
                className="w-full rounded-xl border border-app-border bg-white px-4 py-3 text-sm leading-6 text-app-text outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-app-primary focus-visible:ring-4 focus-visible:ring-indigo-100" />
            </Field>

            <OptionPills id="setup-mode" label="Session mode" options={options(sessionModes, modeLabels)} value={sessionMode}
              onChange={setupField("sessionMode", setSessionMode)} error={errorOf("setup.sessionMode")} />

            <ChipInput id="setup-target" label="Target vocabulary" values={targetVocabulary}
              onChange={setupField("targetVocabulary", setTargetVocabulary)} max={targetLimit.max}
              maxLength={setupLimits.vocabularyItem.max} placeholder="Type a word or phrase, then press Enter"
              counter={`${targetVocabulary.length} / ${targetLimit.min}–${targetLimit.max}`}
              help={`Required: ${targetLimit.min}–${targetLimit.max} words or phrases you are learning today.`}
              error={errorOf("setup.targetVocabulary")} />

            <ChipInput id="setup-review" label="Review vocabulary (optional)" values={reviewVocabulary}
              onChange={setupField("reviewVocabulary", setReviewVocabulary)} max={reviewLimit.max}
              maxLength={setupLimits.vocabularyItem.max} placeholder="Words from earlier days"
              counter={`${reviewVocabulary.length} / ${reviewLimit.min}–${reviewLimit.max}`}
              help={`Leave empty, or add ${reviewLimit.min}–${reviewLimit.max} words from previous days.`}
              error={errorOf("setup.reviewVocabulary")} />

            <Field id="setup-grammar" label="Grammar focus (optional)" error={errorOf("setup.grammarFocus")}
              help="e.g. Past simple vs present perfect.">
              <Input id="setup-grammar" value={grammarFocus} maxLength={setupLimits.grammarFocus.max} placeholder="A grammar point to practice"
                onChange={(event) => setupField("grammarFocus", setGrammarFocus)(event.target.value)}
                aria-invalid={Boolean(errorOf("setup.grammarFocus"))} aria-describedby={describedBy("setup-grammar", errorOf("setup.grammarFocus"))}
                className={inputClassName} />
            </Field>

            <ChipInput id="setup-weak" label={initialWeakPoints.length > 0 ? "Weak points (from your last reviews)" : "Weak points (optional)"}
              values={weakPoints} onChange={setupField("weakPoints", setWeakPoints)} max={weakLimit.max}
              maxLength={weakLimit.itemMax} placeholder="Something to keep working on"
              counter={`${weakPoints.length} / ${weakLimit.max}`}
              help="Your tutor will watch for these. They are filled in from your recent reviews; edit them freely."
              error={errorOf("setup.weakPoints")} />

            {kind === "full" ? (
              <OptionPills id="setup-duration" label="Duration"
                options={sessionDurations.map((value) => ({ value, label: `${value} min` }))} value={durationMinutes}
                onChange={setupField("durationMinutes", setDurationMinutes)} error={errorOf("setup.durationMinutes")} />
            ) : (
              <div>
                <p className="mb-2 text-sm font-semibold text-app-text">Duration</p>
                <p className="text-sm text-app-muted">Your trial call lasts {TRIAL_DURATION_MINUTES} minute. Full access unlocks 10, 15 or 20 minutes.</p>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section aria-labelledby="profile-heading" className="space-y-5 rounded-2xl border border-app-border bg-white p-6 shadow-card">
              <header>
                <h3 id="profile-heading" className="text-base font-bold text-app-text">Learner profile</h3>
                <p className="mt-1 text-sm text-app-muted">Changes apply to this session. Save them to reuse next time.</p>
              </header>
              <Field id="profile-name" label="Name your tutor uses" error={errorOf("profile.learnerName")}>
                <Input id="profile-name" value={profile.learnerName} maxLength={LEARNER_NAME_MAX_LENGTH}
                  onChange={(event) => updateProfile("learnerName", event.target.value)}
                  aria-invalid={Boolean(errorOf("profile.learnerName"))} aria-describedby={describedBy("profile-name", errorOf("profile.learnerName"))}
                  className={inputClassName} />
              </Field>
              <OptionPills id="profile-level" label="Your level (CEFR)" options={cefrLevels.map((value) => ({ value, label: value }))}
                value={profile.level} onChange={(value) => updateProfile("level", value)} error={errorOf("profile.level")} />
              <OptionPills id="profile-accent" label="Tutor accent" options={options(accents, accentLabels)}
                value={profile.accent} onChange={(value) => updateProfile("accent", value)} error={errorOf("profile.accent")} />
              <OptionPills id="profile-pace" label="Speech pace" options={options(speechPaces, paceLabels)}
                value={profile.speechPace} onChange={(value) => updateProfile("speechPace", value)} error={errorOf("profile.speechPace")} />
              <OptionPills id="profile-correction" label="Correction style" options={options(correctionStyles, correctionLabels)}
                value={profile.correctionStyle} onChange={(value) => updateProfile("correctionStyle", value)} error={errorOf("profile.correctionStyle")} />
              <OptionPills id="profile-vietnamese" label="Vietnamese allowed" options={options(vietnameseAllowedOptions, vietnameseLabels)}
                value={profile.vietnameseAllowed} onChange={(value) => updateProfile("vietnameseAllowed", value)} error={errorOf("profile.vietnameseAllowed")} />
              <p className="text-xs text-app-muted">Native language: {profile.nativeLanguage}</p>
              <div>
                <button type="button" onClick={saveProfileAsDefault} disabled={profileStatus.kind === "saving"} aria-busy={profileStatus.kind === "saving"}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border px-4 text-sm font-semibold text-app-primary transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60">
                  <Save className="h-4 w-4" />{profileStatus.kind === "saving" ? "Saving…" : "Save as default"}
                </button>
                {profileStatus.message ? (
                  <p role={profileStatus.kind === "error" ? "alert" : "status"}
                    className={profileStatus.kind === "error" ? "mt-2 text-xs font-medium text-red-600" : "mt-2 text-xs font-medium text-green-700"}>
                    {profileStatus.message}
                  </p>
                ) : null}
              </div>
            </section>

            <section aria-labelledby="tutor-heading" className="rounded-2xl border border-app-border bg-white p-6 shadow-card">
              <h3 id="tutor-heading" className="text-base font-bold text-app-text">Your AI tutor</h3>
              {tutors.map((tutor) => (
                <TutorCard key={tutor.id} tutor={tutor} selected={tutorId === tutor.id} onSelect={() => setupField("tutorId", setTutorId)(tutor.id)} />
              ))}
              <div className="mt-5 space-y-3 rounded-xl border border-app-border p-4">
                <SummaryRow label="Language" value={practiceLanguage.name} />
                <SummaryRow label="Level" value={profile.level ?? "Not selected"} />
                <SummaryRow label="Duration" value={kind === "trial" ? `${TRIAL_DURATION_MINUTES} min (trial)` : `${durationMinutes} min`} />
                {quota ? <SummaryRow label="Calls left today" value={`${quota.remaining} of ${quota.limit}`} /> : null}
              </div>
              {formError ? <p className="mt-4 text-sm font-medium leading-5 text-app-error" role="alert">{formError}</p> : null}
              {limitReached && !formError ? (
                <p className="mt-4 text-sm leading-5 text-app-muted" role="status">
                  You have used today&apos;s {quota.limit} calls. New calls open on {formatAccessDate(quota.resetsAt)} at 00:00 (Vietnam time).
                </p>
              ) : null}
              <button type="button" onClick={startVoicePractice} disabled={isStarting || cannotStart} aria-busy={isStarting}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
                {blocked ? <><Lock className="h-5 w-5" /> Full access needed</>
                  : limitReached ? <><Lock className="h-5 w-5" /> Daily limit reached</>
                  : <><Mic className="h-5 w-5" /> {isStarting ? "Preparing practice..." : kind === "trial" ? "Start 1-minute trial" : "Start Voice Practice"}</>}
              </button>
            </section>
          </aside>
        </div>
      </section>

      <section aria-labelledby="recent-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-heading" className="text-2xl font-bold tracking-tight text-app-text">Recent practice</h2>
            <p className="mt-1 text-sm text-app-muted">Review your latest sessions and progress.</p>
          </div>
          <button type="button" className="hidden text-sm font-semibold text-app-primary transition hover:text-indigo-700 sm:block">View all</button>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {recentSessions.map((session) => <SessionCard key={session.id} session={session} />)}
        </div>
      </section>
    </main>
  );
}

function describedBy(id: string, error: string | undefined) {
  return [error ? `${id}-error` : null, `${id}-help`].filter(Boolean).join(" ");
}

function Field({ id, label, help, counter, error, children }: {
  id: string; label: string; help?: string; counter?: string; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-app-text">{label}</label>
        {counter ? <span className="text-xs font-medium text-app-muted">{counter}</span> : null}
      </div>
      {children}
      {help ? <p id={`${id}-help`} className="mt-2 text-xs text-app-muted">{help}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-app-muted">{label}</span><span className="font-semibold text-app-text">{value}</span>
    </div>
  );
}

function isSuccessfulPracticeSetup(value: unknown): value is { success: true; sessionId: string } {
  return isRecord(value) && value.success === true && typeof value.sessionId === "string" && value.sessionId.length > 0;
}

function limitOf(value: unknown): { limit: number; resetsAt: string } | undefined {
  if (!isRecord(value) || typeof value.limit !== "number" || !Number.isSafeInteger(value.limit) || value.limit < 1) return undefined;
  return typeof value.resetsAt === "string" && Number.isFinite(Date.parse(value.resetsAt))
    ? { limit: value.limit, resetsAt: value.resetsAt } : undefined;
}

function accessStatusOf(value: unknown): AccessStatus | undefined {
  return isRecord(value) && isOneOf(value.accessStatus, accessStatuses) ? value.accessStatus : undefined;
}

function messageOf(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string" ? value.message : fallback;
}

function fieldErrorsOf(value: unknown): FieldErrors {
  if (!isRecord(value) || !isRecord(value.fieldErrors)) return {};
  return Object.fromEntries(Object.entries(value.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
