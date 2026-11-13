import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { profileV2, setupV2, documentV2 } from "./helpers/fixtures.mjs";

const access = loadTs("lib/practice/access.ts");
const { createPracticeSessionForUser } = loadTs("lib/practice/create-session.ts");
const domain = loadTs("lib/practice/session.ts");
const { validatePracticeSetupRequest } = loadTs("lib/practice/session-setup.ts");

const body = { profile: profileV2, setup: setupV2 };

// In-memory Firestore: transactions run one at a time, like Firestore's serializable transactions.
function memoryStore({ users = {}, adminUid } = {}) {
  const state = { users: structuredClone(users), sessions: {}, nextId: 1, writes: 0 };
  let queue = Promise.resolve();
  const store = {
    adminUid,
    onError() {},
    transaction: (apply) => {
      const run = queue.then(() => apply({
        readUser: async () => state.users[store.userId],
        writeUser: (patch) => {
          state.writes++;
          state.users[store.userId] = { ...state.users[store.userId], ...structuredClone(patch) };
        },
        createSession: (document) => {
          state.writes++;
          const id = `session-${state.nextId++}`;
          state.sessions[id] = structuredClone(document);
          return id;
        },
      }));
      queue = run.catch(() => undefined);
      return run;
    },
  };
  const create = (userId, requestBody = body) => {
    store.userId = userId;
    return createPracticeSessionForUser(userId, requestBody, store);
  };
  return { state, store, create };
}

test("access is parsed leniently; a missing field means an unused trial", () => {
  assert.deepEqual(access.parseUserAccess(undefined), access.initialAccess);
  assert.deepEqual(access.parseUserAccess({ status: "weird", trialUsed: "yes" }), access.initialAccess);
  const parsed = access.parseUserAccess({ status: "pending", trialUsed: true, requestedAt: "2026-11-13T10:00:00.000Z",
    requestMessage: "x".repeat(301), decidedAt: "not a date" });
  assert.equal(parsed.status, "pending");
  assert.equal(parsed.trialUsed, true);
  assert.equal(parsed.requestedAt, "2026-11-13T10:00:00.000Z");
  assert.equal(parsed.requestMessage, null);
  assert.equal(parsed.decidedAt, null);
});

test("the admin comes only from ADMIN_UID; unset or blank means nobody is admin", () => {
  assert.equal(access.isAdmin("uid-admin", "uid-admin"), true);
  assert.equal(access.isAdmin("uid-admin", " uid-admin "), true);
  for (const adminUid of [undefined, "", "   ", "someone-else"]) assert.equal(access.isAdmin("uid-admin", adminUid), false);
});

test("access level: admin > approved > unused trial > blocked", () => {
  const level = (status, trialUsed, userId = "u") => access.accessLevelOf(userId, { ...access.initialAccess, status, trialUsed }, "admin");
  assert.equal(level("none", true, "admin"), "admin");
  assert.equal(level("approved", true), "full");
  assert.equal(level("none", false), "trial");
  assert.equal(level("pending", false), "trial");
  for (const status of ["none", "pending", "rejected"]) assert.equal(level(status, true), "blocked");
  assert.equal(access.sessionKindFor("blocked"), null);
  assert.equal(access.sessionKindFor("trial"), "trial");
  assert.equal(access.sessionKindFor("full"), "full");
  assert.equal(access.sessionKindFor("admin"), "full");
});

test("a new account gets one 1-minute trial session, then 403 with no write", async () => {
  const { state, create } = memoryStore();
  const first = await create("user-a", { ...body, setup: { ...setupV2, durationMinutes: 20 }, kind: "full", userId: "user-b" });
  assert.deepEqual(first, { status: "ok", sessionId: "session-1", kind: "trial" });
  const session = state.sessions["session-1"];
  assert.equal(session.kind, "trial");
  assert.equal(session.durationMinutes, 1);
  assert.equal(session.userId, "user-a");
  assert.equal(state.users["user-a"].access.trialUsed, true);
  assert.equal(domain.parsePracticeSession("session-1", session).kind, "trial");

  const writes = state.writes;
  assert.deepEqual(await create("user-a"), { status: "access_required", accessStatus: "none" });
  assert.equal(state.writes, writes);
  assert.equal(Object.keys(state.sessions).length, 1);
});

test("concurrent trial setups create exactly one session", async () => {
  const { state, create } = memoryStore();
  const results = await Promise.all([create("user-a"), create("user-a"), create("user-a")]);
  assert.equal(results.filter((result) => result.status === "ok").length, 1);
  assert.equal(results.filter((result) => result.status === "access_required").length, 2);
  assert.equal(Object.keys(state.sessions).length, 1);
});

test("invalid input never uses the trial", async () => {
  const { state, create } = memoryStore();
  const invalid = await create("user-a", { profile: profileV2, setup: { ...setupV2, targetVocabulary: [] } });
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.fieldErrors["setup.targetVocabulary"]);
  assert.equal(state.writes, 0);
  assert.equal((await create("user-a")).kind, "trial");
});

test("approved accounts and the admin create full sessions with the chosen duration", async () => {
  const { state, create } = memoryStore({
    adminUid: "admin",
    users: { "user-a": { access: { status: "approved", trialUsed: true } }, admin: {} },
  });
  for (const userId of ["user-a", "admin", "admin"]) {
    const result = await create(userId);
    assert.equal(result.status, "ok");
    assert.equal(result.kind, "full");
    assert.equal(state.sessions[result.sessionId].durationMinutes, 15);
  }
  assert.equal(state.users.admin.access, undefined, "the admin's trial is never touched");
  const invalid = await create("user-a", { ...body, setup: { ...setupV2, durationMinutes: 1 } });
  assert.ok(invalid.fieldErrors["setup.durationMinutes"]);
});

test("pending or rejected accounts with a used trial need approval", async () => {
  for (const status of ["pending", "rejected"]) {
    const { create } = memoryStore({ users: { "user-a": { access: { status, trialUsed: true } } } });
    assert.deepEqual(await create("user-a"), { status: "access_required", accessStatus: status });
  }
});

test("a storage failure returns unavailable", async () => {
  const result = await createPracticeSessionForUser("user-a", body, {
    adminUid: undefined, onError() {}, transaction: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(result, { status: "unavailable" });
});

test("trial and full sessions parse strictly; sessions without kind stay full", () => {
  assert.ok(validatePracticeSetupRequest({ profile: profileV2, setup: { ...setupV2, durationMinutes: undefined } }, { kind: "trial" }).ok);
  assert.equal(validatePracticeSetupRequest({ profile: profileV2, setup: { ...setupV2, durationMinutes: 1 } }).ok, false);

  const trial = { ...domain.createPracticeSessionDocumentV2(profileV2, setupV2, "trial"), userId: "user-a" };
  assert.equal(trial.durationMinutes, 1);
  assert.equal(domain.parsePracticeSession("s", trial).durationMinutes, 1);
  assert.equal(domain.parsePracticeSession("s", { ...trial, durationMinutes: 10 }), null);
  assert.equal(domain.parsePracticeSession("s", documentV2({ durationMinutes: 1 })), null);
  assert.equal(domain.parsePracticeSession("s", documentV2({ kind: "vip" })), null);
  const legacy = documentV2();
  delete legacy.kind;
  assert.equal(domain.parsePracticeSession("s", legacy).kind, "full");
  assert.equal(domain.parsePracticeSession("s", documentV2()).kind, "full");
});

// ACC-02: access requests.
function requestStore(stored, adminUid) {
  const state = { user: structuredClone(stored), writes: 0, transactions: 0 };
  const store = {
    adminUid, now: () => "2026-11-13T09:00:00.000Z", onError() {},
    transaction: async (apply) => {
      state.transactions++;
      return apply({
        readUser: async () => state.user,
        writeUser: (patch) => { state.writes++; state.user = { ...state.user, ...structuredClone(patch) }; },
      });
    },
  };
  return { state, request: (userId, body) => access.requestAccess(userId, body, store) };
}

test("a request moves none or rejected to pending, with a trimmed optional message", async () => {
  const fresh = requestStore(undefined);
  const result = await fresh.request("user-a", { message: "  I am   a student  ", status: "approved", userId: "x" });
  assert.equal(result.status, "ok");
  assert.deepEqual(fresh.state.user.access, { status: "pending", trialUsed: false,
    requestedAt: "2026-11-13T09:00:00.000Z", requestMessage: "I am a student", decidedAt: null });

  const rejected = requestStore({ access: { status: "rejected", trialUsed: true, decidedAt: "2026-11-10T00:00:00.000Z" } });
  assert.equal((await rejected.request("user-a", {})).status, "ok");
  assert.equal(rejected.state.user.access.status, "pending");
  assert.equal(rejected.state.user.access.trialUsed, true, "the trial state is unchanged");
  assert.equal(rejected.state.user.access.decidedAt, null);
  assert.equal(rejected.state.user.access.requestMessage, null);
});

test("pending, approved and admin accounts cannot request again; bad messages are rejected", async () => {
  for (const [status, expected] of [["pending", "already_pending"], ["approved", "already_approved"]]) {
    const { state, request } = requestStore({ access: { status, trialUsed: true } });
    assert.equal((await request("user-a", {})).status, expected);
    assert.equal(state.writes, 0);
  }
  const admin = requestStore({}, "admin");
  assert.equal((await admin.request("admin", {})).status, "already_approved");
  assert.equal(admin.state.transactions, 0);
  const invalid = requestStore(undefined);
  for (const body of [{ message: "x".repeat(301) }, { message: 42 }]) {
    const result = await invalid.request("user-a", body);
    assert.equal(result.status, "invalid");
    assert.ok(result.fieldErrors.message);
  }
  assert.equal(invalid.state.transactions, 0);
  assert.equal((await invalid.request("user-a", { message: "  " + "x".repeat(300) + "  " })).status, "ok");
  const failing = await access.requestAccess("user-a", {}, { adminUid: undefined, now: () => "", onError() {},
    transaction: async () => { throw new Error("offline"); } });
  assert.deepEqual(failing, { status: "unavailable" });
});

test("the view says when a learner may request access", () => {
  const view = (status, trialUsed, userId = "u") => access.accessViewOf(userId, { ...access.initialAccess, status, trialUsed }, "admin");
  assert.equal(access.canRequestAccess(view("none", false)), true);
  assert.equal(access.canRequestAccess(view("rejected", true)), true);
  assert.equal(access.canRequestAccess(view("pending", true)), false);
  assert.equal(access.canRequestAccess(view("approved", true)), false);
  assert.equal(access.canRequestAccess(view("none", false, "admin")), false);
  assert.equal(view("none", true).level, "blocked");
  assert.equal(access.formatAccessDate("2026-11-13T18:30:00.000Z"), "14 Nov 2026", "dates use Vietnam time");
});

// ACC-03: admin decisions and lists.
function decideStore(users, adminUid = "admin") {
  const state = { users: structuredClone(users), writes: 0, transactions: 0 };
  const store = {
    adminUid, now: () => "2026-11-13T10:00:00.000Z", onError() {},
    transaction: async (userId, apply) => {
      state.transactions++;
      return apply({
        readUser: async () => state.users[userId],
        writeUser: (patch) => { state.writes++; state.users[userId] = { ...state.users[userId], ...structuredClone(patch) }; },
      });
    },
  };
  return { state, decide: (adminUserId, uid, decision) => access.decideAccess(adminUserId, uid, { decision }, store) };
}

test("the admin approves, rejects and revokes; repeats are no-ops", async () => {
  const { state, decide } = decideStore({ a: { access: { status: "pending", trialUsed: true, requestMessage: "hi" } },
    b: { access: { status: "pending" } } });
  const approved = await decide("admin", "a", "approve");
  assert.equal(approved.status, "ok");
  assert.equal(approved.changed, true);
  assert.deepEqual(state.users.a.access, { status: "approved", trialUsed: true, requestedAt: null,
    requestMessage: "hi", decidedAt: "2026-11-13T10:00:00.000Z" });
  assert.equal((await decide("admin", "a", "approve")).changed, false);
  assert.equal((await decide("admin", "a", "revoke")).access.status, "rejected");
  assert.equal((await decide("admin", "a", "revoke")).changed, false);
  assert.equal((await decide("admin", "b", "reject")).access.status, "rejected");
  assert.equal(state.writes, 3);
});

test("decisions that do not fit the state are refused without a write", async () => {
  const { state, decide } = decideStore({ none: {}, approved: { access: { status: "approved" } }, rejected: { access: { status: "rejected" } } });
  for (const [uid, decision] of [["none", "approve"], ["none", "reject"], ["none", "revoke"], ["approved", "reject"],
    ["rejected", "approve"]]) {
    assert.equal((await decide("admin", uid, decision)).status, "invalid_transition", `${uid} ${decision}`);
  }
  assert.equal((await decide("admin", "missing", "approve")).status, "not_found");
  assert.equal(state.writes, 0);
});

test("only the admin decides; bad input and the admin's own account are refused before any read", async () => {
  const { state, decide } = decideStore({ a: { access: { status: "pending" } } });
  assert.equal((await decide("user-a", "a", "approve")).status, "not_admin");
  assert.equal((await access.decideAccess("admin", "a", { decision: "approve" }, {
    adminUid: undefined, now: () => "", onError() {}, transaction: async () => { throw new Error("no"); },
  })).status, "not_admin", "without ADMIN_UID nobody is admin");
  for (const [uid, decision] of [["../a", "approve"], ["a/b", "approve"], ["a", "promote"], ["a", undefined]]) {
    assert.equal((await decide("admin", uid, decision)).status, "invalid");
  }
  assert.equal((await decide("admin", "admin", "revoke")).status, "invalid_transition");
  assert.equal(state.transactions, 0);
  const failing = await access.decideAccess("admin", "a", { decision: "approve" }, {
    adminUid: "admin", now: () => "", onError() {}, transaction: async () => { throw new Error("offline"); },
  });
  assert.deepEqual(failing, { status: "unavailable" });
});

test("admin lists: pending oldest first, approved newest first, admin and bad rows left out", () => {
  const lists = access.accessAccountLists([
    { id: "p2", data: { name: "P2", email: "p2@x", access: { status: "pending", requestedAt: "2026-11-12T00:00:00.000Z" } } },
    { id: "p1", data: { name: "P1", email: "p1@x", access: { status: "pending", requestedAt: "2026-11-10T00:00:00.000Z" } } },
    { id: "a1", data: { name: "A1", access: { status: "approved", decidedAt: "2026-11-01T00:00:00.000Z" } } },
    { id: "a2", data: { name: "A2", access: { status: "approved", decidedAt: "2026-11-11T00:00:00.000Z" } } },
    { id: "admin", data: { name: "Admin", access: { status: "pending" } } },
    { id: "bad/id", data: { access: { status: "pending" } } },
    { id: "x", data: null },
  ], "admin");
  assert.deepEqual(lists.pending.map((row) => row.uid), ["p1", "p2"]);
  assert.deepEqual(lists.approved.map((row) => row.uid), ["a2", "a1"]);
  assert.deepEqual(Object.keys(lists.pending[0]).sort(),
    ["decidedAt", "email", "name", "requestMessage", "requestedAt", "status", "trialUsed", "uid"]);
});
