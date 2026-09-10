import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Optional browser tooling can be installed separately from application dependencies.
const require = createRequire(resolve(process.env.BROWSER_TEST_TOOLING ?? process.cwd(), "package.json"));
const { chromium } = require("playwright");
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of ["/sign-in", "/register"]) {
      const response = await page.goto(new URL(path, base).href);
      assert.equal(response.status(), 200);
      await page.locator('input[type="email"]').waitFor({ state: "visible" });
      await page.locator('input[type="password"]').first().waitFor({ state: "visible" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      console.log(`PASS browser ${viewport.width}px ${path}: form visible, no horizontal overflow`);
    }
    await page.goto(new URL("/voice-call?sessionId=session-a", base).href);
    await page.waitForURL("**/sign-in");
    assert.deepEqual(errors, []);
    console.log(`PASS browser ${viewport.width}px: auth redirect, no uncaught page errors`);
    await page.close();
  }
} finally {
  await browser.close();
}
