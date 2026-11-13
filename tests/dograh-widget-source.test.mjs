import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const { selectWidgetSource, widgetSourceVariable } = loadTs("lib/dograh/widget.ts");

const env = {
  DOGRAH_WIDGET_SRC_AMERICAN: "  https://app.dograh.com/embed/dograh-widget.js?token=american  ",
  DOGRAH_WIDGET_SRC_BRITISH: "https://app.dograh.com/embed/dograh-widget.js?token=british",
};

test("the widget URL is chosen by the session accent; legacy sessions use the American workflow", () => {
  assert.equal(widgetSourceVariable("american"), "DOGRAH_WIDGET_SRC_AMERICAN");
  assert.equal(widgetSourceVariable("british"), "DOGRAH_WIDGET_SRC_BRITISH");
  assert.equal(selectWidgetSource({ status: "ready", profile: { accent: "british" } }, env), env.DOGRAH_WIDGET_SRC_BRITISH);
  assert.equal(selectWidgetSource({ status: "ready", profile: { accent: "american" } }, env), env.DOGRAH_WIDGET_SRC_AMERICAN.trim());
  assert.equal(selectWidgetSource({ status: "ready" }, env), env.DOGRAH_WIDGET_SRC_AMERICAN.trim());
});

test("only a callable (ready) session receives the URL", () => {
  for (const status of ["connecting", "active", "completed", "failed"]) {
    assert.equal(selectWidgetSource({ status, profile: { accent: "american" } }, env), undefined, status);
  }
});

test("a missing or blank variable yields no URL, so the client reports the variable name", () => {
  assert.equal(selectWidgetSource({ status: "ready", profile: { accent: "british" } }, {}), undefined);
  assert.equal(selectWidgetSource({ status: "ready", profile: { accent: "british" } }, { DOGRAH_WIDGET_SRC_BRITISH: "  " }), undefined);
});

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("no app code reads the embed URLs from NEXT_PUBLIC_ variables (they would be inlined into the public bundle)", () => {
  for (const file of ["app", "components", "lib"].flatMap(sourceFiles)) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /NEXT_PUBLIC_DOGRAH/, file);
  }
  assert.doesNotMatch(readFileSync("components/fluent/use-dograh-widget.ts", "utf8"), /process\.env/);
});
