import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { fetchDograhTranscript } = loadTs("lib/dograh/fetch-transcript.ts");
const { parseDograhTranscriptText } = loadTs("lib/dograh/transcript-parser.ts");
const { applyDograhTranscriptEvent, parseDograhWebhookEvent } = loadTs("lib/dograh/transcript-webhook.ts");
const url = "https://storage.example.test/31.txt?signature=secret";
const hosts = ["storage.example.test"];
const raw = "[00:00] assistant: Hello\r\n[00:01] user: Xin chào\r\nContinuation";

test("download preserves signed query, omits credentials, disables caching/redirects", async () => {
  const actual = await fetchDograhTranscript(url, hosts, async (source, options) => {
    assert.equal(source.href, url);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(raw);
  });
  assert.equal(actual, raw);
});

test("download rejects untrusted URLs before making a request", async () => {
  for (const source of ["http://storage.example.test/a", "https://localhost/a", "https://127.0.0.1/a",
    "https://storage.example.test.evil.test/a", "https://name:password@storage.example.test/a",
    "https://storage.example.test:8443/a", "file:///etc/passwd", "not a URL"]) {
    await assert.rejects(fetchDograhTranscript(source, hosts, async () => assert.fail("must not fetch")), /Unable to download/);
  }
});

test("HTTP errors, redirect and timeout failures are sanitized", async () => {
  for (const request of [async () => new Response("secret", { status: 403 }),
    async () => new Response(null, { status: 302 }),
    async () => { throw new Error(url); },
    async () => { throw new DOMException("Timed out", "TimeoutError"); }]) {
    await assert.rejects(fetchDograhTranscript(url, hosts, request), { message: "Unable to download the Dograh transcript." });
  }
});

test("download enforces both declared and streamed size limits", async () => {
  await assert.rejects(fetchDograhTranscript(url, hosts, async () => new Response("x", {
    headers: { "content-length": "999999" },
  })));
  await assert.rejects(fetchDograhTranscript(url, hosts, async () => new Response("x".repeat(256 * 1024 + 1))));
});

test("UTF-8 split across chunks is decoded correctly; malformed UTF-8 is rejected", async () => {
  const bytes = new TextEncoder().encode("こんにちは");
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 2)); controller.enqueue(bytes.slice(2)); controller.close();
  } }));
  assert.equal(await fetchDograhTranscript(url, hosts, async () => response), "こんにちは");
  await assert.rejects(fetchDograhTranscript(url, hosts, async () => new Response(new Uint8Array([255]))));
});

test("parser maps speakers, Unicode, CRLF and continuation lines", () => {
  assert.deepEqual(parseDograhTranscriptText(raw), [
    { role: "tutor", text: "Hello", at: "00:00" },
    { role: "learner", text: "Xin chào\nContinuation", at: "00:01" },
  ]);
  assert.deepEqual(parseDograhTranscriptText("\n[00:00] user: \n"), []);
  const turns = parseDograhTranscriptText(`[00:00] user: ${"a".repeat(5000)}`);
  assert.equal(turns[0].text.length, 2000);
});

test("webhook rejects malformed payloads", () => {
  for (const payload of [null, [], {}, { workflow_run_id: -1 }, { workflow_run_id: 1, transcript_url: "file:///x" }]) {
    assert.equal(parseDograhWebhookEvent(payload), null);
  }
});

function store(existing, request = async () => new Response(raw)) {
  const writes = [], errors = [];
  let downloads = 0;
  return { writes, errors, downloads: () => downloads, adapter: {
    findSessionByRunId: async () => ({ sessionId: "session-a", dograh: existing }),
    fetchTranscript: (source) => { downloads++; return fetchDograhTranscript(source, hosts, request); },
    writePatch: async (id, patch) => { assert.equal(id, "session-a"); writes.push(patch); },
    onError: (error) => errors.push(error),
  } };
}

test("download → parse → persistence sets ready, empty and error", async () => {
  for (const [body, expected] of [[raw, "ready"], ["", "empty"], [null, "error"]]) {
    const s = store(undefined, async () => body === null ? new Response("", { status: 500 }) : new Response(body));
    assert.equal((await applyDograhTranscriptEvent({ workflow_run_id: 31, transcript_url: url }, s.adapter)).status, "ok");
    assert.equal(s.writes[0].transcriptStatus, expected);
    if (expected === "ready") assert.equal(s.writes[0].transcript[1].role, "learner");
    if (expected === "error") assert.equal(s.errors.length, 1);
  }
});

test("duplicate successful delivery avoids expired URL; errors can be retried", async () => {
  const existing = { transcriptUrl: url, transcriptStatus: "ready", transcript: parseDograhTranscriptText(raw) };
  const s = store(existing, async () => assert.fail("duplicate must not download"));
  assert.deepEqual(await applyDograhTranscriptEvent({ workflow_run_id: 31, transcript_url: url }, s.adapter), { status: "ok", changed: false });
  assert.equal(s.downloads(), 0);
  const retry = store({ transcriptUrl: url, transcriptStatus: "error" });
  await applyDograhTranscriptEvent({ workflow_run_id: 31, transcript_url: url }, retry.adapter);
  assert.equal(retry.writes[0].transcriptStatus, "ready");
});

test("unknown run does not fetch; persistence failures return unavailable", async () => {
  const s = store();
  s.adapter.findSessionByRunId = async () => null;
  assert.equal((await applyDograhTranscriptEvent({ workflow_run_id: 99, transcript_url: url }, s.adapter)).status, "not_found");
  assert.equal(s.downloads(), 0);
  const failed = store();
  failed.adapter.writePatch = async () => { throw new Error("database offline"); };
  assert.equal((await applyDograhTranscriptEvent({ workflow_run_id: 31, transcript_url: url }, failed.adapter)).status, "unavailable");
});

test("Firebase adapter supplies downloader and writes nested transcript fields", async () => {
  let update, downloaded = false;
  const { ingestDograhTranscriptWebhook } = loadTs("lib/dograh/server.ts", {
    "@/firebase/admin": { adminDb: { collection: () => ({
      where: () => ({ limit: () => ({ get: async () => ({ empty: false,
        docs: [{ id: "session-a", data: () => ({ dograh: { workflowRunId: 31 } }) }],
      }) }) }),
      doc: (id) => ({ update: async (patch) => { assert.equal(id, "session-a"); update = patch; } }),
    }) } },
    "./fetch-transcript": { fetchDograhTranscript: async (source, allowed) => {
      assert.equal(source, url); assert.ok(Array.isArray(allowed)); downloaded = true; return raw;
    } },
  });
  assert.equal((await ingestDograhTranscriptWebhook({ workflow_run_id: 31, transcript_url: url })).status, "ok");
  assert.equal(downloaded, true);
  assert.equal(update["dograh.transcriptStatus"], "ready");
  assert.equal(update["dograh.transcript"][1].role, "learner");
  assert.equal("dograh" in update, false);
});
