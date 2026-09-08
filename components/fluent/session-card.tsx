import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { PracticeSessionSummary } from "@/components/fluent/types";
import { cn } from "@/lib/utils";

export function SessionCard({ session }: { session: PracticeSessionSummary }) {
  const Icon = session.icon;
  return (
    <article className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", session.iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold",
            session.score >= 80 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600",
          )}
        >
          Score {session.score}
        </span>
      </div>
      <h3 className="mt-5 text-base font-bold text-app-text">{session.title}</h3>
      <p className="mt-2 text-sm text-app-muted">
        {session.language} • {session.level}
      </p>
      <div className="mt-5 flex items-center justify-between border-t border-app-border pt-4">
        <div className="flex items-center gap-2 text-sm text-app-muted">
          <Clock3 className="h-4 w-4" />
          {session.duration}
        </div>
        <Link href="/review" className="text-sm font-semibold text-app-primary hover:text-indigo-700">
          Review
        </Link>
      </div>
    </article>
  );
}
