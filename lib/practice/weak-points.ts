// Weak-point carry-over (RV-03): the next session's form is pre-filled from the learner's latest v2 reviews.
// Pure; the Firestore query lives in weak-points-server.ts.
import { isRecord, normalizeText, textKey } from "./guards.ts";
import { LIST_SEPARATOR, setupLimits } from "./session-setup.ts";
import { parseSessionReviewV2 } from "./review-v2.ts";
import type { SessionReviewV2 } from "./review-v2.ts";

export const CARRY_OVER_SOURCES = 3;
export type WeakPointSource = { sessionId: string; review: SessionReviewV2 };
export type CarriedWeakPoint = { text: string; sourceSessionId: string };

// Stored documents, newest first → the latest reviews that are v2 (v1 reviews have no weak points).
export function weakPointSourcesFrom(documents: readonly { id: string; review: unknown }[]): WeakPointSource[] {
  const sources: WeakPointSource[] = [];
  for (const { id, review } of documents) {
    if (sources.length === CARRY_OVER_SOURCES) break;
    const parsed = isRecord(review) && review.schemaVersion === 2 ? parseSessionReviewV2(review) : null;
    if (parsed) sources.push({ sessionId: id, review: parsed });
  }
  return sources;
}

// Newest review first:
// - a point marked `improved` in a review is dropped from that review and every older one;
// - `still_present` points, then `nextWeakPoints[].en`, then `not_observed` points carry over;
// - duplicates are removed case-insensitively, and items that break the weak-point rules (empty, longer
//   than 120 characters, or containing the Dograh list separator) are skipped;
// - at most 5 items.
export function mergeCarryOver(sources: readonly WeakPointSource[]): CarriedWeakPoint[] {
  const improved = new Set<string>();
  const seen = new Set<string>();
  const carried: CarriedWeakPoint[] = [];
  for (const { sessionId, review } of sources.slice(0, CARRY_OVER_SOURCES)) {
    const points = review.sessionGoals.weakPoints;
    for (const point of points) if (point.status === "improved") improved.add(textKey(point.point));
    const candidates = [
      ...points.filter((point) => point.status === "still_present").map((point) => point.point),
      ...review.nextWeakPoints.map((point) => point.en),
      ...points.filter((point) => point.status === "not_observed").map((point) => point.point),
    ];
    for (const candidate of candidates) {
      const text = normalizeText(candidate);
      const key = textKey(text);
      if (!text || text.length > setupLimits.weakPoints.itemMax || text.includes(LIST_SEPARATOR) ||
        improved.has(key) || seen.has(key)) continue;
      seen.add(key);
      carried.push({ text, sourceSessionId: sessionId });
      if (carried.length === setupLimits.weakPoints.max) return carried;
    }
  }
  return carried;
}

// The sessions whose carried points the learner kept in the submitted form (weakPointsSourceSessionIds).
// Computed on the server from the same carry-over that pre-filled the form; never read from the body.
export function weakPointSourceIds(submitted: readonly string[], carried: readonly CarriedWeakPoint[]): string[] {
  const kept = new Set(submitted.map(textKey));
  const ids: string[] = [];
  for (const item of carried) {
    if (kept.has(textKey(item.text)) && !ids.includes(item.sourceSessionId)) ids.push(item.sourceSessionId);
  }
  return ids;
}
