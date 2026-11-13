import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const quota = loadTs("lib/practice/call-quota.ts");
const at = (iso) => new Date(iso);

test("PRACTICE_DAILY_CALL_LIMIT: a positive integer, otherwise 5", () => {
  assert.equal(quota.dailyCallLimit("3"), 3);
  assert.equal(quota.dailyCallLimit(" 12 "), 12);
  for (const raw of [undefined, "", "0", "-2", "2.5", "five", "1e3", "99999999999999999999"]) {
    assert.equal(quota.dailyCallLimit(raw), 5, String(raw));
  }
});

test("the day is the calendar day in Vietnam (UTC+7), resetting at local midnight", () => {
  assert.equal(quota.quotaDay(at("2026-11-13T16:59:59.999Z")), "2026-11-13");
  assert.equal(quota.quotaDay(at("2026-11-13T17:00:00.000Z")), "2026-11-14");
  assert.equal(quota.quotaResetsAt(at("2026-11-13T05:00:00.000Z")), "2026-11-13T17:00:00.000Z");
  assert.equal(quota.quotaResetsAt(at("2026-11-13T17:00:00.000Z")), "2026-11-14T17:00:00.000Z");
  assert.equal(quota.quotaResetsAt(at("2026-12-31T20:00:00.000Z")), "2027-01-01T17:00:00.000Z");
});

test("stored quotas from another day, or malformed ones, count as zero", () => {
  const now = at("2026-11-13T05:00:00.000Z");
  assert.equal(quota.callsUsedToday({ day: "2026-11-13", used: 3 }, now), 3);
  for (const stored of [undefined, null, { day: "2026-11-12", used: 5 }, { day: "13/11/2026", used: 1 },
    { day: "2026-11-13", used: -1 }, { day: "2026-11-13", used: 1.5 }, { day: "2026-11-13", used: "2" }]) {
    assert.equal(quota.callsUsedToday(stored, now), 0, JSON.stringify(stored));
  }
  assert.deepEqual(quota.callQuotaView({ day: "2026-11-13", used: 7 }, now, 5),
    { limit: 5, used: 7, remaining: 0, resetsAt: "2026-11-13T17:00:00.000Z" }, "a lowered limit never goes negative");
});

test("consuming a call counts up to the limit, then refuses until the next day", () => {
  const now = at("2026-11-13T05:00:00.000Z");
  assert.deepEqual(quota.consumeCall(undefined, now, 5), { ok: true, quota: { day: "2026-11-13", used: 1 } });
  assert.deepEqual(quota.consumeCall({ day: "2026-11-13", used: 4 }, now, 5), { ok: true, quota: { day: "2026-11-13", used: 5 } });
  assert.deepEqual(quota.consumeCall({ day: "2026-11-13", used: 5 }, now, 5),
    { ok: false, limit: 5, resetsAt: "2026-11-13T17:00:00.000Z" });
  assert.deepEqual(quota.consumeCall({ day: "2026-11-12", used: 5 }, now, 5), { ok: true, quota: { day: "2026-11-13", used: 1 } });
});
