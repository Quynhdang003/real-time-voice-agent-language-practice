import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { setup, review } from "./helpers/fixtures.mjs";
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

test("review API maps all errors and returns saved review", async () => {
  let result = { status: "ok", review }, user = null;
  const { POST } = loadTs("app/api/practice-session/[sessionId]/generate-review/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/server": { createPracticeSessionReview: async (id, uid) => {
      assert.equal(id, "session-a"); assert.equal(uid, "user-a"); return result;
    } },
  });
  assert.equal((await POST(request(), context)).status, 401);
  user = { id: "user-a" };
  assert.deepEqual((await (await POST(request(), context)).json()).review, review);
  for (const [status, code] of [["invalid_id", 400], ["not_found", 404], ["not_ready", 409],
    ["transcript_pending", 409], ["transcript_empty", 409], ["transcript_error", 409], ["already_processing", 409],
    ["quota", 503], ["invalid_output", 500], ["invalid_data", 500], ["unavailable", 500]]) {
    result = { status };
    const response = await POST(request(), context);
    assert.equal(response.status, code);
    assert.equal((await response.json()).reason, status);
  }
});

test("webhook API rejects missing/wrong secret and malformed JSON before ingestion", async (t) => {
  const previous = process.env.DOGRAH_WEBHOOK_SECRET;
  process.env.DOGRAH_WEBHOOK_SECRET = "test-only-secret";
  t.after(() => { if (previous === undefined) delete process.env.DOGRAH_WEBHOOK_SECRET; else process.env.DOGRAH_WEBHOOK_SECRET = previous; });
  let calls = 0, status = "ok";
  const { POST } = loadTs("app/api/dograh/transcript-webhook/route.ts", {
    "@/lib/dograh/server": { ingestDograhTranscriptWebhook: async () => { calls++; return { status }; } },
  });
  assert.equal((await POST(request())).status, 401);
  const send = (secret, body) => POST(new Request("https://app.example.test", {
    method: "POST", headers: { "x-dograh-webhook-secret": secret }, body,
  }));
  assert.equal((await send("wrong", "{}")).status, 401);
  assert.equal((await send("test-only-secret", "{")).status, 400);
  assert.equal(calls, 0);
  for (const [outcome, expected] of [["ok", 200], ["not_found", 200], ["invalid_payload", 400], ["unavailable", 500]]) {
    status = outcome; assert.equal((await send("test-only-secret", "{}")).status, expected);
  }
  delete process.env.DOGRAH_WEBHOOK_SECRET;
  assert.equal((await send("test-only-secret", "{}")).status, 401);
});
