"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, BookOpenText, Braces, Mic2, ScrollText, Sparkles } from "lucide-react";
import type { PracticeSession, SessionReview } from "@/lib/practice/session";

const metricIcons = { fluency: AudioLines, grammar: Braces, vocabulary: BookOpenText } as const;
const metricLabels = { fluency: "Fluency", grammar: "Grammar", vocabulary: "Vocabulary" } as const;

function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Needs practice";
}

// Transcript availability and review generation are independent axes:
// a "ready" transcript can exist while the review is still generating or has failed.
type ReviewPhase = "not_ready" | "generating" | "failed" | "done";

function reviewPhaseFor(session: PracticeSession): ReviewPhase {
  if (session.review && session.reviewStatus === "completed") return "done";
  if (session.reviewStatus === "failed") return "failed";
  if (session.dograh?.transcriptStatus !== "ready" || !session.dograh.transcript?.length) return "not_ready";
  return "generating";
}

export function ReviewPanel({ session }: { session: PracticeSession }) {
  const router = useRouter();
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>(() => reviewPhaseFor(session));
  const [errorMessage, setErrorMessage] = useState("");
  const attempted = useRef(false);

  useEffect(() => setReviewPhase(reviewPhaseFor(session)), [session]);

  const transcriptStatus = session.dograh?.transcriptStatus;

  // Poll while the webhook hasn't landed yet — Dograh delivers it asynchronously after the call ends.
  useEffect(() => {
    if (transcriptStatus !== undefined) return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [transcriptStatus, router]);

  useEffect(() => {
    if (reviewPhase !== "generating" || attempted.current) return;
    attempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/practice-session/${session.id}/generate-review`, { method: "POST" });
        const body: { success?: boolean; message?: string; reason?: string } | null = await response.json().catch(() => null);
        if (cancelled) return;
        if (response.ok && body?.success) {
          router.refresh();
          return;
        }
        if (body?.reason === "already_processing" || body?.reason === "transcript_pending") {
          setTimeout(() => { if (!cancelled) { attempted.current = false; router.refresh(); } }, 4000);
          return;
        }
        setErrorMessage(body?.message || "Unable to generate a review. Please try again.");
        setReviewPhase("failed");
      } catch {
        if (!cancelled) {
          setErrorMessage("Unable to reach the review service. Check your connection and try again.");
          setReviewPhase("failed");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reviewPhase, session.id, router]);

  const retry = () => { attempted.current = false; setErrorMessage(""); setReviewPhase("generating"); };

  const heroMessage =
    transcriptStatus === "error" ? "The transcript for this call could not be downloaded, so a review isn't available."
    : transcriptStatus === "empty" ? "No speech was detected during this call, so a review isn't available."
    : transcriptStatus === undefined ? "Your review will be generated once the transcript arrives — this can take a few seconds."
    : reviewPhase === "generating" ? "Generating your review with AI…"
    : reviewPhase === "failed" ? errorMessage
    : null;

  const review: SessionReview | undefined = reviewPhase === "done" ? session.review : undefined;

  const transcriptMessage =
    transcriptStatus === undefined ? "Your transcript is on its way — this page updates automatically."
    : transcriptStatus === "empty" ? "No speech was detected during this call, so there is no transcript to show."
    : transcriptStatus === "error" ? "We couldn't download the transcript for this call."
    : null;

  return (
    <>
      <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8" aria-labelledby="review-status">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-app-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.1em]">Overall Score</span></div>
            <h2 id="review-status" className="mt-4 text-2xl font-bold text-app-text">{review ? scoreLabel(review.overallScore) : "No review yet"}</h2>
            <p className="mt-2 text-sm leading-7 text-app-muted sm:text-base">{review ? review.tutorFeedback : heroMessage}</p>
            {reviewPhase === "failed" ? (
              <button type="button" onClick={retry} className="mt-4 inline-flex h-10 items-center rounded-lg border border-app-border px-4 text-sm font-semibold text-app-primary hover:border-indigo-300">
                Try again
              </button>
            ) : null}
          </div>
          <div className="flex min-w-[220px] items-center gap-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-indigo-100 text-3xl font-bold text-app-primary" aria-label={review ? `Score ${Math.round(review.overallScore)} out of 100` : "Not assessed"}>
              {review ? Math.round(review.overallScore) : "—"}
            </div>
            <div><p className="text-sm font-semibold text-app-muted">Session result</p><p className="mt-1 text-lg font-bold text-app-primary">{review ? scoreLabel(review.overallScore) : "Not assessed"}</p></div>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="text-2xl font-bold tracking-tight text-app-text">Your performance</h2>
        <p className="mb-5 mt-1 text-sm text-app-muted">{review ? "Scores from your latest reviewed session." : "Scores will appear when an assessment is available."}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["fluency", "grammar", "vocabulary"] as const).map((key) => {
            const Icon = metricIcons[key];
            const score = review?.metrics[key];
            return (
              <article key={key} className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
                <Icon className="h-6 w-6 text-app-primary" />
                <h3 className="mt-4 font-bold text-app-text">{metricLabels[key]}</h3>
                <p className="mt-3 text-2xl font-bold text-app-muted" aria-label={score !== undefined ? `Score ${Math.round(score)}` : "No score"}>
                  {score !== undefined ? Math.round(score) : "—"}
                </p>
                <p className="mt-2 text-sm leading-6 text-app-muted">{score !== undefined ? "Assessed from this session." : "Not assessed yet."}</p>
              </article>
            );
          })}
          <article className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
            <Mic2 className="h-6 w-6 text-app-primary" />
            <h3 className="mt-4 font-bold text-app-text">Pronunciation</h3>
            <p className="mt-3 text-2xl font-bold text-app-muted" aria-label="No score">—</p>
            <p className="mt-2 text-sm leading-6 text-app-muted">No audio assessment available.</p>
          </article>
        </div>
      </section>

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Strengths</h2>
          {review ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-app-muted">
              {review.strengths.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm leading-7 text-app-muted">No feedback is available for this session yet.</p>}
        </section>

        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Sentence corrections</h2>
          {review ? (
            review.corrections.length > 0 ? (
              <ul className="mt-3 space-y-4 text-sm leading-6">
                {review.corrections.map((item, index) => (
                  <li key={index} className="rounded-xl border border-app-border p-3">
                    <p className="text-red-600 line-through">{item.original}</p>
                    <p className="mt-1 font-semibold text-emerald-700">{item.corrected}</p>
                    <p className="mt-1 text-app-muted">{item.explanation}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm leading-7 text-app-muted">No corrections needed — nice work!</p>
          ) : <p className="mt-3 text-sm leading-7 text-app-muted">No conversation has been reviewed yet.</p>}
        </section>

        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Vocabulary</h2>
          {review && review.vocabulary.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {review.vocabulary.map((item, index) => (
                <li key={index}><span className="font-semibold text-app-text">{item.word}</span> — <span className="text-app-muted">{item.definition}</span></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm leading-7 text-app-muted">No vocabulary suggestions are available yet.</p>}
        </section>

        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Tutor feedback</h2>
          <p className="mt-3 text-sm leading-7 text-app-muted">{review ? review.tutorFeedback : "Your tutor's feedback will appear with your review."}</p>
        </section>
      </div>

      <section className="mb-8 rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6" aria-labelledby="transcript-heading">
        <div className="flex items-center gap-2"><ScrollText className="h-5 w-5 text-app-primary" /><h2 id="transcript-heading" className="text-xl font-bold text-app-text">Conversation transcript</h2></div>
        {transcriptMessage ? (
          <p className="mt-3 text-sm leading-7 text-app-muted">{transcriptMessage}</p>
        ) : (
          <ol className="mt-4 space-y-3 border-t border-app-border pt-4 text-sm leading-6">
            {session.dograh?.transcript?.map((turn, index) => (
              <li key={index} className={turn.role === "tutor" ? "text-app-text" : "text-app-muted"}>
                <span className="font-semibold">{turn.role === "tutor" ? session.tutor.name : "You"}: </span>
                <span className="whitespace-pre-line">{turn.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}