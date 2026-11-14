import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { setup, review, profileV2, setupV2 } from "./helpers/fixtures.mjs";
const context = { params: Promise.resolve({ sessionId: "session-a" }) };
const request = (body = {}) => new Request("https://app.example.test/api", { method: "POST", body: JSON.stringify(body) });

test("setup API authenticates, validates JSON and maps creation outcomes", async () => {
  let user = null, calls = [], result = { status: "ok", sessionId: "session-a", kind: "trial" };
  const { POST } = loadTs("app/api/practice-setup/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/server": { createPracticeSession: async (uid, body) => { calls.push([uid, body]); return result; } },
  });
  assert.equal((await POST(request(setup))).status, 401);
  user = { id: "user-a" };
  assert.equal((await POST(new Request("https://app.example.test", { method: "POST", body: "{" }))).status, 400);
  assert.equal(calls.length, 0);
  const created = await POST(request({ profile: profileV2, setup: setupV2, userId: "user-b" }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).sessionId, "session-a");
  assert.equal(calls[0][0], "user-a", "ownership comes from the session cookie");
  result = { status: "invalid", fieldErrors: { "profile.level": "Choose" } };
  const invalid = await POST(request({}));
  assert.equal(invalid.status, 400);
  assert.deepEqual((await invalid.json()).fieldErrors, { "profile.level": "Choose" });
  result = { status: "access_required", accessStatus: "pending" };
  const blocked = await POST(request({}));
  assert.equal(blocked.status, 403);
  const blockedBody = await blocked.json();
  assert.equal(blockedBody.reason, "access_required");
  assert.equal(blockedBody.accessStatus, "pending");
  result = { status: "unavailable" };
  assert.equal((await POST(request({}))).status, 500);
});

test("setup creation stores an English v2 document owned by the cookie user", async () => {
  const { createPracticeSessionForUser } = loadTs("lib/practice/create-session.ts");
  let saved;
  const store = { adminUid: undefined, dailyCallLimit: 5, now: () => new Date("2026-11-13T05:00:00.000Z"), onError() {}, transaction: (apply) => apply({
    readUser: async () => ({ access: { status: "approved", trialUsed: true } }),
    writeUser() {}, createSession: (document) => { saved = document; return "session-a"; },
  }) };
  const result = await createPracticeSessionForUser("user-a",
    { profile: profileV2, setup: { ...setupV2, languageId: "japanese" }, userId: "user-b", status: "completed" }, store);
  assert.equal(result.status, "ok");
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.kind, "full");
  assert.equal(saved.userId, "user-a");
  assert.equal(saved.status, "ready");
  assert.equal(saved.language.id, "english");
  assert.equal(saved.level, "B1");
  assert.equal(saved.setup.grammarFocus, null);
  // The v1 catalog body is no longer accepted (SET-04).
  assert.equal((await createPracticeSessionForUser("user-a", setup, store)).status, "invalid");
});

test("learner profile API authenticates, validates JSON and maps save outcomes", async () => {
  let user = null, result = { status: "ok", profile: { learnerName: "A" } };
  const { PUT } = loadTs("app/api/learner-profile/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/profile-server": { updateLearnerProfile: async (uid) => { assert.equal(uid, "user-a"); return result; } },
  });
  const put = (body) => PUT(new Request("https://app.example.test/api/learner-profile", { method: "PUT", body }));
  assert.equal((await put("{}")).status, 401);
  user = { id: "user-a" };
  assert.equal((await put("{")).status, 400);
  const ok = await put("{}");
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).profile, { learnerName: "A" });
  result = { status: "invalid", fieldErrors: { "profile.level": "Choose" } };
  const invalid = await put("{}");
  assert.equal(invalid.status, 400);
  assert.deepEqual((await invalid.json()).fieldErrors, { "profile.level": "Choose" });
  result = { status: "unavailable" };
  assert.equal((await put("{}")).status, 500);
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

test("webhook API checks the Bearer token before reading the body, then maps outcomes (TR-01)", async (t) => {
  const previous = process.env.DOGRAH_WEBHOOK_SECRET;
  process.env.DOGRAH_WEBHOOK_SECRET = " test-only-secret ";
  t.after(() => { if (previous === undefined) delete process.env.DOGRAH_WEBHOOK_SECRET; else process.env.DOGRAH_WEBHOOK_SECRET = previous; });
  let calls = 0, result = { status: "ok", changed: true };
  const { POST } = loadTs("app/api/dograh/transcript-webhook/route.ts", {
    "@/lib/dograh/server": { ingestDograhTranscriptWebhook: async (body) => { calls++; assert.deepEqual(body, {}); return result; } },
  });
  const send = (headers, body = "{}") => POST(new Request("https://app.example.test", { method: "POST", headers, body }));
  for (const headers of [{}, { authorization: "Bearer wrong" }, { authorization: "Bearer test-only-secret-2" },
    { authorization: "test-only-secret" }, { authorization: "Basic test-only-secret" }, { authorization: "Bearer" },
    { "x-dograh-webhook-secret": "test-only-secret" }]) {
    assert.equal((await send(headers)).status, 401, JSON.stringify(headers));
  }
  const bearer = { authorization: "Bearer test-only-secret" };
  assert.equal((await send(bearer, "{")).status, 400);
  assert.equal(calls, 0);
  assert.equal((await send({ authorization: "bearer  test-only-secret" })).status, 200);
  for (const [outcome, expected, body] of [
    [{ status: "ok", changed: false }, 200, { success: true }],
    [{ status: "skipped", reason: "run_mismatch" }, 200, { success: false, skipped: true }],
    [{ status: "invalid_payload" }, 400, { success: false }],
    [{ status: "unavailable" }, 500, { success: false }],
  ]) {
    result = outcome;
    const response = await send(bearer);
    assert.equal(response.status, expected);
    assert.deepEqual(await response.json(), body);
  }
  delete process.env.DOGRAH_WEBHOOK_SECRET;
  assert.equal((await send(bearer)).status, 401);
});

test("access request API authenticates, validates JSON and maps request outcomes", async () => {
  let user = null, result = { status: "ok", access: { status: "pending", requestedAt: "2026-11-13T09:00:00.000Z" } };
  const { POST } = loadTs("app/api/access-request/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/access-server": { requestUserAccess: async (uid) => { assert.equal(uid, "user-a"); return result; } },
  });
  assert.equal((await POST(request())).status, 401);
  user = { id: "user-a" };
  assert.equal((await POST(new Request("https://app.example.test", { method: "POST", body: "{" }))).status, 400);
  const ok = await POST(request({ message: "hi" }));
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).access, { status: "pending", requestedAt: "2026-11-13T09:00:00.000Z" });
  result = { status: "invalid", fieldErrors: { message: "Too long" } };
  assert.equal((await POST(request())).status, 400);
  for (const status of ["already_pending", "already_approved"]) {
    result = { status };
    const response = await POST(request());
    assert.equal(response.status, 409);
    assert.equal((await response.json()).reason, status);
  }
  result = { status: "unavailable" };
  assert.equal((await POST(request())).status, 500);
});

test("admin access API hides itself from non-admins and maps decisions", async () => {
  let user = null, admin = false, calls = 0, result = { status: "ok", access: { status: "approved", decidedAt: "2026-11-13T10:00:00.000Z" } };
  const { POST } = loadTs("app/api/admin/access/[uid]/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => user },
    "@/lib/practice/access-server": {
      isAdminUser: (uid) => { assert.equal(uid, "admin-uid"); return admin; },
      decideUserAccess: async (adminId, uid) => { calls++; assert.equal(adminId, "admin-uid"); assert.equal(uid, "user-b"); return result; },
    },
  });
  const uidContext = { params: Promise.resolve({ uid: "user-b" }) };
  assert.equal((await POST(request({ decision: "approve" }), uidContext)).status, 404);
  user = { id: "admin-uid" };
  assert.equal((await POST(new Request("https://app.example.test", { method: "POST", body: "{" }), uidContext)).status, 404,
    "a non-admin gets 404 before the body is read");
  assert.equal(calls, 0);
  admin = true;
  assert.equal((await POST(new Request("https://app.example.test", { method: "POST", body: "{" }), uidContext)).status, 400);
  const ok = await POST(request({ decision: "approve" }), uidContext);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).access.status, "approved");
  for (const [status, code] of [["invalid", 400], ["not_found", 404], ["invalid_transition", 409], ["not_admin", 404], ["unavailable", 500]]) {
    result = { status };
    assert.equal((await POST(request({ decision: "approve" }), uidContext)).status, code, status);
  }
});

test("setup API answers 429 with the limit and reset time", async () => {
  const { POST } = loadTs("app/api/practice-setup/route.ts", {
    "@/lib/actions/auth.action": { getCurrentUser: async () => ({ id: "user-a" }) },
    "@/lib/practice/server": { createPracticeSession: async () => ({ status: "call_limit_reached", limit: 5, resetsAt: "2026-11-13T17:00:00.000Z" }) },
  });
  const response = await POST(request({}));
  assert.equal(response.status, 429);
  const body = await response.json();
  assert.equal(body.reason, "call_limit_reached");
  assert.equal(body.limit, 5);
  assert.equal(body.resetsAt, "2026-11-13T17:00:00.000Z");
});
