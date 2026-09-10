"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  MessagesSquare,
  Mic,
  Plane,
  ShoppingBag,
  Sparkles,
  Utensils,
} from "lucide-react";
import { LanguageCard } from "@/components/fluent/language-card";
import { TopicCard } from "@/components/fluent/topic-card";
import { TutorCard } from "@/components/fluent/tutor-card";
import type { Language, Topic, Tutor } from "@/components/fluent/types";
import {
  practiceLanguages, practiceTopics, practiceTutors,
  practiceLevels as levels, practiceDurations as durations, practiceSessionHref,
  type LanguageId, type TopicId, type TutorId,
} from "@/lib/practice/session";
import { cn } from "@/lib/utils";

// Presentation-only flags; allowed choices come from the shared domain config.
const languagePresentation = {
  english: { flag: "🇬🇧" },
  japanese: { flag: "🇯🇵" },
  korean: { flag: "🇰🇷" },
  chinese: { flag: "🇨🇳" },
  french: { flag: "🇫🇷" },
  spanish: { flag: "🇪🇸" },
};
const languages: Language[] = Object.values(practiceLanguages).map((language) => ({
  ...language, ...languagePresentation[language.id],
}));
const topicIcons = {
  daily: MessagesSquare, travel: Plane, restaurant: Utensils,
  interview: BriefcaseBusiness, shopping: ShoppingBag, "free-talk": Sparkles,
};
const topics: Topic[] = Object.values(practiceTopics).map((topic) => ({
  ...topic, icon: topicIcons[topic.id],
}));
const tutors: Tutor[] = Object.values(practiceTutors);

export function HomePracticeSetup({ userName }: { userName: string }) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageId>("english");
  const [selectedTopic, setSelectedTopic] = useState<TopicId>("daily");
  const [selectedLevel, setSelectedLevel] = useState<(typeof levels)[number]>("A2");
  const [selectedDuration, setSelectedDuration] = useState<(typeof durations)[number]>(10);
  const [selectedTutor, setSelectedTutor] = useState<TutorId>("emma");
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const language = languages.find((item) => item.id === selectedLanguage) ?? languages[0];
  const firstName = userName.trim().split(/\s+/)[0] || "Learner";

  async function startVoicePractice() {
    if (isStartingPractice) {
      return;
    }

    setIsStartingPractice(true);
    setStartError(null);

    try {
      const response = await fetch("/api/practice-setup", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languageId: selectedLanguage,
          topicId: selectedTopic,
          level: selectedLevel,
          durationMinutes: selectedDuration,
          tutorId: selectedTutor,
        }),
      });
      const result: unknown = await response.json();

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      if (!response.ok || !isSuccessfulPracticeSetup(result)) {
        throw new Error(getPracticeSetupError(result));
      }

      router.push(practiceSessionHref(result.sessionId));
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "We could not create your practice session. Please try again.",
      );
    } finally {
      setIsStartingPractice(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
      <section className="mb-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Welcome back</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-app-text sm:text-5xl">Good evening, {firstName} 👋</h1>
          <p className="mt-4 text-lg leading-8 text-app-muted">What language would you like to practice today?</p>
        </div>
      </section>

      <section className="mb-12" aria-labelledby="language-heading">
        <div className="mb-5">
          <h2 id="language-heading" className="text-2xl font-bold tracking-tight text-app-text">Choose a language</h2>
          <p className="mt-1 text-sm text-app-muted">Continue your progress or switch to another language.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {languages.map((item) => (
            <LanguageCard key={item.id} language={item} selected={selectedLanguage === item.id} onSelect={() => setSelectedLanguage(item.id)} />
          ))}
        </div>
      </section>

      <section className="mb-12" aria-labelledby="practice-heading">
        <div className="mb-5">
          <h2 id="practice-heading" className="text-2xl font-bold tracking-tight text-app-text">Start a new practice</h2>
          <p className="mt-1 text-sm text-app-muted">Customize your session before starting the conversation.</p>
        </div>
        <div className="rounded-2xl border border-app-border bg-white p-6 shadow-card lg:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <section aria-labelledby="topic-heading">
                <div className="mb-4">
                  <h3 id="topic-heading" className="text-base font-bold text-app-text">Topic</h3>
                  <p className="mt-1 text-sm text-app-muted">Choose what you want to talk about.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} selected={selectedTopic === topic.id} onSelect={() => setSelectedTopic(topic.id)} />
                  ))}
                </div>
              </section>

              <section className="mt-8" aria-labelledby="level-heading">
                <div className="mb-4">
                  <h3 id="level-heading" className="text-base font-bold text-app-text">Level</h3>
                  <p className="mt-1 text-sm text-app-muted">Set the difficulty of the conversation.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {levels.map((level) => {
                    const selected = selectedLevel === level;
                    return (
                      <button key={level} type="button" onClick={() => setSelectedLevel(level)} aria-pressed={selected} className={cn("h-10 rounded-full px-4 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100", selected ? "border-2 border-app-primary bg-indigo-50 text-app-primary hover:bg-indigo-100" : "border border-app-border bg-white text-app-muted hover:border-indigo-300")}>{level}</button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-8" aria-labelledby="duration-heading">
                <div className="mb-4">
                  <h3 id="duration-heading" className="text-base font-bold text-app-text">Duration</h3>
                  <p className="mt-1 text-sm text-app-muted">Choose how long you want to practice.</p>
                </div>
                <div className="grid max-w-lg grid-cols-3 gap-3">
                  {durations.map((duration) => {
                    const selected = selectedDuration === duration;
                    return (
                      <button key={duration} type="button" onClick={() => setSelectedDuration(duration)} aria-pressed={selected} className={cn("h-12 rounded-xl text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100", selected ? "border-2 border-app-primary bg-indigo-50 text-app-primary hover:bg-indigo-100" : "border border-app-border bg-white text-app-text hover:border-indigo-300 hover:bg-slate-50")}>{duration} min</button>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="flex flex-col">
              <h3 className="text-base font-bold text-app-text">Your AI tutor</h3>
              <p className="mt-1 text-sm text-app-muted">Practice with your selected tutor.</p>
              {tutors.map((tutor) => (
                <TutorCard key={tutor.id} tutor={tutor} selected={selectedTutor === tutor.id} onSelect={() => setSelectedTutor(tutor.id)} />
              ))}
              <div className="mt-5 space-y-3 rounded-xl border border-app-border p-4">
                <div className="flex items-center justify-between text-sm"><span className="text-app-muted">Language</span><span className="font-semibold text-app-text">{language.name}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-app-muted">Level</span><span className="font-semibold text-app-text">{selectedLevel}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-app-muted">Duration</span><span className="font-semibold text-app-text">{selectedDuration} min</span></div>
              </div>
              {startError ? (
                <p className="mt-4 text-sm font-medium leading-5 text-app-error" role="alert">
                  {startError}
                </p>
              ) : null}
              <button type="button" onClick={startVoicePractice} disabled={isStartingPractice} aria-busy={isStartingPractice} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70">
                <Mic className="h-5 w-5" /> {isStartingPractice ? "Preparing practice..." : "Start Voice Practice"}
              </button>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function isSuccessfulPracticeSetup(
  value: unknown,
): value is { success: true; sessionId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    value.success === true &&
    "sessionId" in value &&
    typeof value.sessionId === "string" &&
    value.sessionId.length > 0
  );
}

function getPracticeSetupError(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return "We could not create your practice session. Please try again.";
}
