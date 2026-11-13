// Dependency-free type guards and text helpers shared by the practice domain modules.
// Keep React, icons and Firebase SDKs out of this module; it runs in the browser, on the server and in tests.

// Form validation result. Keys are dotted field paths such as "setup.targetVocabulary".
export type FieldErrors = Record<string, string>;
export type Validated<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isKeyOf<T extends object>(value: unknown, target: T): value is keyof T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(target, value);
}

export function isOneOf<const T extends readonly unknown[]>(value: unknown, options: T): value is T[number] {
  return options.some((option) => option === value);
}

export function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

// Trims and collapses internal whitespace; non-strings become "".
export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

// Comparison key for case-insensitive matching of vocabulary and weak points.
export function textKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en");
}
