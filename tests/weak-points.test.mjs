import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";
import { profileV2, review, reviewV2, setupV2 } from "./helpers/fixtures.mjs";

const { mergeCarryOver, weakPointSourceIds, weakPointSourcesFrom } = loadTs("lib/practice/weak-points.ts");
const { createPracticeSessionForUser } = loadTs("lib/practice/create-session.ts");
const { validateSessionSetup } = loadTs("lib/practice/session-setup.ts");

// A v2 review with the given weak-point judgments and next weak points.
const reviewWith = (weakPoints, next = []) => {
  const copy = structuredClone(reviewV2);
  copy.sessionGoals.weakPoints = weakPoints.map(([point, status]) => ({ point, status, evidence: status === "not_observed" ? null : "x" }));
  copy.nextWeakPoints = next.map((en) => ({ en, vi: `vi: ${en}` }));
  return copy;
};
const texts = (carried) => carried.map((item) => item.text);

test("newest first: still_present, then next weak points, then not_observed; duplicates removed case-insensitively", () => {
  const carried = mergeCarryOver([
    { sessionId: "s3", review: reviewWith([["Past simple", "still_present"], ["Articles", "not_observed"]], ["Linking words"]) },
    { sessionId: "s2", review: reviewWith([["past SIMPLE", "still_present"]], ["Phrasal verbs", "linking words"]) },
  ]);
  assert.deepEqual(carried, [
    { text: "Past simple", sourceSessionId: "s3" }, { text: "Linking words", sourceSessionId: "s3" },
    { text: "Articles", sourceSessionId: "s3" }, { text: "Phrasal verbs", sourceSessionId: "s2" },
  ]);
});

test("a point marked improved in a newer review is dropped from older ones", () => {
  const carried = mergeCarryOver([
    { sessionId: "s3", review: reviewWith([["Past simple", "improved"]], ["Prepositions of time"]) },
    { sessionId: "s2", review: reviewWith([["past simple", "still_present"], ["Articles", "still_present"]], ["Past Simple"]) },
  ]);
  assert.deepEqual(texts(carried), ["Prepositions of time", "Articles"]);
});

test("at most 5 items from at most the 3 latest reviews; items that break the weak-point rules are skipped", () => {
  const sources = ["s4", "s3", "s2", "s1"].map((id) => ({ sessionId: id, review: reviewWith([], [`${id} point A`, `${id} point B`]) }));
  assert.deepEqual(texts(mergeCarryOver(sources)), ["s4 point A", "s4 point B", "s3 point A", "s3 point B", "s2 point A"]);
  assert.deepEqual(texts(mergeCarryOver(sources.slice(2).reverse())), ["s1 point A", "s1 point B", "s2 point A", "s2 point B"]);
  const odd = reviewWith([], ["Tenses; articles", "x".repeat(121), "  Word   order  "]);
  assert.deepEqual(texts(mergeCarryOver([{ sessionId: "s1", review: odd }])), ["Word order"]);
});

test("sources are the latest v2 reviews; v1 and corrupt reviews are skipped", () => {
  const sources = weakPointSourcesFrom([
    { id: "s5", review }, { id: "s4", review: reviewV2 }, { id: "s3", review: { schemaVersion: 2 } },
    { id: "s2", review: reviewV2 }, { id: "s1", review: reviewV2 }, { id: "s0", review: reviewV2 },
  ]);
  assert.deepEqual(sources.map((source) => source.sessionId), ["s4", "s2", "s1"]);
});

test("the stored source IDs are the sessions whose carried points the learner kept", () => {
  const carried = [{ text: "Past simple", sourceSessionId: "s3" }, { text: "Articles", sourceSessionId: "s3" },
    { text: "Phrasal verbs", sourceSessionId: "s2" }];
  assert.deepEqual(weakPointSourceIds(["past simple", "My own point"], carried), ["s3"]);
  assert.deepEqual(weakPointSourceIds(["Phrasal verbs", "Articles"], carried), ["s3", "s2"]);
  assert.deepEqual(weakPointSourceIds([], carried), []);
});

test("session N+1 starts from session N's weak points, which pass the setup rules and are traced to N", async () => {
  const carried = mergeCarryOver(weakPointSourcesFrom([{ id: "session-n", review: reviewV2 }]));
  assert.deepEqual(texts(carried), ["Past simple", "Past simple of irregular verbs (lead → led)"]);
  assert.ok(validateSessionSetup({ ...setupV2, weakPoints: texts(carried) }).ok);
  // The learner edits the list: keeps one carried point and adds their own.
  const body = { profile: profileV2, setup: { ...setupV2, weakPoints: ["past simple", "Linking words"] } };
  let created;
  const store = {
    adminUid: undefined, dailyCallLimit: 5, now: () => new Date("2026-11-14T03:00:00Z"), carriedWeakPoints: carried,
    onError: (error) => { throw error; },
    transaction: async (apply) => apply({
      readUser: async () => ({ access: { status: "approved", trialUsed: true } }),
      writeUser: () => {},
      createSession: (document) => { created = document; return "session-n1"; },
    }),
  };
  assert.equal((await createPracticeSessionForUser("user-a", { ...body, weakPointsSourceSessionIds: ["forged"] }, store)).status, "ok");
  assert.deepEqual(created.weakPointsSourceSessionIds, ["session-n"], "computed on the server, never from the body");
  assert.deepEqual(created.setup.weakPoints, ["past simple", "Linking words"]);
  delete store.carriedWeakPoints;
  await createPracticeSessionForUser("user-a", body, store);
  assert.deepEqual(created.weakPointsSourceSessionIds, []);
});

test("Firestore adapter: one indexed query for the learner's completed reviews; any failure means no carry-over", async (t) => {
  const calls = [];
  let fail = null;
  const query = {
    where: (...args) => { calls.push(["where", ...args]); return query; },
    orderBy: (...args) => { calls.push(["orderBy", ...args]); return query; },
    limit: (n) => { calls.push(["limit", n]); return query; },
    select: (...fields) => { calls.push(["select", ...fields]); return query; },
    get: async () => {
      if (fail) throw fail;
      return { docs: [{ id: "s2", get: (field) => (field === "review" ? reviewV2 : undefined) }] };
    },
  };
  const logs = [];
  t.mock.method(console, "error", (...args) => logs.push(args));
  const { getWeakPointCarryOver } = loadTs("lib/practice/weak-points-server.ts", {
    "@/firebase/admin": { adminDb: { collection: (name) => { calls.push(["collection", name]); return query; } } },
  });
  assert.deepEqual(texts(await getWeakPointCarryOver("user-a")), ["Past simple", "Past simple of irregular verbs (lead → led)"]);
  assert.deepEqual(calls, [["collection", "practiceSessions"], ["where", "userId", "==", "user-a"],
    ["where", "reviewStatus", "==", "completed"], ["orderBy", "createdAt", "desc"], ["limit", 10], ["select", "review"]]);
  fail = Object.assign(new Error("9 FAILED_PRECONDITION: The query requires an index. https://console.firebase.google.com/..."), { code: 9 });
  assert.deepEqual(await getWeakPointCarryOver("user-a"), []);
  assert.deepEqual(logs, [["[practiceSession.carryOver]", { code: "9" }]], "the provider message and index link are not logged");
});
