/** Focused reproduction of the same browser checks/benchmark used by visual CI. */
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
const port = "5188",
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
  const frames = await page.evaluate(async () =>
    (await import("/scripts/browser-phase4.ts" as string)).phase4Frames(),
  );
  const root = "test-results/phase4-candidate";
  await fs.mkdir(root, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const frame of frames) {
    const bytes = Buffer.from(frame.png, "base64");
    hashes[frame.key] = createHash("sha256").update(bytes).digest("hex");
    await fs.writeFile(`${root}/${frame.key}.png`, bytes);
  }
  await fs.writeFile(`${root}/hashes.json`, JSON.stringify(hashes, null, 2));
  const approved = process.env.CINEMATIC_GOLDEN_DIR ?? "docs/cinematic-goldens";
  if (process.env.APPROVE_CINEMATIC_GOLDENS === "phase4-reviewed") {
    await fs.mkdir(approved, { recursive: true });
    for (const file of await fs.readdir(root))
      await fs.copyFile(`${root}/${file}`, `${approved}/${file}`);
    console.log(
      "Created explicit golden proposal; review and commit the PNG diff before accepting.",
    );
  } else
    assert.deepEqual(
      hashes,
      JSON.parse(await fs.readFile(`${approved}/hashes.json`, "utf8")),
      "Cinematic golden mismatch: inspect test-results/phase4-candidate; approval must be explicit",
    );
  console.log(
    `PASS: ${frames.length} cinematic/bloom goldens, all formats, resize and backward seeks, independent export equality`,
  );
} finally {
  await browser?.close();
  server.kill();
}
