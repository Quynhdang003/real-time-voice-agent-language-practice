const MAX_TRANSCRIPT_BYTES = 256 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;

// Allowlisted public HTTPS hosts only. Never forward API keys.
export async function fetchDograhTranscript(
  source: string,
  allowedHosts: readonly string[],
  request: typeof fetch = fetch,
): Promise<string> {
  try {
    const url = new URL(source);
    const isAllowedHttps = url.protocol === "https:" &&
      (!url.port || url.port === "443") &&
      allowedHosts.some((host) => host.trim().toLowerCase() === url.hostname);
    if (url.username || url.password || !isAllowedHttps) {
      throw new Error("Untrusted transcript URL.");
    }

    // One deadline covers the request and the response body.
    const response = await request(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
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
