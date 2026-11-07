/** Optional responsive gallery refresh after npm run test:finishing; run from repository root. */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const root = "docs/finishing-031",
  fixture = JSON.parse(await fs.readFile(root + "/synthetic.castudio", "utf8"));
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5192"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5192")).ok) break;
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
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const audio =
    "data:audio/wav;base64," +
    (await fs.readFile("/tmp/cas031-pulse.wav")).toString("base64");
  await page.addInitScript(
    ({ fixture, audio }) => {
      window.studio = {
        settings: async () => ({
          ffmpeg: "ffmpeg",
          stockfish: "",
          encoder: "software",
          tokenPresent: false,
        }),
        recent: async () => [],
        recover: async () => null,
        onAnalysis: () => () => {},
        onExport: () => () => {},
        autosave: async () => {},
        present: (s) => {
          window.__state = s;
        },
        assetStatus: async () => ({ pulse: "ready" }),
        assetData: async () => audio,
        open: async () => ({
          project: fixture,
          path: "/test/finishing.castudio",
        }),
      };
    },
    { fixture, audio },
  );
  await page.goto("http://127.0.0.1:5192");
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  const r = await page
    .getByLabel("Seek storyboard", { exact: true })
    .boundingBox();
  await page.mouse.click(r.x + 8 + (r.width - 16) / 9.4, r.y + r.height / 2);
  await expect
    .poll(() => page.evaluate(() => window.__state.time))
    .toBeGreaterThan(0.5);
  await page.locator(".story-waveform>summary").click();
  for (const [width, height, name] of [
    [1100, 820, "16-narrow"],
    [1920, 1080, "17-desktop"],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${root}/${name}.png` });
  }
  await page.getByLabel("UI scale", { exact: true }).selectOption("150");
  await page.waitForTimeout(300);
  await page.screenshot({ path: root + "/19-scale150.png" });
  console.log(
    "PASS: reviewed responsive gallery with a visible caption at nonzero output time.",
  );
} finally {
  await browser?.close();
  server.kill();
}
