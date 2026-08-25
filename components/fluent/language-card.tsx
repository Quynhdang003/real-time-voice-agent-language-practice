import { Check } from "lucide-react";
import type { Language } from "@/components/fluent/types";
import { cn } from "@/lib/utils";

type LanguageCardProps = {
  language: Language;
  selected: boolean;
  onSelect: () => void;
};

export function LanguageCard({ language, selected, onSelect }: LanguageCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-2xl p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-indigo-100",
        selected
          ? "border-2 border-app-primary bg-indigo-50 shadow-sm hover:bg-indigo-100"
          : "border border-app-border bg-white shadow-card hover:border-indigo-300 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl text-3xl",
              selected ? "bg-white shadow-sm" : "bg-slate-50",
            )}
          >
            {language.flag}
          </div>
          <div>
            <h3 className="text-lg font-bold text-app-text">{language.name}</h3>
            <p className="mt-1 text-sm text-app-muted">{language.level}</p>
          </div>
        </div>
        {selected ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-app-primary text-white">
            <Check className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-app-muted">Learning progress</span>
          <span className={cn("font-semibold", selected ? "text-app-primary" : "text-app-text")}>
            {language.progress}%
          </span>
        </div>
        <div className={cn("h-2 overflow-hidden rounded-full", selected ? "bg-indigo-100" : "bg-slate-100")}>
          <div
            className={cn("h-full rounded-full", selected ? "bg-app-primary" : "bg-slate-300")}
            style={{ width: `${language.progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}
