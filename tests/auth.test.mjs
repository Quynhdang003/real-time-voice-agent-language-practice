import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
function harness() {
  const cookies = new Map(), sets = [], deleted = [], checks = [];
  const adminAuth = {
    verifyIdToken: async () => ({ uid: "user-a", auth_time: Math.floor(Date.now() / 1000) }),
    getUser: async () => ({ uid: "user-a", email: "a@example.test", emailVerified: true }),
    createSessionCookie: async () => "signed-cookie",
    verifySessionCookie: async (value, revoked) => { checks.push([value, revoked]); return { uid: "user-a" }; },
  };
  const api = loadTs("lib/actions/auth.action.ts", {
    "next/headers": { cookies: async () => ({ get: (name) => cookies.get(name), set: (...args) => sets.push(args), delete: (name) => deleted.push(name) }) },
    "@/firebase/admin": { adminAuth, adminDb: { collection: () => ({ doc: () => ({
      get: async () => ({ exists: true, data: () => ({ name: "Learner A" }) }), set: async () => {},
    }) }) } },
  });
  return { api, adminAuth, cookies, sets, deleted, checks };
}
test("auth returns null for missing or revoked cookie and checks revocation", async () => {
  const h = harness();
  assert.equal(await h.api.getCurrentUser(), null);
  h.cookies.set("fluentai_session", { value: "cookie" });
  assert.equal((await h.api.getCurrentUser()).id, "user-a");
  assert.deepEqual(h.checks, [["cookie", true]]);
  h.adminAuth.verifySessionCookie = async () => { throw new Error("revoked"); };
  assert.equal(await h.api.getCurrentUser(), null);
});
test("sign-in creates secure production cookie; sign-out deletes it", async (t) => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  const h = harness();
  assert.deepEqual(await h.api.signIn({ idToken: "test-token" }), { success: true });
  assert.equal(h.sets[0][2].httpOnly, true);
  assert.equal(h.sets[0][2].secure, true);
  assert.equal(h.sets[0][2].sameSite, "lax");
  await h.api.signOut();
  assert.deepEqual(h.deleted, ["fluentai_session"]);
});
test("stale authentication cannot create a session cookie", async (t) => {
  t.mock.method(console, "error", () => {});
  const h = harness();
  h.adminAuth.verifyIdToken = async () => ({ uid: "user-a", auth_time: 1 });
  assert.equal((await h.api.signIn({ idToken: "stale" })).success, false);
  assert.equal(h.sets.length, 0);
  assert.equal(h.deleted.length, 1);
});
