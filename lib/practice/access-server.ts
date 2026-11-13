import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import {
  accessAccountLists, accessViewOf, decideAccess, initialAccess, isAdmin, parseUserAccess, requestAccess,
} from "./access";
import type { AccessAccountRow, AccessUserTransaction, AccessView } from "./access";
import { isRecord } from "./guards";

const ACCOUNT_LIST_LIMIT = 200;

// The single admin: the verified session cookie's uid equals ADMIN_UID (ACC-03). Never a client flag.
export function isAdminUser(userId: string): boolean {
  return isAdmin(userId, process.env.ADMIN_UID);
}

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

// POST /api/admin/access/[uid]. adminUserId comes from the verified session cookie.
export async function decideUserAccess(adminUserId: string, targetUid: unknown, body: unknown) {
  return decideAccess(adminUserId, targetUid, body, {
    adminUid: process.env.ADMIN_UID,
    transaction: (userId, apply) => userTransaction(userId)(apply),
    now: () => new Date().toISOString(),
    onError: logError("decide"),
  });
}

export type AccessAccountsResult =
  | { status: "ok"; pending: AccessAccountRow[]; approved: AccessAccountRow[] }
  | { status: "unavailable" };

// /admin lists. Single-field equality queries on access.status need no composite index; sorted in memory.
export async function listAccessAccounts(): Promise<AccessAccountsResult> {
  try {
    const users = adminDb.collection("users");
    const snapshots = await Promise.all((["pending", "approved"] as const).map((status) =>
      users.where("access.status", "==", status).limit(ACCOUNT_LIST_LIMIT).get()));
    const documents = snapshots.flatMap((snapshot) => snapshot.docs.map((document) => ({ id: document.id, data: document.data() })));
    return { status: "ok", ...accessAccountLists(documents, process.env.ADMIN_UID) };
  } catch (error) {
    logError("list")(error);
    return { status: "unavailable" };
  }
}

// Header badge for the admin. A failure hides the count instead of breaking every page.
export async function countPendingRequests(): Promise<number | null> {
  try {
    const snapshot = await adminDb.collection("users").where("access.status", "==", "pending").count().get();
    return snapshot.data().count;
  } catch (error) {
    logError("count")(error);
    return null;
  }
}
