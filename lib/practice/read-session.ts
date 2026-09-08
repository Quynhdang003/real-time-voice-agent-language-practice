import { isPracticeSessionId, isRecord, parsePracticeSession } from "./session.ts";
import type { PracticeSession } from "./session.ts";

type SessionUser = { id: string; name: string; photoURL: string | null };
export type SessionLearner = Pick<SessionUser, "name" | "photoURL">;
export type SessionAccessFailure = "missing_id" | "invalid_id" | "not_found" | "invalid_data" | "unavailable";
export type SessionAccessResult =
  | { status: "ok"; session: PracticeSession; learner: SessionLearner }
  | { status: "unauthenticated" }
  | { status: SessionAccessFailure };

type SessionReader = {
  getUser: () => Promise<SessionUser | null>;
  readDocument: (id: string) => Promise<unknown>;
  onError: (error: unknown) => void;
};

export function isOwnedSession(document: unknown, userId: string): document is Record<string, unknown> {
  return isRecord(document) && document.userId === userId;
}

// Dependencies are supplied only by the server adapter. No shared cache or client-supplied user ID.
export async function readPracticeSession(rawId: unknown, reader: SessionReader): Promise<SessionAccessResult> {
  try {
    const user = await reader.getUser();
    if (!user) return { status: "unauthenticated" };
    if (rawId === undefined) return { status: "missing_id" };
    if (!isPracticeSessionId(rawId)) return { status: "invalid_id" };

    const document = await reader.readDocument(rawId);
    // Do not disclose whether another user's document exists, even if it is malformed.
    if (!isOwnedSession(document, user.id)) return { status: "not_found" };
    const session = parsePracticeSession(rawId, document);
    if (!session) return { status: "invalid_data" };
    return { status: "ok", session, learner: { name: user.name, photoURL: user.photoURL } };
  } catch (error) {
    reader.onError(error);
    return { status: "unavailable" };
  }
}
