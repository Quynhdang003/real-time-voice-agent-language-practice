import type { Metadata } from "next";
import Link from "next/link";
import {
  AudioLines,
  BookOpenText,
  Braces,
  Check,
  House,
  Lightbulb,
  Mic,
  Mic2,
  Quote,
  ScrollText,
  Sparkles,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { PerformanceCard } from "@/components/fluent/performance-card";
import { SessionBadges } from "@/components/fluent/session-badges";
import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import { UserAvatar } from "@/components/fluent/user-avatar";
import type { PerformanceMetric, VocabularyItem } from "@/components/fluent/types";

export const metadata: Metadata = { title: "Practice Review" };

const performance: PerformanceMetric[] = [
  { name: "Fluency", score: 84, description: "You spoke naturally with only a few pauses.", icon: AudioLines, iconClassName: "bg-app-primary-light text-app-primary" },
  { name: "Grammar", score: 76, description: "Good sentence structure with a few tense mistakes.", icon: Braces, iconClassName: "bg-violet-50 text-app-accent" },
  { name: "Vocabulary", score: 88, description: "You used a good range of everyday words.", icon: BookOpenText, iconClassName: "bg-app-primary-light text-app-primary" },
  { name: "Pronunciation", score: 80, description: "Clear overall pronunciation with a few words to practice.", icon: Mic2, iconClassName: "bg-violet-50 text-app-accent" },
];

const strengths = [
  { title: "Natural responses", description: "You answered quickly and kept the conversation flowing." },
  { title: "Good vocabulary", description: "You used useful restaurant vocabulary naturally." },
  { title: "Clear communication", description: "Your meaning was easy to understand throughout the conversation." },
];

const corrections = [
  { original: "I want order chicken.", better: "I'd like to order chicken.", tip: 'Use "would like to" when making a polite request.' },
  { original: "I eat here yesterday.", better: "I ate here yesterday.", tip: 'Use the past tense "ate" when talking about yesterday.' },
  { original: "Can I have a water?", better: "Can I have some water?", tip: '"Water" is usually uncountable in this context.' },
];

const vocabulary: VocabularyItem[] = [
  { word: "appetizer", definition: "A small dish served before the main meal." },
  { word: "recommendation", definition: "A suggestion about what someone should choose." },
  { word: "reservation", definition: "An arrangement to keep a table for someone." },
  { word: "main course", definition: "The main dish of a meal." },
];

const transcript = [
  { speaker: "Emma", text: "What would you like to order today?", tutor: true },
  { speaker: "You", text: "I want order chicken.", tutor: false },
  { speaker: "Emma", text: "Sure! Would you like anything to drink?", tutor: true },
  { speaker: "You", text: "Can I have a water?", tutor: false },
];

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Session complete</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">Great practice, Alex!</h1>
          <p className="mt-2 text-sm leading-6 text-app-muted sm:text-base">Here’s how you performed in your Restaurant Conversation.</p>
          <div className="mt-4"><SessionBadges duration="8 min" /></div>
        </div>
        <div className="flex w-fit items-center gap-3 rounded-2xl border border-app-border bg-white px-4 py-3 shadow-card">
          <TutorAvatar size={48} />
          <div><p className="text-sm font-bold text-app-text">Emma</p><p className="mt-0.5 text-xs font-medium text-app-muted">AI English Tutor</p></div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-app-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.1em]">Overall Score</span></div>
            <h2 className="mt-4 text-2xl font-bold text-app-text">Great job!</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-app-muted sm:text-base">You communicated clearly and kept the conversation going naturally.</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-semibold text-green-700"><TrendingUp className="h-4 w-4" />Strong conversation flow</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-app-muted">Keep practicing to reach B1</span>
            </div>
          </div>
          <div className="flex min-w-[220px] items-center gap-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="relative flex h-28 w-28 items-center justify-center">
              <div className="absolute h-28 w-28 rounded-full border-[10px] border-indigo-100" />
              <div className="absolute h-28 w-28 rotate-45 rounded-full border-[10px] border-app-primary border-l-transparent" />
              <div className="relative z-10 text-center"><p className="text-3xl font-extrabold tracking-tight text-app-text">82</p><p className="mt-0.5 text-xs font-semibold text-app-muted">/ 100</p></div>
            </div>
            <div><p className="text-sm font-semibold text-app-muted">Session result</p><p className="mt-1 text-lg font-bold text-app-primary">Great job!</p></div>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="performance-heading">
        <SectionHeading id="performance-heading" title="Your performance" description="A quick breakdown of your speaking skills this session." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{performance.map((metric) => <PerformanceCard key={metric.name} metric={metric} />)}</div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-app-border bg-white p-6 shadow-card">
          <SectionHeading compact title="What you did well" description="Strong habits to keep using in your next practice." />
          <div className="space-y-4">
            {strengths.map((strength) => (
              <article key={strength.title} className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-app-success"><Check className="h-5 w-5" /></div>
                <div><h3 className="text-sm font-bold text-app-text">{strength.title}</h3><p className="mt-1 text-sm leading-6 text-app-muted">{strength.description}</p></div>
              </article>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-app-border bg-white p-6 shadow-card">
          <SectionHeading compact title="Things to improve" description="Small corrections that will make your English sound more natural." />
          <div className="space-y-4">{corrections.map((correction) => <CorrectionCard key={correction.original} {...correction} />)}</div>
        </section>
      </section>

      <section className="mb-8" aria-labelledby="vocabulary-heading">
        <SectionHeading id="vocabulary-heading" title="New vocabulary" description="Words and expressions from this session." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {vocabulary.map((item) => (
            <article key={item.word} className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3"><h3 className="text-base font-bold text-app-text">{item.word}</h3><button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-primary-light text-app-primary transition hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100" aria-label={`Listen to ${item.word}`}><Volume2 className="h-4 w-4" /></button></div>
              <p className="mt-4 text-sm leading-6 text-app-muted">{item.definition}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8" aria-labelledby="feedback-heading">
        <SectionHeading id="feedback-heading" title="Feedback from Emma" description="Personalized feedback from your AI tutor." />
        <article className="rounded-2xl border border-indigo-100 bg-app-primary-light p-6 shadow-card sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row">
            <TutorAvatar size={64} className="border-4 border-white shadow-sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2"><Quote className="h-5 w-5 text-app-primary" /><span className="text-sm font-bold text-app-primary">Tutor feedback</span></div>
              <p className="mt-3 max-w-4xl text-base leading-8 text-slate-700 sm:text-lg">You did a great job keeping the conversation natural. Your vocabulary was strong and you responded confidently. Focus on using past tense consistently and practice polite phrases such as &quot;I&apos;d like...&quot; when ordering food.</p>
              <div className="mt-5"><p className="text-sm font-bold text-app-text">Emma</p><p className="mt-0.5 text-xs font-medium text-app-muted">AI English Tutor</p></div>
            </div>
          </div>
        </article>
      </section>

      <section className="mb-8" aria-labelledby="conversation-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><h2 id="conversation-heading" className="text-2xl font-bold tracking-tight text-app-text">Conversation transcript</h2><p className="mt-1 text-sm text-app-muted">Review a few moments from your practice.</p></div>
          <button type="button" className="hidden text-sm font-semibold text-app-primary transition hover:text-indigo-700 sm:block">View full transcript</button>
        </div>
        <article className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <div className="space-y-5">
            {transcript.map((line, index) => (
              <div key={`${line.speaker}-${index}`} className="flex gap-3">
                {line.tutor ? <TutorAvatar size={36} /> : <UserAvatar size="sm" className="bg-slate-200" />}
                <div><p className={`text-xs font-bold ${line.tutor ? "text-app-primary" : "text-app-muted"}`}>{line.speaker}</p><p className="mt-1 text-sm leading-6 text-app-text">{line.text}</p></div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white text-sm font-semibold text-app-primary transition hover:border-indigo-300 hover:bg-app-primary-light sm:hidden"><ScrollText className="h-4 w-4" />View full transcript</button>
        </article>
      </section>

      <section className="pb-10">
        <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="order-2 flex flex-col gap-3 sm:order-1 sm:flex-row">
            <Link href="/" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-5 text-sm font-semibold text-app-text transition hover:border-indigo-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:w-auto"><House className="h-5 w-5" />Back to Home</Link>
            <button type="button" className="hidden h-12 items-center justify-center gap-2 px-3 text-sm font-semibold text-app-primary transition hover:text-indigo-700 sm:flex"><ScrollText className="h-4 w-4" />View Full Transcript</button>
          </div>
          <Link href="/voice-call" className="order-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-6 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99] sm:order-2 sm:w-auto"><Mic className="h-5 w-5" />Practice Again</Link>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({ title, description, id, compact = false }: { title: string; description: string; id?: string; compact?: boolean }) {
  return <div className="mb-5"><h2 id={id} className={`${compact ? "text-xl" : "text-2xl"} font-bold tracking-tight text-app-text`}>{title}</h2><p className="mt-1 text-sm text-app-muted">{description}</p></div>;
}

function CorrectionCard({ original, better, tip }: { original: string; better: string; tip: string }) {
  return (
    <article className="rounded-xl border border-app-border p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-red-50/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-red-500">You said</p><p className="mt-2 text-sm font-semibold text-app-text">{original}</p></div>
        <div className="rounded-xl bg-green-50/70 p-4"><p className="text-xs font-bold uppercase tracking-[0.08em] text-green-600">Better</p><p className="mt-2 text-sm font-semibold text-app-text">{better}</p></div>
      </div>
      <div className="mt-3 flex items-start gap-2 text-sm leading-6 text-app-muted"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-app-primary" /><p>{tip}</p></div>
    </article>
  );
}
