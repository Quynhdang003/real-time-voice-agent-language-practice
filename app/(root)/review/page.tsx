import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AudioLines, BookOpenText, Braces, House, Mic, Mic2, ScrollText, Sparkles } from "lucide-react";
import { SessionBadges } from "@/components/fluent/session-badges";
import { SessionAccessNotice } from "@/components/fluent/session-access-notice";
import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import { getPracticeSession } from "@/lib/practice/server";
import { practiceSessionHref } from "@/lib/practice/session";

export const metadata: Metadata = { title: "Practice Review" };

const metrics = [
  { name: "Fluency", icon: AudioLines },
  { name: "Grammar", icon: Braces },
  { name: "Vocabulary", icon: BookOpenText },
  { name: "Pronunciation", icon: Mic2 },
];

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const result = await getPracticeSession((await searchParams).sessionId);
  if (result.status === "unauthenticated") redirect("/sign-in");
  if (result.status !== "ok") return <SessionAccessNotice status={result.status} />;
  const { session, learner } = result;
  const callMessage = session.status === "completed"
    ? "Your call has ended. A transcript and assessment are not available yet."
    : session.status === "failed"
      ? "The call ended with an error. A transcript and assessment are not available yet."
      : session.status === "active" || session.status === "connecting"
        ? "This session has a call in progress or a connection awaiting confirmation."
        : "This session has not started yet.";

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Practice review</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">{session.topic.name}</h1>
          <p className="mt-2 text-sm leading-6 text-app-muted sm:text-base">Session details for {learner.name}.</p>
          <div className="mt-4"><SessionBadges session={session} /></div>
        </div>
        <div className="flex w-fit items-center gap-3 rounded-2xl border border-app-border bg-white px-4 py-3 shadow-card">
          <TutorAvatar size={48} />
          <div><p className="text-sm font-bold text-app-text">{session.tutor.name}</p><p className="mt-0.5 text-xs font-medium text-app-muted">{session.tutor.role}</p></div>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8" aria-labelledby="review-status">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-app-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.1em]">Overall Score</span></div>
            <h2 id="review-status" className="mt-4 text-2xl font-bold text-app-text">No review yet</h2>
            <p className="mt-2 text-sm leading-7 text-app-muted sm:text-base">{callMessage}</p>
          </div>
          <div className="flex min-w-[220px] items-center gap-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-indigo-100 text-3xl font-bold text-app-muted" aria-label="Not assessed">—</div>
            <div><p className="text-sm font-semibold text-app-muted">Session result</p><p className="mt-1 text-lg font-bold text-app-primary">Not assessed</p></div>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="text-2xl font-bold tracking-tight text-app-text">Your performance</h2>
        <p className="mb-5 mt-1 text-sm text-app-muted">Scores will appear when an assessment is available.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ name, icon: Icon }) => (
            <article key={name} className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
              <Icon className="h-6 w-6 text-app-primary" />
              <h3 className="mt-4 font-bold text-app-text">{name}</h3>
              <p className="mt-3 text-2xl font-bold text-app-muted" aria-label="No score">—</p>
              <p className="mt-2 text-sm leading-6 text-app-muted">{name === "Pronunciation" ? "No audio assessment available." : "Not assessed yet."}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <EmptyReviewSection title="Strengths" description="No feedback is available for this session yet." />
        <EmptyReviewSection title="Sentence corrections" description="No conversation has been reviewed yet." />
        <EmptyReviewSection title="Vocabulary" description="No vocabulary suggestions are available yet." />
        <EmptyReviewSection title="Tutor feedback" description="Your tutor's feedback will appear with your review." />
      </div>

      <section className="mb-8 rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6" aria-labelledby="transcript-heading">
        <div className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-app-primary" /><h2 id="transcript-heading" className="text-xl font-bold text-app-text">Conversation transcript</h2></div>
        <p className="mt-3 text-sm leading-7 text-app-muted">Conversation transcripts are not yet available in this app.</p>
      </section>

      <section className="pb-10">
        <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <Link href="/" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-app-border px-5 text-sm font-semibold text-app-text hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"><House className="h-5 w-5" />Back to Home</Link>
          <Link href={practiceSessionHref("voice-call", session.id)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-app-primary px-6 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"><Mic className="h-5 w-5" />Back to practice</Link>
        </div>
      </section>
    </main>
  );
}

function EmptyReviewSection({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-bold text-app-text">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-app-muted">{description}</p>
    </section>
  );
}
