import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { fetchDograhTranscript } = loadTs("lib/dograh/fetch-transcript.ts");
const { parseDograhTranscriptText } = loadTs("lib/dograh/transcript-parser.ts");
const { applyDograhTranscriptEvent, parseDograhWebhookEvent } = loadTs("lib/dograh/transcript-webhook.ts");
const url = "https://storage.example.test/31.txt?signature=secret";
const hosts = ["storage.example.test"];
const raw = "[00:00] assistant: Hello\r\n[00:01] user: Xin chào\r\nContinuation";
const localOrigins = ["http://localhost:8000", "http://localhost:9000"];
const localUrl = "http://localhost:8000/transcripts/33";

test("local Dograh redirect to MinIO preserves queries and parses speech", async () => {
  const destination = "http://localhost:9000/transcripts/33.txt?signature=a%2Bb&expires=123";
  const calls = [];
  let cancelled = false;
  const actual = await fetchDograhTranscript(localUrl, hosts, async (source, options) => {
    calls.push({ url: source.href, options });
    if (calls.length === 1) return new Response(new ReadableStream({
      cancel() { cancelled = true; },
    }), { status: 302, headers: { location: destination } });
    assert.equal(cancelled, true);
    return new Response(raw, { headers: { "content-type": "application/octet-stream" } });
  }, localOrigins);
  assert.deepEqual(calls.map(call => call.url), [localUrl, destination]);
  for (const { options } of calls) {
    assert.equal(options.redirect, "manual");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers, undefined);
    assert.equal(options.signal, calls[0].options.signal);
  }
  assert.equal(actual, raw);
  assert.deepEqual(parseDograhTranscriptText(actual).map(turn => turn.role), ["tutor", "learner"]);
});

test("local redirects reject untrusted destinations before requesting them", async () => {
  for (const destination of ["http://localhost:9001/file", "http://127.0.0.1:9000/file",
    "http://localhost.evil.test:9000/file", "http://169.254.169.254/file",
    "https://localhost:9000/file", "http://user:secret@localhost:9000/file",
    "file:///etc/passwd", "ftp://localhost:9000/file", "http://["]) {
    let calls = 0;
    await assert.rejects(fetchDograhTranscript(localUrl, hosts, async () => {
      assert.equal(++calls, 1, "must not request the redirect destination");
      return new Response(null, { status: 302, headers: { location: destination } });
    }, localOrigins), { message: "Unable to download the Dograh transcript." });
    assert.equal(calls, 1);
  }
});

test("local redirects resolve relative locations and stop loops or missing locations", async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const visited = [];
    assert.equal(await fetchDograhTranscript(localUrl, hosts, async source => {
      visited.push(source.href);
      return visited.length === 1
        ? new Response(null, { status, headers: { location: "../files/33.txt?signature=a%2Bb" } })
        : new Response(raw);
    }, localOrigins), raw);
    assert.deepEqual(visited, [localUrl, "http://localhost:8000/files/33.txt?signature=a%2Bb"]);
  }
  let calls = 0, cancelled = 0;
  await assert.rejects(fetchDograhTranscript(localUrl, hosts, async () => {
    calls++;
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), {
      status: 302, headers: { location: localUrl },
    });
  }, localOrigins), /Unable to download/);
  assert.equal(calls, 4);
  assert.equal(cancelled, 4);
  await assert.rejects(fetchDograhTranscript(localUrl, hosts,
    async () => new Response(null, { status: 302 }), localOrigins), /Unable to download/);
});

test("local origins are opt-in, exact HTTP origins; final downloads still enforce limits", async () => {
  const mustNotFetch = async () => assert.fail("must not fetch");
  await assert.rejects(fetchDograhTranscript(localUrl, hosts, mustNotFetch), /Unable to download/);
  await assert.rejects(fetchDograhTranscript(localUrl, hosts, mustNotFetch,
    ["http://localhost:8000/path"]), /Unable to download/);
  await assert.rejects(fetchDograhTranscript("file:///etc/passwd", hosts, mustNotFetch,
    ["null"]), /Unable to download/);
  await assert.rejects(fetchDograhTranscript("ftp://localhost:8000/file", hosts, mustNotFetch,
    ["ftp://localhost:8000"]), /Unable to download/);
  for (const finalResponse of [
    () => new Response("denied", { status: 403 }),
    () => new Response("x", { headers: { "content-length": "999999" } }),
    () => new Response("x".repeat(256 * 1024 + 1)),
    () => new Response(new Uint8Array([255])),
  ]) {
    let calls = 0;
    await assert.rejects(fetchDograhTranscript(localUrl, hosts, async () => ++calls === 1
      ? new Response(null, { status: 302, headers: { location: "http://localhost:9000/file" } })
      : finalResponse(), localOrigins), /Unable to download/);
    assert.equal(calls, 2);
  }
});

test("server enables local download only with explicit mode and origins, recovering an error", async (t) => {
  const keys = ["DOGRAH_TRANSCRIPT_MODE", "DOGRAH_TRANSCRIPT_LOCAL_ORIGINS", "DOGRAH_TRANSCRIPT_ALLOWED_HOSTS"];
  const previous = keys.map(key => process.env[key]);
  t.after(() => keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }));
  process.env.DOGRAH_TRANSCRIPT_LOCAL_ORIGINS = ` ${localOrigins.join(", ")}, `;
  process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS = hosts.join(",");
  let requests = 0, update;
  t.mock.method(globalThis, "fetch", async source => {
    requests++;
    return source.origin === localOrigins[0]
      ? new Response(null, { status: 302, headers: { location: `${localOrigins[1]}/33.txt` } })
      : new Response(raw);
  });
  t.mock.method(console, "error", () => {});
  const { ingestDograhTranscriptWebhook } = loadTs("lib/dograh/server.ts", {
    "@/firebase/admin": { adminDb: { collection: () => ({
      where: () => ({ limit: () => ({ get: async () => ({ empty: false,
        docs: [{ id: "session-a", data: () => ({ dograh: {
          workflowRunId: 33, transcriptUrl: localUrl, transcriptStatus: "error",
        } }) }],
      }) }) }),
      doc: () => ({ update: async patch => { update = patch; } }),
    }) } },
  });
  for (const mode of [undefined, "public", "LOCAL", "local"]) {
    if (mode === undefined) delete process.env.DOGRAH_TRANSCRIPT_MODE;
    else process.env.DOGRAH_TRANSCRIPT_MODE = mode;
    update = undefined;
    assert.equal((await ingestDograhTranscriptWebhook({
      workflow_run_id: 33, transcript_url: localUrl,
    })).status, "ok");
    if (mode === "local") assert.equal(update["dograh.transcriptStatus"], "ready");
    else assert.equal(update, undefined); // Existing error remains unchanged.
    assert.equal(requests, mode === "local" ? 2 : 0);
  }
  assert.deepEqual(update["dograh.transcript"], parseDograhTranscriptText(raw));
  delete process.env.DOGRAH_TRANSCRIPT_LOCAL_ORIGINS;
  update = undefined;
  await ingestDograhTranscriptWebhook({ workflow_run_id: 33, transcript_url: localUrl });
  assert.equal(update, undefined);
  assert.equal(requests, 2);
});

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
