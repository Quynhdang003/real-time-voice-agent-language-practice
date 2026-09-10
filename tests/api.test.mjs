import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { setup } from "./helpers/fixtures.mjs";
const context = { params: Promise.resolve({ sessionId: "session-a" }) };
const request = (body = {}) => new Request("https://app.example.test/api", { method: "POST", body: JSON.stringify(body) });

test("setup API authenticates, validates JSON and derives ownership from auth", async () => {
  let user = null, saved;
  const { POST } = loadTs("app/api/practice-setup/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/firebase/admin": { adminDb: { collection: () => ({ doc: () => ({ id: "session-a", set: async (doc) => { saved = doc; } }) }) } },
  });
  assert.equal((await POST(request(setup))).status, 401);
  assert.equal(saved, undefined);
  user = { id: "user-a" };
  assert.equal((await POST(new Request("https://app.example.test", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await POST(request({}))).status, 400);
  assert.equal((await POST(request({ ...setup, userId: "user-b", status: "completed" }))).status, 201);
  assert.equal(saved.userId, "user-a");
  assert.equal(saved.status, "ready");
});

test("call API maps domain outcomes and passes only authenticated identity", async () => {
  let result = { status: "ok", changed: true }, user = null;
  const { POST } = loadTs("app/api/practice-session/[sessionId]/call-event/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/server": { updatePracticeSessionCallState: async (id, uid) => {
      assert.equal(id, "session-a"); assert.equal(uid, "user-a"); return result;
    } },
  });
  assert.equal((await POST(request(), context)).status, 401);
  user = { id: "user-a" };
  for (const [status, code] of [["ok", 200], ["invalid_id", 400], ["invalid_update", 400], ["not_found", 404], ["conflict", 409], ["invalid_data", 500], ["unavailable", 500]]) {
    result = { status }; assert.equal((await POST(request(), context)).status, code);
  }
});
