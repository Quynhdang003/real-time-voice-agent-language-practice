"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AudioLines,
  Captions,
  Lightbulb,
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  ScrollText,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SessionBadges } from "@/components/fluent/session-badges";
import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import { UserAvatar } from "@/components/fluent/user-avatar";
import { cn } from "@/lib/utils";

export function VoiceCallExperience() {
  const router = useRouter();
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [isRepeating, setIsRepeating] = useState(false);

  function repeatTutorSentence() {
    setIsRepeating(true);
    window.setTimeout(() => setIsRepeating(false), 1800);
  }

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Voice practice</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">Restaurant Conversation</h1>
          <p className="mt-2 text-sm leading-6 text-app-muted sm:text-base">Practice ordering food naturally with your AI tutor.</p>
        </div>
        <SessionBadges duration="03:42" connected />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2" aria-label="Voice call participants">
        <article className="flex min-h-[340px] flex-col rounded-2xl border-2 border-app-primary bg-app-primary-light p-6 shadow-active transition sm:p-8">
          <header className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-app-primary shadow-sm"><Sparkles className="h-4 w-4" />AI Tutor</span>
            <span className="text-xs font-medium text-app-muted">Active speaker</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <div className="absolute h-40 w-40 animate-pulse rounded-full border border-indigo-200 bg-indigo-100/40" />
              <div className="absolute h-32 w-32 rounded-full border border-indigo-200 bg-indigo-100/70" />
              <div className="absolute h-24 w-24 rounded-full bg-white shadow-sm" />
              <TutorAvatar size={80} className="relative z-10 border-4 border-white shadow-sm" />
              <div className="absolute bottom-1 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border-4 border-app-primary-light bg-app-primary text-white shadow-sm"><Mic className="h-4 w-4" /></div>
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-app-text">Emma</h2>
            <p className="mt-1 text-sm font-medium text-app-muted">AI English Tutor</p>
            <div className={cn("mt-5 inline-flex h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold", isRepeating ? "border-violet-200 text-app-accent" : "border-indigo-200 text-app-primary")} aria-live="polite">
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", isRepeating ? "bg-app-accent" : "bg-app-primary")} />
                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", isRepeating ? "bg-app-accent" : "bg-app-primary")} />
              </span>
              {isRepeating ? "Speaking..." : "Listening..."}
            </div>
          </div>
        </article>

        <article className="flex min-h-[340px] flex-col rounded-2xl border border-app-border bg-white p-6 shadow-card transition sm:p-8">
          <header className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"><UserRound className="h-4 w-4" />Learner</span>
            <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", isMuted ? "text-slate-500" : "text-green-700")}>
              <span className={cn("h-2 w-2 rounded-full", isMuted ? "bg-slate-400" : "bg-app-success")} />
              {isMuted ? "Mic off" : "Mic on"}
            </span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <div className="absolute h-32 w-32 rounded-full bg-slate-100" />
              <UserAvatar size="lg" className="relative z-10 border-4 border-white bg-slate-200 shadow-sm" />
              <div className={cn("absolute bottom-2 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white text-white shadow-sm", isMuted ? "bg-slate-400" : "bg-app-success")}>{isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</div>
            </div>
            <h2 className="mt-5 text-2xl font-bold tracking-tight text-app-text">Alex</h2>
            <p className="mt-1 text-sm font-medium text-app-muted">You</p>
            <div className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-app-border bg-slate-50 px-4 text-sm font-semibold text-app-text"><AudioLines className="h-4 w-4 text-app-primary" />Your turn</div>
          </div>
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-app-border bg-white p-5 shadow-card sm:p-6" aria-labelledby="transcript-heading">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-primary-light text-app-primary"><Captions className="h-4 w-4" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-app-muted">Live conversation</p><p id="transcript-heading" className="mt-0.5 text-sm font-semibold text-app-text">Current transcript</p></div>
          </div>
          <button type="button" onClick={() => setShowTranscript((current) => !current)} aria-expanded={showTranscript} className="inline-flex h-9 items-center gap-2 rounded-lg border border-app-border bg-white px-3 text-sm font-semibold text-app-muted transition hover:border-indigo-300 hover:text-app-primary focus:outline-none focus:ring-4 focus:ring-indigo-100">
            <ScrollText className="h-4 w-4" />{showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
        </header>
        {showTranscript ? (
          <div>
            <div className="mt-5">
              <div className="flex items-center gap-2"><span className="text-sm font-bold text-app-primary">Emma</span><span className="rounded-full bg-app-primary-light px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-app-primary">Tutor</span></div>
              <p className="mt-2 text-xl font-semibold leading-8 tracking-tight text-app-text sm:text-2xl">What would you like to order today?</p>
            </div>
            <div className="mt-4 border-t border-app-border pt-4"><p className="text-sm leading-6 text-app-muted sm:text-base"><span className="font-semibold text-app-text">You:</span> I&apos;d like to order a chicken sandwich.</p></div>
          </div>
        ) : null}
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-xl border border-indigo-100 bg-app-primary-light px-4 py-3.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-app-primary"><Lightbulb className="h-4 w-4" /></div>
        <div><p className="text-sm font-semibold text-app-primary">Learning tip</p><p className="mt-0.5 text-sm leading-6 text-slate-600">Tip: Try to answer in complete sentences.</p></div>
      </section>

      <section className="mt-6 pb-8" aria-label="Call controls">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-app-border bg-white p-3 shadow-card sm:gap-4 sm:p-4">
          <ControlButton label={isMuted ? "Unmute" : "Mute"} active={isMuted} danger={isMuted} onClick={() => setIsMuted((current) => !current)} icon={isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />} />
          <ControlButton label={speakerEnabled ? "Speaker" : "Speaker off"} active={!speakerEnabled} onClick={() => setSpeakerEnabled((current) => !current)} icon={speakerEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />} />
          <ControlButton label="Repeat" onClick={repeatTutorSentence} icon={<RotateCcw className={cn("h-5 w-5", isRepeating && "animate-spin")} />} />
          <ControlButton label="Transcript" active={showTranscript} onClick={() => setShowTranscript((current) => !current)} icon={<Captions className="h-5 w-5" />} />
          <button type="button" onClick={() => router.push("/review")} className="flex h-[60px] min-w-[156px] items-center justify-center gap-2 rounded-xl bg-app-error px-5 text-sm font-bold text-white shadow-sm transition hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-100 active:scale-[0.99]">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"><PhoneOff className="h-5 w-5" /></span>End practice
          </button>
        </div>
      </section>
    </main>
  );
}

function ControlButton({ label, icon, active = false, danger = false, onClick }: { label: string; icon: React.ReactNode; active?: boolean; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("group flex h-[60px] min-w-[104px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100", danger ? "border border-red-200 bg-red-50 text-red-600" : active ? "border border-indigo-200 bg-app-primary-light text-app-primary hover:bg-indigo-100" : "border border-app-border bg-white text-app-text hover:border-indigo-300 hover:bg-app-primary-light")}>
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg transition", active ? "bg-white" : "bg-slate-100 group-hover:bg-white")}>{icon}</span>{label}
    </button>
  );
}
