import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { loadTs } from "./helpers/load-ts.mjs";
const { createVoiceCall } = loadTs("lib/dograh/call.ts");
function harness(t, save) {
  const callbacks = {}, events = [], states = [];
  let starts = 0, ends = 0, completed = 0, released = 0;
  const widget = { start() { starts++; }, end() { ends++; }, getState: () => ({ connectionStatus: "connected" }) };
  for (const name of ["onCallConnected", "onCallDisconnected", "onCallEnd", "onError", "onStatusChange"]) widget[name] = (fn) => { callbacks[name] = fn; };
  const call = createVoiceCall({ widget, durationMinutes: 5,
    save: save ?? (async (event) => { events.push(event); }), change: (state) => states.push(state),
    completed: () => completed++, release: () => released++, now: () => 1000 });
  t.after(() => call.dispose());
  return { call, callbacks, events, states, starts: () => starts, ends: () => ends, completed: () => completed, released: () => released };
}
test("voice Start is synchronous and repeated clicks only start once", async (t) => {
  const h = harness(t);
  h.call.start(); h.call.start();
  assert.equal(h.starts(), 1);
  h.callbacks.onCallConnected({ workflowRunId: 31 });
  h.call.end();
  await setImmediate();
  assert.deepEqual(h.events.map((e) => e.event), ["connecting", "connected", "disconnected"]);
  assert.equal(h.completed(), 1);
  assert.ok(h.released() > 0);
});
test("microphone rejection fails and never redirects to review", async (t) => {
  const h = harness(t);
  h.call.start();
  h.callbacks.onError({ message: "Permission denied" });
  await setImmediate();
  assert.equal(h.events.at(-1).endReason, "mic_denied");
  assert.equal(h.states.at(-1).status, "failed");
  assert.equal(h.completed(), 0);
});
test("missing run ID and offline connection fail safely", async (t) => {
  for (const scenario of ["missing_id", "offline"]) {
    const h = harness(t); h.call.start();
    if (scenario === "missing_id") h.callbacks.onCallConnected({});
    else { h.callbacks.onCallConnected({ workflowRunId: 31 }); h.call.offline(); }
    await setImmediate();
    assert.equal(h.states.at(-1).status, "failed");
    assert.equal(h.completed(), 0);
  }
});
test("failed persistence prevents later events overtaking it and prevents redirect", async (t) => {
  const events = [];
  const h = harness(t, async (event) => { events.push(event); throw new Error("offline"); });
  h.call.start(); h.callbacks.onCallConnected({ workflowRunId: 31 });
  await setImmediate();
  assert.equal(events.length, 1);
  assert.equal(h.completed(), 0);
  assert.match(h.states.at(-1).error, /save/);
});
test("dispose detaches callbacks and ignores delayed callbacks", async (t) => {
  const h = harness(t); h.call.start();
  const connected = h.callbacks.onCallConnected;
  h.call.dispose(); connected({ workflowRunId: 31 });
  await setImmediate();
  assert.equal(h.callbacks.onCallConnected, null);
  assert.equal(h.events.some((event) => event.event === "connected"), false);
  assert.equal(h.completed(), 0);
});
