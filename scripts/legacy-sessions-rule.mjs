// DATA-01 rule (confirmed by the user on 2026-11-14): delete only v1 practice sessions (no schemaVersion) that
// (a) are `ready` and never started a call, or (b) are `completed` without any transcript turns.
// Anything else is kept, including every v2 session and any session that has a review.

export const legacyGroups = {
  a: "v1 ready, never called",
  b: "v1 completed, no transcript",
};

// Returns "a", "b" or null (keep) for a stored practiceSessions document.
export function legacyCleanupGroup(data) {
  if (typeof data !== "object" || data === null || "schemaVersion" in data || "review" in data) return null;
  const dograh = typeof data.dograh === "object" && data.dograh !== null ? data.dograh : undefined;
  if (data.status === "ready" && dograh === undefined) return "a";
  const turns = Array.isArray(dograh?.transcript) ? dograh.transcript.length : 0;
  if (data.status === "completed" && turns === 0) return "b";
  return null;
}
