// Creates a practice session for the signed-in learner (POST /api/practice-setup).
// The server decides the session kind from the stored access, inside the same transaction that uses the trial,
// so a trial account never gets more than one session (ACC-01). Pure: storage is injected by lib/practice/server.ts.
import { isRecord } from "./guards.ts";
import type { FieldErrors } from "./guards.ts";
import { accessLevelOf, parseUserAccess, sessionKindFor } from "./access.ts";
import type { AccessStatus, SessionKind } from "./access.ts";
import { validatePracticeSetupRequest } from "./session-setup.ts";
import { createPracticeSessionDocumentV2 } from "./session.ts";

export type CreateSessionResult =
  | { status: "ok"; sessionId: string; kind: SessionKind }
  | { status: "invalid"; fieldErrors: FieldErrors }
  | { status: "access_required"; accessStatus: AccessStatus }
  | { status: "unavailable" };

// One Firestore transaction: every read happens before the first write.
export type CreateSessionTransaction = {
  readUser: () => Promise<unknown>;
  // Merged into users/{userId}.
  writeUser: (patch: Record<string, unknown>) => void | Promise<void>;
  // Returns the new session's ID.
  createSession: (document: Record<string, unknown>) => string | Promise<string>;
};

export type CreateSessionStore = {
  adminUid: string | undefined;
  transaction: <T>(apply: (transaction: CreateSessionTransaction) => Promise<T>) => Promise<T>;
  onError: (error: unknown) => void;
};

// userId comes only from the verified session cookie; kind, duration and ownership in the body are ignored.
export async function createPracticeSessionForUser(
  userId: string, body: unknown, store: CreateSessionStore,
): Promise<CreateSessionResult> {
  try {
    return await store.transaction(async (transaction): Promise<CreateSessionResult> => {
      const user = await transaction.readUser();
      const access = parseUserAccess(isRecord(user) ? user.access : undefined);
      const kind = sessionKindFor(accessLevelOf(userId, access, store.adminUid));
      if (!kind) return { status: "access_required", accessStatus: access.status };

      // Invalid input never uses the trial.
      const request = validatePracticeSetupRequest(body, { kind });
      if (!request.ok) return { status: "invalid", fieldErrors: request.fieldErrors };

      if (kind === "trial") await transaction.writeUser({ access: { ...access, trialUsed: true } });
      const document = { ...createPracticeSessionDocumentV2(request.value.profile, request.value.setup, kind), userId };
      const sessionId = await transaction.createSession(document);
      return { status: "ok", sessionId, kind };
    });
  } catch (error) {
    store.onError(error);
    return { status: "unavailable" };
  }
}
