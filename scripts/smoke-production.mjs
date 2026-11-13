import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
for (const path of ["/sign-in", "/register"]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/);
  console.log(`PASS ${path}: 200 HTML`);
}
for (const path of ["/", "/voice-call?sessionId=session-a", "/review?sessionId=session-a"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  assert.ok([303, 307, 308].includes(response.status), `${path}: expected authentication redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/sign-in");
  console.log(`PASS ${path}: redirects to sign-in`);
}
for (const [method, path] of [["POST", "/api/practice-setup"], ["POST", "/api/practice-session/session-a/call-event"],
  ["POST", "/api/practice-session/session-a/generate-review"], ["POST", "/api/dograh/transcript-webhook"],
  ["PUT", "/api/learner-profile"], ["POST", "/api/access-request"]]) {
  const response = await fetch(new URL(path, base), { method, body: "{}", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 401, path);
  assert.equal((await response.json()).success, false);
  console.log(`PASS ${method} ${path}: unauthenticated request rejected`);
}
