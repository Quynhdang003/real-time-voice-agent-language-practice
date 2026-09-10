const MAX_TRANSCRIPT_BYTES = 256 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Public HTTPS hosts or explicitly configured local origins only. Never forward API keys.
export async function fetchDograhTranscript(
  source: string,
  allowedHosts: readonly string[],
  request: typeof fetch = fetch,
  localOrigins: readonly string[] = [],
): Promise<string> {
  try {
    let url = new URL(source);
    let response: Response;
    // Share one deadline across all redirects and the final response body.
    const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);

    for (let hops = 0; ; hops++) {
      const isLocal = (url.protocol === "http:" || url.protocol === "https:") &&
        localOrigins.includes(url.origin);
      const isAllowedHttps = url.protocol === "https:" &&
        (!url.port || url.port === "443") &&
        allowedHosts.some((host) => host.trim().toLowerCase() === url.hostname);
      if (url.username || url.password || (!isLocal && !isAllowedHttps)) {
        throw new Error("Untrusted transcript URL.");
      }

      response = await request(url, {
        cache: "no-store",
        redirect: isLocal ? "manual" : "error",
        signal,
      });
      if (!REDIRECT_STATUSES.has(response.status)) break;

      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!isLocal || !location || hops >= MAX_REDIRECTS) {
        throw new Error("Transcript redirect rejected.");
      }
      // Validate every destination before issuing another request; preserve signed queries.
      url = new URL(location, url);
    }
    const reader = response.body?.getReader();
    try {
      if (!response.ok || !reader) throw new Error("Transcript download failed.");
      const contentLength = Number(response.headers.get("content-length"));
      if (contentLength > MAX_TRANSCRIPT_BYTES) throw new Error("Transcript is too large.");

      const decoder = new TextDecoder("utf-8", { fatal: true });
      let bytes = 0;
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_TRANSCRIPT_BYTES) throw new Error("Transcript is too large.");
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    } finally {
      if (reader) {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
  } catch {
    // Signed URLs and provider response bodies must not appear in error logs.
    throw new Error("Unable to download the Dograh transcript.");
  }
}
