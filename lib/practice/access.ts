// Access model (ACC-01…ACC-03): every account gets one 1-minute trial call; full use needs the single
// admin's approval. Pure module shared by the browser and the server; keep React and Firebase SDKs out.
import { isOneOf, isRecord } from "./guards.ts";

export const accessStatuses = ["none", "pending", "approved", "rejected"] as const;
export const sessionKinds = ["trial", "full"] as const;
export const TRIAL_DURATION_MINUTES = 1;
export const ACCESS_REQUEST_MESSAGE_MAX = 300;

export type AccessStatus = (typeof accessStatuses)[number];
export type SessionKind = (typeof sessionKinds)[number];
export type TrialDuration = typeof TRIAL_DURATION_MINUTES;

// Stored on users/{uid}.access. Timestamps are ISO strings written by server code, like dograh.startedAt.
export type UserAccess = {
  status: AccessStatus;
  trialUsed: boolean;
  requestedAt: string | null;
  requestMessage: string | null;
  decidedAt: string | null;
};

// admin: the ADMIN_UID account; full: approved; trial: trial not used yet; blocked: trial used, not approved.
export type AccessLevel = "admin" | "full" | "trial" | "blocked";

// Accounts created before ACC-01 have no access field: they start with an unused trial.
export const initialAccess: UserAccess = {
  status: "none", trialUsed: false, requestedAt: null, requestMessage: null, decidedAt: null,
};

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
}

// Lenient field by field: a corrupt field falls back to its initial value, but a used trial stays used.
export function parseUserAccess(value: unknown): UserAccess {
  if (!isRecord(value)) return { ...initialAccess };
  const message = value.requestMessage;
  return {
    status: isOneOf(value.status, accessStatuses) ? value.status : "none",
    trialUsed: value.trialUsed === true,
    requestedAt: isoOrNull(value.requestedAt),
    requestMessage: typeof message === "string" && message.length > 0 && message.length <= ACCESS_REQUEST_MESSAGE_MAX
      ? message : null,
    decidedAt: isoOrNull(value.decidedAt),
  };
}

// The admin is identified only on the server, from the verified session cookie's uid and ADMIN_UID.
export function isAdmin(userId: string, adminUid: string | undefined): boolean {
  const admin = adminUid?.trim();
  return Boolean(admin) && userId === admin;
}

export function accessLevelOf(userId: string, access: UserAccess, adminUid: string | undefined): AccessLevel {
  if (isAdmin(userId, adminUid)) return "admin";
  if (access.status === "approved") return "full";
  return access.trialUsed ? "blocked" : "trial";
}

// The session kind an account may create next; null means it needs the admin's approval first.
export function sessionKindFor(level: AccessLevel): SessionKind | null {
  if (level === "blocked") return null;
  return level === "trial" ? "trial" : "full";
}
