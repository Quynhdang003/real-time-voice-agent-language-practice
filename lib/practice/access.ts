// Access model (ACC-01…ACC-03): every account gets one 1-minute trial call; full use needs the single
// admin's approval. Pure module shared by the browser and the server; keep React and Firebase SDKs out.
import { isOneOf, isRecord, normalizeText } from "./guards.ts";
import type { FieldErrors } from "./guards.ts";
import type { CallQuotaView } from "./call-quota.ts";

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
  // LIM-01: only full (approved) accounts have a daily limit; the admin and trial accounts get null.
  quota: CallQuotaView | null;
};

export function accessViewOf(
  userId: string, access: UserAccess, adminUid: string | undefined, quota: CallQuotaView | null = null,
): AccessView {
  const level = accessLevelOf(userId, access, adminUid);
  return {
    level,
    status: access.status,
    trialUsed: access.trialUsed,
    requestedAt: access.requestedAt,
    decidedAt: access.decidedAt,
    quota: level === "full" ? quota : null,
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

// ACC-03: the single admin decides requests on /admin.
export const accessDecisions = ["approve", "reject", "revoke"] as const;
export type AccessDecision = (typeof accessDecisions)[number];

// Firebase Auth UIDs of email/password accounts; never a document path.
export function isUserId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

// approve: pending → approved; reject: pending → rejected; revoke: approved → rejected.
const decisionTransitions: Record<AccessDecision, { from: AccessStatus; to: AccessStatus }> = {
  approve: { from: "pending", to: "approved" },
  reject: { from: "pending", to: "rejected" },
  revoke: { from: "approved", to: "rejected" },
};

export type DecideAccessResult =
  | { status: "ok"; access: UserAccess; changed: boolean }
  | { status: "not_admin" | "invalid" | "not_found" | "invalid_transition" | "unavailable" };

export type DecideAccessStore = {
  adminUid: string | undefined;
  // One transaction on users/{userId} of the account being decided.
  transaction: <T>(userId: string, apply: (transaction: AccessUserTransaction) => Promise<T>) => Promise<T>;
  now: () => string;
  onError: (error: unknown) => void;
};

// POST /api/admin/access/[uid]. adminUserId comes only from the verified session cookie.
export async function decideAccess(
  adminUserId: string, targetUid: unknown, body: unknown, store: DecideAccessStore,
): Promise<DecideAccessResult> {
  if (!isAdmin(adminUserId, store.adminUid)) return { status: "not_admin" };
  const decision = isRecord(body) ? body.decision : undefined;
  if (!isUserId(targetUid) || !isOneOf(decision, accessDecisions)) return { status: "invalid" };
  // The admin's own access is never decided: it always has full access.
  if (isAdmin(targetUid, store.adminUid)) return { status: "invalid_transition" };
  const { from, to } = decisionTransitions[decision];
  try {
    return await store.transaction(targetUid, async (transaction): Promise<DecideAccessResult> => {
      const user = await transaction.readUser();
      if (!isRecord(user)) return { status: "not_found" };
      const access = parseUserAccess(user.access);
      // An identical repeat (a double click, a retried request) changes nothing.
      if (access.status === to) return { status: "ok", access, changed: false };
      if (access.status !== from) return { status: "invalid_transition" };
      const next: UserAccess = { ...access, status: to, decidedAt: store.now() };
      await transaction.writeUser({ access: next });
      return { status: "ok", access: next, changed: true };
    });
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}

// A row on /admin. Only what the admin needs to decide; no profile or session data.
export type AccessAccountRow = {
  uid: string;
  name: string;
  email: string;
  status: AccessStatus;
  trialUsed: boolean;
  requestedAt: string | null;
  requestMessage: string | null;
  decidedAt: string | null;
};

function boundedText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function toAccessAccountRow(uid: string, data: unknown): AccessAccountRow | null {
  if (!isUserId(uid) || !isRecord(data)) return null;
  const access = parseUserAccess(data.access);
  return {
    uid, name: boundedText(data.name, 200), email: boundedText(data.email, 320), status: access.status,
    trialUsed: access.trialUsed, requestedAt: access.requestedAt, requestMessage: access.requestMessage,
    decidedAt: access.decidedAt,
  };
}

// Pending: oldest request first. Approved: latest decision first. The admin account is never listed.
export function accessAccountLists(
  documents: readonly { id: string; data: unknown }[], adminUid: string | undefined,
): { pending: AccessAccountRow[]; approved: AccessAccountRow[] } {
  const rows = documents
    .map((document) => toAccessAccountRow(document.id, document.data))
    .filter((row): row is AccessAccountRow => row !== null && !isAdmin(row.uid, adminUid));
  const time = (value: string | null) => (value ? Date.parse(value) : 0);
  return {
    pending: rows.filter((row) => row.status === "pending").sort((a, b) => time(a.requestedAt) - time(b.requestedAt)),
    approved: rows.filter((row) => row.status === "approved").sort((a, b) => time(b.decidedAt) - time(a.decidedAt)),
  };
}
