import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/firebase/admin";
import { isRecord } from "@/lib/practice/session";
import { applyDograhTranscriptEvent } from "./transcript-webhook";
import { fetchDograhTranscript } from "./fetch-transcript";

// Debug/verification primitive only. Do not expose raw provider data through a browser route.
export async function getDograhRun(runId: number): Promise<unknown> {
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("Invalid Dograh run ID.");
  const workflowId = process.env.DOGRAH_WORKFLOW_ID?.trim();
  const apiKey = process.env.DOGRAH_API_KEY?.trim();
  if (!workflowId || !/^[1-9]\d*$/.test(workflowId) || !apiKey) {
    throw new Error("Dograh server configuration is missing or invalid.");
  }
  try {
    const response = await fetch(`https://app.dograh.com/api/v1/workflow/${workflowId}/runs/${runId}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Dograh request failed.");
    return await response.json();
  } catch {
    throw new Error("Unable to retrieve the Dograh run.");
  }
}
export async function ingestDograhTranscriptWebhook(rawBody: unknown) {
  return applyDograhTranscriptEvent(rawBody, {
    fetchTranscript: (url) => fetchDograhTranscript(
      url,
      (process.env.DOGRAH_TRANSCRIPT_ALLOWED_HOSTS ?? "app.dograh.com")
        .split(",").map((host) => host.trim()).filter(Boolean),
    ),
    findSessionByRunId: async (runId) => {
      const snapshot = await adminDb.collection("practiceSessions")
        .where("dograh.workflowRunId", "==", runId).limit(1).get();
      if (snapshot.empty) return null;
      const doc = snapshot.docs[0];
      const dograh = doc.data().dograh;
      return { sessionId: doc.id, dograh: isRecord(dograh) ? dograh : undefined };
    },
    writePatch: async (sessionId, patch) => {
      const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      for (const [key, value] of Object.entries(patch)) update[`dograh.${key}`] = value;
      await adminDb.collection("practiceSessions").doc(sessionId).update(update);
    },
    onError: (error) => console.error("[dograh.webhook]", { code: error instanceof Error ? error.name : "unknown" }),
  });
}
