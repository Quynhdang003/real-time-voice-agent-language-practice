import Link from "next/link";
import { CircleAlert, House } from "lucide-react";
import type { SessionAccessFailure } from "@/lib/practice/read-session";

const messages: Record<SessionAccessFailure, { title: string; description: string }> = {
  missing_id: {
    title: "Choose a practice session",
    description: "Start a session from the home page to open your practice details.",
  },
  invalid_id: {
    title: "Invalid practice link",
    description: "This link does not contain a valid session ID. Return home to choose a session.",
  },
  not_found: {
    title: "Practice session not found",
    description: "This session is unavailable. Return home to start a new practice.",
  },
  invalid_data: {
    title: "Unable to display this session",
    description: "The saved session details are incomplete or unsupported. Please start a new practice.",
  },
  unavailable: {
    title: "Unable to load your session",
    description: "We could not reach your session data. Please try again in a moment.",
  },
};

export function SessionAccessNotice({ status }: { status: SessionAccessFailure }) {
  const message = messages[status];
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 lg:px-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-app-border bg-white p-8 text-center shadow-card" role="alert">
        <CircleAlert className="mx-auto h-10 w-10 text-app-primary" />
        <h1 className="mt-5 text-2xl font-bold text-app-text">{message.title}</h1>
        <p className="mt-3 text-sm leading-7 text-app-muted">{message.description}</p>
        {status === "unavailable" ? <p className="mt-2 text-sm text-app-muted">Refresh this page to retry.</p> : null}
        <Link href="/" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200">
          <House className="h-4 w-4" />Back to Home
        </Link>
      </section>
    </main>
  );
}
