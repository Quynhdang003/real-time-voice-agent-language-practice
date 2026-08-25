import type { Topic } from "@/components/fluent/types";
import { cn } from "@/lib/utils";

type TopicCardProps = {
  topic: Topic;
  selected: boolean;
  onSelect: () => void;
};

export function TopicCard({ topic, selected, onSelect }: TopicCardProps) {
  const Icon = topic.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-xl px-4 py-4 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
        selected
          ? "border-2 border-app-primary bg-indigo-50 hover:bg-indigo-100"
          : "border border-app-border bg-white hover:border-indigo-300 hover:bg-slate-50",
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            selected ? "bg-white text-app-primary" : "bg-slate-100 text-slate-600",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-app-text">{topic.name}</span>
      </span>
    </button>
  );
}
