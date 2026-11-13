"use client";

import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { LIST_SEPARATOR } from "@/lib/practice/session-setup";
import { normalizeText, textKey } from "@/lib/practice/guards";

type ChipInputProps = {
  id: string;
  label: string;
  help: string;
  values: string[];
  onChange: (values: string[]) => void;
  max: number;
  maxLength: number;
  placeholder: string;
  counter?: string;
  error?: string;
  disabled?: boolean;
};

// Enter or comma adds an item; pasted text is split on commas, semicolons and new lines.
// Items are compared case-insensitively, matching the server-side validator.
export function ChipInput({ id, label, help, values, onChange, max, maxLength, placeholder, counter, error, disabled }: ChipInputProps) {
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  function add(rawItems: string[]) {
    const next = [...values];
    let rejected: string | null = null;
    for (const raw of rawItems) {
      const item = normalizeText(raw);
      if (!item) continue;
      if (item.includes(LIST_SEPARATOR)) rejected = `"${LIST_SEPARATOR}" is not allowed inside an item.`;
      else if (item.length > maxLength) rejected = `Each item must be ${maxLength} characters or fewer.`;
      else if (next.some((value) => textKey(value) === textKey(item))) rejected = `"${item}" is already in the list.`;
      else if (next.length >= max) rejected = `You can add at most ${max} items.`;
      else next.push(item);
    }
    setHint(rejected);
    if (next.length !== values.length) onChange(next);
  }

  function commitDraft() {
    if (!draft.trim()) return;
    add([draft]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[,;\n]/.test(text)) return;
    event.preventDefault();
    add(text.split(/[,;\n]/));
  }

  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null, `${id}-help`].filter(Boolean).join(" ");
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-app-text">{label}</label>
        {counter ? <span className="text-xs font-medium text-app-muted">{counter}</span> : null}
      </div>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-app-border bg-white px-3 py-2 focus-within:border-app-primary focus-within:ring-4 focus-within:ring-indigo-100">
        {values.map((value, index) => (
          <span key={textKey(value)} className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-app-primary-light py-1 pl-3 pr-1 text-sm font-medium text-app-primary">
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, position) => position !== index))}
              disabled={disabled}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label={`Remove ${value}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setHint(null); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={commitDraft}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : "Add more…"}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="h-8 min-w-[10rem] flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-slate-400"
        />
      </div>
      <p id={`${id}-help`} className="mt-2 text-xs text-app-muted">{help}</p>
      {hint ? <p id={`${id}-hint`} className="mt-1 text-xs font-medium text-amber-700">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
