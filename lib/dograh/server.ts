import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { applyDograhWebhook } from "./transcript-webhook";
import type { TranscriptPatch } from "./transcript-webhook";
import { fetchDograhTranscript } from "./fetch-transcript";

function toUpdate(patch: TranscriptPatch): Record<string, unknown> {
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  // Nested paths keep the call fields the browser saved under dograh.
  for (const [key, value] of Object.entries(patch)) update[`dograh.${key}`] = value;
  return update;
}

export async function ingestDograhTranscriptWebhook(rawBody: unknown) {
  return applyDograhWebhook(rawBody, {
    transaction: (sessionId, apply) => adminDb.runTransaction(async (transaction) => {
      const reference = adminDb.collection("practiceSessions").doc(sessionId);
      return apply({
        readDocument: async () => {
          const snapshot = await transaction.get(reference);
          return snapshot.exists ? snapshot.data() : undefined;
        },
        writePatch: async (patch) => {
          transaction.update(reference, toUpdate(patch));
        },
      });
    }),
    fetchTranscript: (url) => fetchDograhTranscript(
      url,
      (process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS ?? "app.dograh.com")
        .split(",").map((host) => host.trim()).filter(Boolean),
      fetch,
    ),
    // Codes only: never the session ID, the run ID or a URL.
    onSkip: (reason) => console.warn("[dograh.webhook]", { code: reason }),
    onError: (error) => console.error("[dograh.webhook]", { code: error instanceof Error ? error.name : "unknown" }),
  });
}
