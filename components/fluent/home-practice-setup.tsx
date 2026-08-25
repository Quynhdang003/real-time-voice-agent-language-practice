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
import { SessionCard } from "@/components/fluent/session-card";
import { TopicCard } from "@/components/fluent/topic-card";
import { TutorCard } from "@/components/fluent/tutor-card";
import type { Language, PracticeSession, Topic, Tutor } from "@/components/fluent/types";
import { cn } from "@/lib/utils";

const languages: Language[] = [
  { id: "english", name: "English", flag: "🇬🇧", level: "CEFR A2", progress: 68 },
  { id: "japanese", name: "Japanese", flag: "🇯🇵", level: "CEFR Beginner", progress: 24 },
  { id: "korean", name: "Korean", flag: "🇰🇷", level: "CEFR Beginner", progress: 18 },
  { id: "chinese", name: "Chinese", flag: "🇨🇳", level: "CEFR Beginner", progress: 12 },
  { id: "french", name: "French", flag: "🇫🇷", level: "CEFR A1", progress: 36 },
  { id: "spanish", name: "Spanish", flag: "🇪🇸", level: "CEFR A1", progress: 42 },
];

const topics: Topic[] = [
  { id: "daily", name: "Daily Conversation", icon: MessagesSquare },
  { id: "travel", name: "Travel", icon: Plane },
  { id: "restaurant", name: "Restaurant", icon: Utensils },
  { id: "interview", name: "Job Interview", icon: BriefcaseBusiness },
  { id: "shopping", name: "Shopping", icon: ShoppingBag },
  { id: "free-talk", name: "Free Talk", icon: Sparkles },
];

const levels = ["Beginner", "A1", "A2", "B1", "B2"] as const;
const durations = ["5 min", "10 min", "15 min"] as const;

const tutors: Tutor[] = [
  {
    id: "emma",
    name: "Emma",
    role: "English Tutor",
    description: "Friendly tutor focused on everyday conversations.",
    specialties: ["Everyday English", "Pronunciation"],
  },
];

const recentSessions: PracticeSession[] = [
  { id: "restaurant", title: "Restaurant Conversation", language: "English", level: "A2", duration: "8 min", score: 82, icon: Utensils, iconClassName: "bg-orange-50 text-orange-500" },
  { id: "travel", title: "Travel", language: "English", level: "A2", duration: "10 min", score: 76, icon: Plane, iconClassName: "bg-sky-50 text-sky-500" },
  { id: "conversation", title: "Daily Conversation", language: "English", level: "A2", duration: "6 min", score: 85, icon: MessagesSquare, iconClassName: "bg-violet-50 text-violet-500" },
];

export function HomePracticeSetup({ userName }: { userName: string }) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState("english");
  const [selectedTopic, setSelectedTopic] = useState("daily");
  const [selectedLevel, setSelectedLevel] = useState<(typeof levels)[number]>("A2");
  const [selectedDuration, setSelectedDuration] = useState<(typeof durations)[number]>("10 min");
  const [selectedTutor, setSelectedTutor] = useState("emma");
  const language = languages.find((item) => item.id === selectedLanguage) ?? languages[0];
  const firstName = userName.trim().split(/\s+/)[0] || "Learner";

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
                      <button key={duration} type="button" onClick={() => setSelectedDuration(duration)} aria-pressed={selected} className={cn("h-12 rounded-xl text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100", selected ? "border-2 border-app-primary bg-indigo-50 text-app-primary hover:bg-indigo-100" : "border border-app-border bg-white text-app-text hover:border-indigo-300 hover:bg-slate-50")}>{duration}</button>
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
                <div className="flex items-center justify-between text-sm"><span className="text-app-muted">Duration</span><span className="font-semibold text-app-text">{selectedDuration}</span></div>
              </div>
              <button type="button" onClick={() => router.push("/voice-call")} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99]">
                <Mic className="h-5 w-5" /> Start Voice Practice
              </button>
            </aside>
          </div>
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
