"use client";

import { cn } from "@/lib/utils";

type Option<T extends string | number> = { value: T; label: string };

type OptionPillsProps<T extends string | number> = {
  id: string;
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
};

// Single-choice pill group; selection is exposed with aria-pressed like the rest of the setup UI.
export function OptionPills<T extends string | number>({ id, label, options, value, onChange, error, disabled }: OptionPillsProps<T>) {
  return (
    <div>
      <p id={`${id}-label`} className="mb-2 text-sm font-semibold text-app-text">{label}</p>
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              disabled={disabled}
              className={cn(
                "h-10 rounded-full px-4 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-2 border-app-primary bg-indigo-50 text-app-primary hover:bg-indigo-100"
                  : "border border-app-border bg-white text-app-muted hover:border-indigo-300",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
