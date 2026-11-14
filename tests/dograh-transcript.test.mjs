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
