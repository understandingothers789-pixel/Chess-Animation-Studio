/** Focused reproduction of the same browser checks/benchmark used by visual CI. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const port = "5187",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage();
  await page.addInitScript("globalThis.__name=(fn)=>fn;");
  await page.route("**/cinematic-test.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    }),
  );
  await page.goto(origin + "/cinematic-test.html");
  console.log(
    JSON.stringify(
      await page.evaluate(async () =>
        (
          await import("/scripts/browser-cinematic.ts" as string)
        ).verifyCinematic(),
      ),
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
