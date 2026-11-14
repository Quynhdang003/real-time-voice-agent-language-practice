import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const { fetchDograhTranscript } = loadTs("lib/dograh/fetch-transcript.ts");
const { parseDograhTranscriptText } = loadTs("lib/dograh/transcript-parser.ts");
const url = "https://storage.example.test/31.txt?signature=secret";
const hosts = ["storage.example.test"];
const raw = "[00:00] assistant: Hello\r\n[00:01] user: Xin chào\r\nContinuation";

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx|mjs)$/.test(name) ? [path] : [];
  });
}

test("the retired self-hosted Dograh stack and its local transcript mode are gone (DC-02)", () => {
  for (const path of ["dograh/docker-compose.yml", "dograh/.env.example", "dograh/scripts/backup.ps1",
    "dograh/scripts/restore.ps1"]) assert.equal(existsSync(path), false, path);
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
  for (const name of ["dograh:up", "dograh:down", "dograh:logs", "dograh:backup"]) assert.equal(name in scripts, false, name);
  for (const file of [...["app", "lib", "dograh"].flatMap(sourceFiles), ".env.example", "README.md", "dograh/README.md"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"),
      /DOGRAH_TRANSCRIPT_MODE|DOGRAH_TRANSCRIPT_LOCAL_ORIGINS|localhost:8020|fluentai-dograh|docker compose/, file);
  }
});

const fail = (reason, rejectedHost) => ({ status: "error", reason, ...(rejectedHost ? { rejectedHost } : {}) });

test("download keeps the signed query, sends no headers, never caches and follows redirects by hand", async () => {
  const actual = await fetchDograhTranscript(url, hosts, async (source, options) => {
    assert.equal(source.href, url);
    assert.equal(options.headers, undefined);
    assert.equal(options.redirect, "manual");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(raw);
  });
  assert.deepEqual(actual, { status: "ok", text: raw });
});

test("download rejects untrusted URLs before making a request (untrusted_url, with the host only)", async () => {
  for (const [source, host] of [["http://storage.example.test/a", "storage.example.test"], ["https://localhost/a", "localhost"],
    ["https://127.0.0.1/a", "127.0.0.1"], ["https://storage.example.test.evil.test/a", "storage.example.test.evil.test"],
    ["https://name:password@storage.example.test/a", "storage.example.test"], ["https://storage.example.test:8443/a", "storage.example.test"],
    ["file:///etc/passwd", ""], ["not a URL", undefined]]) {
    assert.deepEqual(await fetchDograhTranscript(source, hosts, async () => assert.fail("must not fetch")),
      fail("untrusted_url", host), source);
  }
});

test("a Cloud link redirecting to allowlisted storage is followed; every hop shares one deadline (TR-02)", async () => {
  const link = "https://api.dograh.test/api/v1/public/download/workflow/token-1/transcript";
  const storage = "https://storage.example.test/bucket/31.txt?X-Amz-Signature=a%2Bb&X-Amz-Expires=3600";
  for (const status of [301, 302, 303, 307, 308]) {
    const calls = [];
    let cancelled = false;
    const result = await fetchDograhTranscript(link, ["api.dograh.test", ...hosts], async (source, options) => {
      calls.push({ href: source.href, options });
      if (calls.length === 1) return new Response(new ReadableStream({ cancel() { cancelled = true; } }),
        { status, headers: { location: storage } });
      assert.equal(cancelled, true, "the redirect body is released before the next hop");
      return new Response(raw);
    });
    assert.deepEqual(result, { status: "ok", text: raw });
    assert.deepEqual(calls.map((call) => call.href), [link, storage], "the signed query is kept");
    assert.equal(calls[1].options.signal, calls[0].options.signal);
    assert.equal(calls[1].options.headers, undefined);
  }
  // Relative locations resolve against the current hop.
  const visited = [];
  await fetchDograhTranscript(url, hosts, async (source) => {
    visited.push(source.href);
    return visited.length === 1 ? new Response(null, { status: 302, headers: { location: "../files/31.txt?sig=x" } }) : new Response(raw);
  });
  assert.deepEqual(visited, [url, "https://storage.example.test/files/31.txt?sig=x"]);
});

test("redirects off the allowlist, without a location or past 3 hops are rejected before the request", async () => {
  for (const [location, host] of [["https://evil.test/file", "evil.test"], ["http://storage.example.test/file", "storage.example.test"],
    ["https://storage.example.test:9000/file", "storage.example.test"], ["https://user:pw@storage.example.test/file", "storage.example.test"],
    ["https://169.254.169.254/latest", "169.254.169.254"], [null, undefined], ["https://[", undefined]]) {
    let calls = 0;
    const result = await fetchDograhTranscript(url, hosts, async () => {
      assert.equal(++calls, 1, "the rejected target is never requested");
      return new Response(null, { status: 302, headers: location === null ? {} : { location } });
    });
    assert.deepEqual(result, fail("redirect_rejected", host), String(location));
  }
  let hops = 0;
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => {
    hops++;
    return new Response(null, { status: 302, headers: { location: `${url}&hop=${hops}` } });
  }), fail("redirect_rejected"));
  assert.equal(hops, 4, "the first request plus 3 followed redirects");
  let three = 0;
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => ++three <= 3
    ? new Response(null, { status: 307, headers: { location: url } }) : new Response(raw)), { status: "ok", text: raw });
});

test("HTTP, network and timeout failures map to reason codes without provider details", async () => {
  for (const [request, reason] of [
    [async () => new Response("secret", { status: 403 }), "http_4xx"],
    [async () => new Response("gone", { status: 404 }), "http_4xx"],
    [async () => new Response(null, { status: 304 }), "http_4xx"],
    [async () => new Response("busy", { status: 503 }), "http_5xx"],
    [async () => new Response("oops", { status: 500 }), "http_5xx"],
    [async () => { throw new TypeError(`fetch failed ${url}`); }, "network"],
    [async () => { throw new DOMException("Timed out", "TimeoutError"); }, "timeout"],
    [async () => new Response(new ReadableStream({ pull() { throw new DOMException("Timed out", "TimeoutError"); } })), "timeout"],
    [async () => new Response(new ReadableStream({ pull() { throw new Error("socket reset"); } })), "network"],
  ]) {
    const result = await fetchDograhTranscript(url, hosts, request);
    assert.deepEqual(result, fail(reason));
    assert.doesNotMatch(JSON.stringify(result), /secret|signature|fetch failed/);
  }
});

test("download enforces both declared and streamed size limits (too_large)", async () => {
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => new Response("x", {
    headers: { "content-length": "999999" },
  })), fail("too_large"));
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => new Response("x".repeat(256 * 1024 + 1))), fail("too_large"));
  assert.equal((await fetchDograhTranscript(url, hosts, async () => new Response("x".repeat(256 * 1024)))).status, "ok");
});

test("UTF-8 split across chunks is decoded correctly; malformed UTF-8 is invalid_utf8", async () => {
  const bytes = new TextEncoder().encode("こんにちは");
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 2)); controller.enqueue(bytes.slice(2)); controller.close();
  } }));
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => response), { status: "ok", text: "こんにちは" });
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => new Response(new Uint8Array([255]))), fail("invalid_utf8"));
  assert.deepEqual(await fetchDograhTranscript(url, hosts, async () => new Response(bytes.slice(0, 2))), fail("invalid_utf8"),
    "a truncated multi-byte character at the end");
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
