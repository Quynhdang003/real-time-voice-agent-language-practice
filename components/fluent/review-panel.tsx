"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircleMinus, Clock, LoaderCircle, RefreshCw, ScrollText, TriangleAlert } from "lucide-react";
import { isReviewV2 } from "@/lib/practice/session";
import type { PracticeSession } from "@/lib/practice/session";
import { REVIEW_POLL_INTERVAL_MS, REVIEW_WAIT_LIMIT_MS, generateStepFor, reviewPageStateOf } from "@/lib/practice/review-view";
import type { ReviewPageState } from "@/lib/practice/review-view";
import { cn } from "@/lib/utils";
import { ReviewV1View } from "./review-v1-view";
import { ReviewV2View } from "./review-v2-view";

// Local overrides of the server state. The page remounts this panel (React key = reviewStateKey) whenever the
// stored transcript or review status changes, so these never outlive the data they describe.
type LocalState =
  | { kind: "follow" }
  | { kind: "stalled"; phase: "transcript" | "review" }
  | { kind: "failed"; message: string }
  | { kind: "final"; state: "no_speech" | "transcript_error" };

type Shown = ReviewPageState | "stalled";

const FALLBACK_ERROR = "Unable to generate a review. Please try again.";

export function ReviewPanel({ session }: { session: PracticeSession }) {
  const router = useRouter();
  const serverState = reviewPageStateOf(session);
  const [local, setLocal] = useState<LocalState>({ kind: "follow" });
  // A stored failure starts a new attempt only when the learner asks (Try again).
  const [retryRequested, setRetryRequested] = useState(false);
  // Bumped to run the polling effects again (Check again, or the next poll after a busy answer).
  const [round, setRound] = useState(0);
  const waitingSince = useRef<number | null>(null);

  const shown: Shown = local.kind === "failed" ? "failed"
    : local.kind === "stalled" ? "stalled"
    : local.kind === "final" ? local.state
    : serverState === "failed" && retryRequested ? "generating"
    : serverState;

  // Waiting for the webhook: refresh the server data until the transcript arrives (N-02a: not forever).
  useEffect(() => {
    if (shown !== "waiting_transcript") return;
    const started = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - started >= REVIEW_WAIT_LIMIT_MS) {
        clearInterval(interval);
        setLocal({ kind: "stalled", phase: "transcript" });
        return;
      }
      router.refresh();
    }, REVIEW_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shown, round, router]);

  // The transcript is ready: ask for the review. While another tab or the webhook's background review holds
  // the claim, ask again every few seconds (N-02b) until it is saved or the wait limit passes.
  useEffect(() => {
    if (shown !== "generating") return;
    waitingSince.current ??= Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      let ok = false;
      let reason: string | undefined;
      let message: string | undefined;
      try {
        const response = await fetch(`/api/practice-session/${encodeURIComponent(session.id)}/generate-review`, { method: "POST" });
        const body: { success?: boolean; reason?: string; message?: string } | null = await response.json().catch(() => null);
        ok = response.ok && body?.success === true;
        reason = body?.reason;
        message = body?.message;
      } catch {
        if (!cancelled) setLocal({ kind: "failed", message: "Unable to reach the review service. Check your connection and try again." });
        return;
      }
      if (cancelled) return;
      const step = generateStepFor({ ok, reason });
      if (step === "refresh") {
        router.refresh();
      } else if (step === "retry_later") {
        if (Date.now() - (waitingSince.current ?? Date.now()) >= REVIEW_WAIT_LIMIT_MS) {
          setLocal({ kind: "stalled", phase: "review" });
          return;
        }
        timer = setTimeout(() => {
          router.refresh();
          setRound((value) => value + 1);
        }, REVIEW_POLL_INTERVAL_MS);
      } else if (step === "failed") {
        setLocal({ kind: "failed", message: message || FALLBACK_ERROR });
      } else {
        setLocal({ kind: "final", state: step });
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [shown, round, session.id, router]);

  const startOver = () => {
    waitingSince.current = null;
    setRetryRequested(true);
    setLocal({ kind: "follow" });
    setRound((value) => value + 1);
    router.refresh();
  };

  const review = shown === "done" ? session.review : undefined;
  const transcriptMessage =
    session.dograh?.transcriptStatus === undefined ? "Your transcript is on its way — this page updates automatically."
    : session.dograh.transcriptStatus === "empty" ? "No speech was detected during this call, so there is no transcript to show."
    : session.dograh.transcriptStatus === "error" ? "We couldn't download the transcript for this call."
    : null;

  return (
    <>
      {shown !== "done" ? (
        <StateBanner shown={shown} local={local} onRetry={startOver} />
      ) : review ? (
        isReviewV2(review) ? <ReviewV2View review={review} level={session.level} /> : <ReviewV1View review={review} />
      ) : null}

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

type BannerContent = { tone: "indigo" | "red" | "slate" | "amber"; icon: ReactNode; title: string; text: string; action?: string };

function bannerFor(shown: Exclude<Shown, "done">, local: LocalState): BannerContent {
  switch (shown) {
    case "waiting_transcript":
      return { tone: "indigo", icon: <Clock className="h-5 w-5" />, title: "Waiting for the transcript",
        text: "Dograh sends the transcript shortly after the call ends. This page updates by itself." };
    case "generating":
      return { tone: "indigo", icon: <LoaderCircle className="h-5 w-5 animate-spin" />, title: "Generating your review",
        text: "This usually takes under a minute. You can leave this page: the review is saved when it is ready." };
    case "stalled":
      return { tone: "amber", icon: <Clock className="h-5 w-5" />, title: "This is taking longer than usual",
        text: local.kind === "stalled" && local.phase === "transcript"
          ? "The transcript has not arrived yet. Check again in a few minutes."
          : "The review is still being generated. Check again in a minute.",
        action: "Check again" };
    case "failed":
      return { tone: "red", icon: <TriangleAlert className="h-5 w-5" />, title: "The review could not be generated",
        text: local.kind === "failed" ? local.message : FALLBACK_ERROR, action: "Try again" };
    case "transcript_error":
      return { tone: "red", icon: <TriangleAlert className="h-5 w-5" />, title: "No transcript",
        text: "We couldn't download the transcript for this call, so a review isn't available." };
    case "no_speech":
      return { tone: "slate", icon: <CircleMinus className="h-5 w-5" />, title: "Nothing to review",
        text: "No speech from you was detected in this call, so there is nothing to review." };
  }
}

const bannerTones = {
  indigo: "border-indigo-100 bg-gradient-to-r from-white to-indigo-50 text-app-primary",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-app-border bg-white text-app-muted",
} as const;

function StateBanner({ shown, local, onRetry }: { shown: Exclude<Shown, "done">; local: LocalState; onRetry: () => void }) {
  const content = bannerFor(shown, local);
  const isAlert = content.tone === "red";
  return (
    <section className={cn("mb-8 rounded-2xl border p-6 shadow-highlight sm:p-8", bannerTones[content.tone])}
      role={isAlert ? "alert" : "status"} aria-labelledby="review-state-title">
      <div className="flex items-center gap-2">{content.icon}<h2 id="review-state-title" className="text-xl font-bold text-app-text">{content.title}</h2></div>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-app-muted sm:text-base">{content.text}</p>
      {content.action ? (
        <button type="button" onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-app-border bg-white px-4 text-sm font-semibold text-app-primary hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100">
          <RefreshCw className="h-4 w-4" />{content.action}
        </button>
      ) : null}
    </section>
  );
}
