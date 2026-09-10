import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
for (const path of ["/sign-in", "/register"]) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get("content-type"), /text\/html/);
  console.log(`PASS ${path}: 200 HTML`);
}
for (const path of ["/", "/voice-call?sessionId=session-a"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  assert.ok([303, 307, 308].includes(response.status), `${path}: expected authentication redirect, got ${response.status}`);
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/sign-in");
  console.log(`PASS ${path}: redirects to sign-in`);
}
for (const path of ["/api/practice-setup", "/api/practice-session/session-a/call-event"]) {
  const response = await fetch(new URL(path, base), { method: "POST", body: "{}", signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 401, path);
  assert.equal((await response.json()).success, false);
  console.log(`PASS ${path}: unauthenticated request rejected`);
}
for (const [method, path] of [["GET", "/review?sessionId=session-a"],
  ["POST", "/api/practice-session/session-a/generate-review"],
  ["POST", "/api/dograh/transcript-webhook"]]) {
  const response = await fetch(new URL(path, base), {
    method, redirect: "manual", signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 404, path);
  console.log(`PASS ${path}: retired route is absent`);
}
