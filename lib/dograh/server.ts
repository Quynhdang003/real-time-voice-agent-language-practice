import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { applyDograhWebhook } from "./transcript-webhook";
import type { TranscriptPatch } from "./transcript-webhook";
import { fetchDograhTranscript } from "./fetch-transcript";

// Dograh Cloud's download links: the app and its API origin (the Cloud embed URL's apiEndpoint is
// https://api.dograh.com, and the API builds the links). The storage host they redirect to is added on
// Vercel through DOGRAH_TRANSCRIPT_ALLOWED_HOSTS once it is known (DC-01).
const DEFAULT_TRANSCRIPT_HOSTS = "app.dograh.com,api.dograh.com";

export function transcriptAllowedHosts(value = process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS): string[] {
  return (value?.trim() ? value : DEFAULT_TRANSCRIPT_HOSTS)
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
}

function toUpdate(patch: TranscriptPatch): Record<string, unknown> {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  // Nested paths keep the call fields the browser saved under dograh; null removes a field.
  for (const [key, value] of Object.entries(patch)) update[`dograh.${key}`] = value === null ? FieldValue.delete() : value;
  return update;
}

export async function ingestDograhTranscriptWebhook(rawBody: unknown, attempt: number | null) {
  return applyDograhWebhook(rawBody, {
    transaction: (sessionId, apply) => adminDb.runTransaction(async (transaction) => {
      const reference = adminDb.collection("practiceSessions").doc(sessionId);
      return apply({
        readDocument: async () => {
          const snapshot = await transaction.get(reference);
          return snapshot.exists ? snapshot.data() : undefined;
        },
        writePatch: async (patch, { markReviewPending }) => {
          transaction.update(reference, { ...toUpdate(patch), ...(markReviewPending ? { reviewStatus: "pending" } : {}) });
        },
      });
    }),
    fetchTranscript: (url) => fetchDograhTranscript(url, transcriptAllowedHosts(), fetch),
    // Codes and a rejected hostname only: never the session ID, the run ID or a URL.
    onSkip: (reason) => console.warn("[dograh.webhook]", { code: reason }),
    onDownloadFailure: ({ reason, rejectedHost, retry }) =>
      console.error("[dograh.webhook.download]", { code: reason, retry, ...(rejectedHost ? { host: rejectedHost } : {}) }),
    onError: (error) => console.error("[dograh.webhook]", { code: error instanceof Error ? error.name : "unknown" }),
  }, { attempt });
}
