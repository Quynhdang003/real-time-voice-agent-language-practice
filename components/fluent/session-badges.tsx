import { Clock3, Utensils } from "lucide-react";

type SessionBadgesProps = {
  duration: string;
  connected?: boolean;
};

export function SessionBadges({ duration, connected = false }: SessionBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-9 items-center rounded-full border border-indigo-100 bg-app-primary-light px-4 text-sm font-semibold text-app-primary">
        English
      </span>
      <span className="inline-flex h-9 items-center rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        A2
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        <Utensils className="h-4 w-4 text-app-muted" />
        Restaurant
      </span>
      <span className="inline-flex h-9 items-center gap-2 rounded-full border border-app-border bg-white px-4 text-sm font-semibold text-app-text">
        <Clock3 className="h-4 w-4 text-app-muted" />
        {duration}
      </span>
      {connected ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-green-100 bg-green-50 px-4 text-sm font-semibold text-green-700">
          <span className="h-2 w-2 rounded-full bg-app-success" />
          Connected
        </span>
      ) : null}
    </div>
  );
}
