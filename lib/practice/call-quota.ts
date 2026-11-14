// LIM-01: daily call limit for approved learners. Pure module shared by the browser (display) and the
// server (enforcement in the session-creation transaction); keep React and Firebase SDKs out.
import { isRecord } from "./guards.ts";

export const DEFAULT_DAILY_CALL_LIMIT = 5;
// The day is the calendar day in Asia/Ho_Chi_Minh. Vietnam has no daylight saving time, so it is always UTC+7.
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Stored on users/{uid}.callQuota; written only by the session-creation transaction.
export type CallQuota = { day: string; used: number };
export type CallQuotaView = { limit: number; used: number; remaining: number; resetsAt: string };
export type ConsumeCallResult = { ok: true; quota: CallQuota } | { ok: false; limit: number; resetsAt: string };

// PRACTICE_DAILY_CALL_LIMIT: a positive integer; unset or invalid → 5.
export function dailyCallLimit(raw: string | undefined): number {
  const value = raw?.trim() ?? "";
  if (!/^\d+$/.test(value)) return DEFAULT_DAILY_CALL_LIMIT;
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 ? limit : DEFAULT_DAILY_CALL_LIMIT;
}

// "YYYY-MM-DD" in Vietnam time.
export function quotaDay(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

// The next local midnight, as an ISO time.
export function quotaResetsAt(now: Date): string {
  return new Date(Date.parse(`${quotaDay(now)}T00:00:00.000Z`) + DAY_MS - VIETNAM_OFFSET_MS).toISOString();
}

export function parseCallQuota(value: unknown): CallQuota | null {
  if (!isRecord(value) || typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  return typeof value.used === "number" && Number.isSafeInteger(value.used) && value.used >= 0
    ? { day: value.day, used: value.used } : null;
}

// A missing or malformed quota, or one from another day, means no call used today.
export function callsUsedToday(stored: unknown, now: Date): number {
  const quota = parseCallQuota(stored);
  return quota && quota.day === quotaDay(now) ? quota.used : 0;
}

export function callQuotaView(stored: unknown, now: Date, limit: number): CallQuotaView {
  const used = callsUsedToday(stored, now);
  return { limit, used, remaining: Math.max(0, limit - used), resetsAt: quotaResetsAt(now) };
}

// One created session = one call. Used calls are never given back: call events come from the browser.
export function consumeCall(stored: unknown, now: Date, limit: number): ConsumeCallResult {
  const used = callsUsedToday(stored, now);
  if (used >= limit) return { ok: false, limit, resetsAt: quotaResetsAt(now) };
  return { ok: true, quota: { day: quotaDay(now), used: used + 1 } };
}
