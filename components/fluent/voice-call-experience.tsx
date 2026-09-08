"use client";

import { useState } from "react";
import Link from "next/link";
import { Captions, Lightbulb, Mic, MicOff, Phone, PhoneOff, ScrollText, Sparkles, UserRound } from "lucide-react";
import { useDograhWidget } from "@/components/fluent/use-dograh-widget";
import { SessionBadges } from "@/components/fluent/session-badges";
import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import { UserAvatar } from "@/components/fluent/user-avatar";
import { practiceSessionHref, type PracticeSession } from "@/lib/practice/session";
import type { SessionLearner } from "@/lib/practice/read-session";

export function VoiceCallExperience({ session, learner }: { session: PracticeSession; learner: SessionLearner }) {
  const [showTranscript, setShowTranscript] = useState(true);
  const call = useDograhWidget(session);
  const busy = ["connecting", "active", "ending"].includes(call.status);
  const active = call.status === "active";
  const remaining = Math.max(0, session.durationMinutes * 60 - call.elapsed);
  const timer = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  const statusText = call.status === "ready" ? call.loaded ? "Ready to call. Press Start Call and allow microphone access." : "Loading voice connection…"
    : call.status === "connecting" ? "Connecting to your tutor. Allow microphone access if your browser asks."
    : active ? `Call in progress · ${timer} remaining`
    : call.status === "ending" ? "Ending your call…"
    : call.status === "completed" ? "Your call has ended." : "Voice call unavailable.";

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Voice practice</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">{session.topic.name}</h1>
          <p className="mt-2 text-sm leading-6 text-app-muted sm:text-base">Your {session.language.name} practice with {session.tutor.name}.</p>
        </div>
        <SessionBadges session={session} />
      </section>

      <div className="mb-5 rounded-xl border border-indigo-100 bg-app-primary-light px-5 py-4 text-sm leading-6 text-app-primary" role="status">
        {statusText}
      </div>
      {call.error ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">{call.error}</div> : null}

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-label="Practice participants">
        <article className="flex min-h-[340px] flex-col rounded-2xl border-2 border-app-primary bg-app-primary-light p-6 shadow-card sm:p-8">
          <header className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-app-primary shadow-sm"><Sparkles className="h-4 w-4" />AI Tutor</span>
            <span className="text-xs font-medium text-app-muted">Selected tutor</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100/40">
              <TutorAvatar size={80} className="border-4 border-white shadow-sm" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-app-text">{session.tutor.name}</h2>
            <p className="mt-1 text-sm font-medium text-app-muted">{session.tutor.role}</p>
            <div className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 text-sm font-semibold text-app-muted">
              <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Connected" : call.status === "connecting" ? "Connecting…" : "Not connected"}
            </div>
          </div>
        </article>

        <article className="flex min-h-[340px] flex-col rounded-2xl border border-app-border bg-white p-6 shadow-card sm:p-8">
          <header className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><UserRound className="h-4 w-4" />Learner</span>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-app-muted">{active ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{active ? "Mic active" : "Mic inactive"}</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-100">
              <UserAvatar size="lg" src={learner.photoURL} name={learner.name} className="border-4 border-white shadow-sm" />
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-app-text">{learner.name}</h2>
            <p className="mt-1 text-sm font-medium text-app-muted">You</p>
            <div className="mt-5 inline-flex h-10 items-center rounded-full border border-app-border bg-slate-50 px-4 text-sm font-semibold text-app-muted">{active ? "Speak naturally with your tutor" : busy ? "Preparing voice connection" : call.status === "ready" ? "Ready to practice" : "Practice ended"}</div>
          </div>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6" aria-labelledby="transcript-heading">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-primary-light text-app-primary"><Captions className="h-4 w-4" /></div>
            <h2 id="transcript-heading" className="text-sm font-semibold text-app-text">Conversation transcript</h2>
          </div>
          <button type="button" onClick={() => setShowTranscript((current) => !current)} aria-expanded={showTranscript} aria-controls="session-transcript" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-app-border px-3 text-sm font-semibold text-app-muted hover:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100">
            <ScrollText className="h-4 w-4" />{showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
        </header>
        {showTranscript ? <p id="session-transcript" className="mt-5 border-t border-app-border pt-5 text-sm leading-7 text-app-muted">Conversation transcripts are not yet available in this app.</p> : null}
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-app-primary-light px-4 py-3.5">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-app-primary" />
        <div><p className="text-sm font-semibold text-app-primary">Learning tip</p><p className="mt-0.5 text-sm leading-6 text-slate-600">Try to answer in complete sentences when practicing.</p></div>
      </section>

      <section className="mt-6 pb-8" aria-label="Call controls">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-app-border bg-white p-3 shadow-card sm:gap-4 sm:p-4">
          {call.status === "ready" ? <button type="button" onClick={call.start} disabled={!call.loaded} className="flex h-[60px] min-w-[156px] items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"><Phone className="h-5 w-5" />Start Call</button> : null}
          {busy ? <button type="button" onClick={call.end} disabled={call.status === "ending"} className="flex h-[60px] min-w-[156px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"><PhoneOff className="h-5 w-5" />{call.status === "ending" ? "Ending…" : "End Call"}</button> : null}
          {!busy ? <Link href={practiceSessionHref("review", session.id)} className="flex h-[60px] min-w-[156px] items-center justify-center gap-2 rounded-xl border border-app-border px-5 text-sm font-bold text-app-primary hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-200">
            <ScrollText className="h-5 w-5" />View review
          </Link> : <span className="px-4 font-mono text-xl font-semibold text-app-text" aria-label="Time remaining">{timer}</span>}
          {!busy && call.status !== "ready" ? <Link href="/" className="px-4 py-3 text-sm font-semibold text-app-primary">New practice session</Link> : null}
        </div>
      </section>
    </main>
  );
}
