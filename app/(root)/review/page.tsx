import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { House, Mic } from "lucide-react";
import { SessionBadges } from "@/components/fluent/session-badges";
import { SessionAccessNotice } from "@/components/fluent/session-access-notice";
import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import { ReviewPanel } from "@/components/fluent/review-panel";
import { getPracticeSession } from "@/lib/practice/server";
import { practiceSessionHref } from "@/lib/practice/session";

export const metadata: Metadata = { title: "Practice Review" };

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const result = await getPracticeSession((await searchParams).sessionId);
  if (result.status === "unauthenticated") redirect("/sign-in");
  if (result.status !== "ok") return <SessionAccessNotice status={result.status} />;
  const { session, learner } = result;

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

      {session.status === "completed" ? (
        <ReviewPanel session={session} />
      ) : (
        <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8">
          <h2 className="text-2xl font-bold text-app-text">No review yet</h2>
          <p className="mt-2 text-sm leading-7 text-app-muted sm:text-base">
            {session.status === "failed"
              ? "The call ended with an error. A transcript and assessment are not available yet."
              : session.status === "active" || session.status === "connecting"
                ? "This session has a call in progress or a connection awaiting confirmation."
                : "This session has not started yet."}
          </p>
        </section>
      )}

      <section className="pb-10">
        <div className="flex flex-col gap-3 rounded-2xl border border-app-border bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <Link href="/" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-app-border px-5 text-sm font-semibold text-app-text hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100"><House className="h-5 w-5" />Back to Home</Link>
          <Link href={practiceSessionHref("voice-call", session.id)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-app-primary px-6 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"><Mic className="h-5 w-5" />Back to practice</Link>
        </div>
      </section>
    </main>
  );
}