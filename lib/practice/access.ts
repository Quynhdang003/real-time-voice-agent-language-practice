// Access model (ACC-01…ACC-03): every account gets one 1-minute trial call; full use needs the single
// admin's approval. Pure module shared by the browser and the server; keep React and Firebase SDKs out.
import { isOneOf, isRecord, normalizeText } from "./guards.ts";
import type { FieldErrors } from "./guards.ts";

export const accessStatuses = ["none", "pending", "approved", "rejected"] as const;
export const sessionKinds = ["trial", "full"] as const;
export const TRIAL_DURATION_MINUTES = 1;
export const ACCESS_REQUEST_MESSAGE_MAX = 300;
// Learners are in Vietnam. A fixed zone gives the same text when rendered on the server (UTC on Vercel) and in the browser.
export const ACCESS_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function formatAccessDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ACCESS_TIME_ZONE });
}

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

// What the home page shows (ACC-02). Display only: the server decides again when a session is created.
export type AccessView = {
  level: AccessLevel;
  status: AccessStatus;
  trialUsed: boolean;
  requestedAt: string | null;
  decidedAt: string | null;
};

export function accessViewOf(userId: string, access: UserAccess, adminUid: string | undefined): AccessView {
  return {
    level: accessLevelOf(userId, access, adminUid),
    status: access.status,
    trialUsed: access.trialUsed,
    requestedAt: access.requestedAt,
    decidedAt: access.decidedAt,
  };
}

// A learner may request full access while it is neither pending nor approved (and the admin never needs to).
export function canRequestAccess(view: Pick<AccessView, "level" | "status">): boolean {
  return view.level !== "admin" && (view.status === "none" || view.status === "rejected");
}

export type RequestAccessResult =
  | { status: "ok"; access: UserAccess }
  | { status: "invalid"; fieldErrors: FieldErrors }
  | { status: "already_pending" | "already_approved" | "unavailable" };

// One Firestore transaction on users/{userId}: the read happens before the write.
export type AccessUserTransaction = {
  readUser: () => Promise<unknown>;
  writeUser: (patch: Record<string, unknown>) => void | Promise<void>;
};

export type RequestAccessStore = {
  adminUid: string | undefined;
  transaction: <T>(apply: (transaction: AccessUserTransaction) => Promise<T>) => Promise<T>;
  now: () => string;
  onError: (error: unknown) => void;
};

// Body {message?}: an optional note for the admin, trimmed, at most ACCESS_REQUEST_MESSAGE_MAX characters.
function parseRequestMessage(body: unknown): { ok: true; message: string | null } | { ok: false; error: string } {
  const value = isRecord(body) ? body.message : undefined;
  if (value !== undefined && value !== null && typeof value !== "string") return { ok: false, error: "The message must be text." };
  const message = typeof value === "string" ? value.trim() : "";
  if (message.length > ACCESS_REQUEST_MESSAGE_MAX) {
    return { ok: false, error: `Keep the message to ${ACCESS_REQUEST_MESSAGE_MAX} characters or fewer.` };
  }
  return { ok: true, message: message ? normalizeText(message) : null };
}

// POST /api/access-request: none / rejected → pending. userId comes only from the verified session cookie.
export async function requestAccess(userId: string, body: unknown, store: RequestAccessStore): Promise<RequestAccessResult> {
  const parsed = parseRequestMessage(body);
  if (!parsed.ok) return { status: "invalid", fieldErrors: { message: parsed.error } };
  if (isAdmin(userId, store.adminUid)) return { status: "already_approved" };
  try {
    return await store.transaction(async (transaction): Promise<RequestAccessResult> => {
      const user = await transaction.readUser();
      const access = parseUserAccess(isRecord(user) ? user.access : undefined);
      if (access.status === "pending") return { status: "already_pending" };
      if (access.status === "approved") return { status: "already_approved" };
      const next: UserAccess = {
        ...access, status: "pending", requestedAt: store.now(), requestMessage: parsed.message, decidedAt: null,
      };
      await transaction.writeUser({ access: next });
      return { status: "ok", access: next };
    });
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
