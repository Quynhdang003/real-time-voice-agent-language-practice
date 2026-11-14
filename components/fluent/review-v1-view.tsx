import { AudioLines, BookOpenText, Braces, Sparkles } from "lucide-react";
import type { SessionReview } from "@/lib/practice/session";

const metricIcons = { fluency: AudioLines, grammar: Braces, vocabulary: BookOpenText } as const;
const metricLabels = { fluency: "Fluency", grammar: "Grammar", vocabulary: "Vocabulary" } as const;

function scoreLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Needs practice";
}

// A review generated before RV-01 (0–100 metrics, English only). New reviews use ReviewV2View.
export function ReviewV1View({ review }: { review: SessionReview }) {
  return (
    <>
      <section className="mb-8 rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-6 shadow-highlight sm:p-8" aria-labelledby="review-score">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-app-primary"><Sparkles className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-[0.1em]">Overall Score</span></div>
            <h2 id="review-score" className="mt-4 text-2xl font-bold text-app-text">{scoreLabel(review.overallScore)}</h2>
            <p className="mt-2 text-sm leading-7 text-app-muted sm:text-base">{review.tutorFeedback}</p>
            <p className="mt-3 text-xs text-app-muted">This review uses the earlier format, from before bilingual reviews.</p>
          </div>
          <div className="flex min-w-[220px] items-center gap-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-indigo-100 text-3xl font-bold text-app-primary" aria-label={`Score ${Math.round(review.overallScore)} out of 100`}>
              {Math.round(review.overallScore)}
            </div>
            <div><p className="text-sm font-semibold text-app-muted">Session result</p><p className="mt-1 text-lg font-bold text-app-primary">{scoreLabel(review.overallScore)}</p></div>
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="performance-heading">
        <h2 id="performance-heading" className="text-2xl font-bold tracking-tight text-app-text">Your performance</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["fluency", "grammar", "vocabulary"] as const).map((key) => {
            const Icon = metricIcons[key];
            const score = review.metrics[key];
            return (
              <article key={key} className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
                <Icon className="h-6 w-6 text-app-primary" />
                <h3 className="mt-4 font-bold text-app-text">{metricLabels[key]}</h3>
                <p className="mt-3 text-2xl font-bold text-app-muted" aria-label={`Score ${Math.round(score)}`}>{Math.round(score)}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="mb-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Strengths</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-app-muted">
            {review.strengths.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </section>
        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Sentence corrections</h2>
          {review.corrections.length > 0 ? (
            <ul className="mt-3 space-y-4 text-sm leading-6">
              {review.corrections.map((item, index) => (
                <li key={index} className="rounded-xl border border-app-border p-3">
                  <p className="text-red-600 line-through">{item.original}</p>
                  <p className="mt-1 font-semibold text-emerald-700">{item.corrected}</p>
                  <p className="mt-1 text-app-muted">{item.explanation}</p>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm leading-7 text-app-muted">No corrections needed — nice work!</p>}
        </section>
        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Vocabulary</h2>
          {review.vocabulary.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {review.vocabulary.map((item, index) => (
                <li key={index}><span className="font-semibold text-app-text">{item.word}</span> — <span className="text-app-muted">{item.definition}</span></li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm leading-7 text-app-muted">No vocabulary suggestions.</p>}
        </section>
        <section className="rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-xl font-bold text-app-text">Tutor feedback</h2>
          <p className="mt-3 text-sm leading-7 text-app-muted">{review.tutorFeedback}</p>
        </section>
      </div>
    </>
  );
}
