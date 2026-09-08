import { Clock3, MessagesSquare } from "lucide-react";
import type { PracticeSession } from "@/lib/practice/session";

type SessionBadgesProps = {
  session: Pick<PracticeSession, "language" | "topic" | "level" | "durationMinutes">;
};

export function SessionBadges({ session }: SessionBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-9 items-center rounded-full border border-indigo-100 bg-app-primary-light px-4 text-sm font-semibold text-app-primary">
        {session.language.name}
      </span>
      <span className="inline-flex h-9 items-center rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        {session.level}
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        <MessagesSquare className="h-4 w-4 text-app-muted" />
        {session.topic.name}
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        <Clock3 className="h-4 w-4 text-app-muted" />
        {session.durationMinutes} min planned
      </span>
    </div>
  );
}
