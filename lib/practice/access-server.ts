import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { accessViewOf, initialAccess, parseUserAccess, requestAccess } from "./access";
import type { AccessUserTransaction, AccessView } from "./access";
import { isRecord } from "./guards";

function logError(area: string) {
  return (error: unknown) => console.error(`[access.${area}]`, { code: error instanceof Error ? error.name : "unknown" });
}

// One transaction on users/{userId}; the merge keeps every other field of the document.
function userTransaction(userId: string) {
  return <T>(apply: (transaction: AccessUserTransaction) => Promise<T>) => adminDb.runTransaction(async (transaction) => {
    const reference = adminDb.collection("users").doc(userId);
    return apply({
      readUser: async () => {
        const snapshot = await transaction.get(reference);
        return snapshot.exists ? snapshot.data() : undefined;
      },
      writeUser: (patch) => {
        transaction.set(reference, { ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      },
    });
  });
}

// Home page banner (ACC-02). A read failure shows the default view; the server decides again on submit.
export async function getAccessView(user: { id: string }): Promise<AccessView> {
  try {
    const snapshot = await adminDb.collection("users").doc(user.id).get();
    const data = snapshot.data();
    return accessViewOf(user.id, parseUserAccess(isRecord(data) ? data.access : undefined), process.env.ADMIN_UID);
  } catch (error) {
    logError("read")(error);
    return accessViewOf(user.id, initialAccess, process.env.ADMIN_UID);
  }
}

// POST /api/access-request. userId must come from the verified session cookie, never from request JSON.
export async function requestUserAccess(userId: string, body: unknown) {
  return requestAccess(userId, body, {
    adminUid: process.env.ADMIN_UID,
    transaction: userTransaction(userId),
    now: () => new Date().toISOString(),
    onError: logError("request"),
  });
}
