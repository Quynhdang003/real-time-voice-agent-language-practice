import type { TranscriptError } from "@/lib/practice/session";

const MAX_TRANSCRIPT_BYTES = 256 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// rejectedHost is the hostname alone (never a URL), so the operator can find the host to allowlist.
export type TranscriptDownload =
  | { status: "ok"; text: string }
  | { status: "error"; reason: TranscriptError; rejectedHost?: string };

const failure = (reason: TranscriptError, rejectedHost?: string): TranscriptDownload =>
  ({ status: "error", reason, ...(rejectedHost ? { rejectedHost } : {}) });

// HTTPS on port 443, an allowlisted exact hostname, and no credentials in the URL.
function isAllowedUrl(url: URL, allowedHosts: readonly string[]): boolean {
  return url.protocol === "https:" && (!url.port || url.port === "443") && !url.username && !url.password &&
    allowedHosts.some((host) => host.trim().toLowerCase() === url.hostname);
}

// Dograh Cloud's download link answers 302 to its storage, so redirects are followed by hand: every
// target is checked against the same allowlist before it is requested. No API key is ever sent, and
// signed query strings are kept as they are.
export async function fetchDograhTranscript(
  source: string,
  allowedHosts: readonly string[],
  request: typeof fetch = fetch,
): Promise<TranscriptDownload> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return failure("untrusted_url");
  }
  if (!isAllowedUrl(url, allowedHosts)) return failure("untrusted_url", url.hostname);

  // One deadline covers every hop and the final body.
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  try {
    let response: Response;
    for (let hops = 0; ; hops++) {
      response = await request(url, { cache: "no-store", redirect: "manual", signal });
      if (!REDIRECT_STATUSES.has(response.status)) break;
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location || hops >= MAX_REDIRECTS) return failure("redirect_rejected");
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        return failure("redirect_rejected");
      }
      if (!isAllowedUrl(next, allowedHosts)) return failure("redirect_rejected", next.hostname);
      url = next;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return failure(response.status >= 500 ? "http_5xx" : "http_4xx");
    }
    if (Number(response.headers.get("content-length")) > MAX_TRANSCRIPT_BYTES) {
      await response.body?.cancel().catch(() => undefined);
      return failure("too_large");
    }
    const reader = response.body?.getReader();
    if (!reader) return { status: "ok", text: "" };
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_TRANSCRIPT_BYTES) return failure("too_large");
        try {
          text += decoder.decode(value, { stream: true });
        } catch {
          return failure("invalid_utf8");
        }
      }
      try {
        return { status: "ok", text: text + decoder.decode() };
      } catch {
        return failure("invalid_utf8");
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  } catch (error) {
    // Provider error messages may hold signed URLs, so only the reason survives.
    const timedOut = signal.aborted || (error instanceof Error && error.name === "TimeoutError");
    return failure(timedOut ? "timeout" : "network");
  }
}
