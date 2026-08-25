import { TutorAvatar } from "@/components/fluent/tutor-avatar";
import type { Tutor } from "@/components/fluent/types";
import { cn } from "@/lib/utils";

type TutorCardProps = {
  tutor: Tutor;
  selected: boolean;
  onSelect: () => void;
};

export function TutorCard({ tutor, selected, onSelect }: TutorCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "mt-4 w-full rounded-2xl border bg-app-background p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
        selected ? "border-app-primary" : "border-app-border hover:border-indigo-300",
      )}
    >
      <span className="flex items-center gap-4">
        <TutorAvatar />
        <span>
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-app-text">{tutor.name}</span>
            <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-600">
              Online
            </span>
          </span>
          <span className="mt-1 block text-sm font-medium text-app-primary">{tutor.role}</span>
        </span>
      </span>
      <span className="mt-4 block text-sm leading-6 text-app-muted">{tutor.description}</span>
      <span className="mt-5 flex flex-wrap gap-2">
        {tutor.specialties.map((specialty) => (
          <span
            key={specialty}
            className="rounded-full border border-app-border bg-white px-3 py-1.5 text-xs font-medium text-app-muted"
          >
            {specialty}
          </span>
        ))}
      </span>
    </button>
  );
}
