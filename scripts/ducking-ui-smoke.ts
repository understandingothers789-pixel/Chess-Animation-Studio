import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { readProject } from "../desktop/files";
const fixture = await readProject("test-results/ducking/fixture.castudio");
fixture.format = "vertical";
const audio = Object.fromEntries(
  await Promise.all(
    fixture.assets.map(async (a) => [
      a.id,
      "data:audio/wav;base64," + (await fs.readFile(a.path)).toString("base64"),
    ]),
  ),
);
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5193"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5193")).ok) break;
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
    viewport: { width: 1600, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(30000);
  await page.addInitScript(
    ({ fixture, audio }) => {
      const w = window as any;
      w.__name = (f: any) => f;
      w.__stored = fixture;
      w.studio = {
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
        present: (s: any) => {
          w.__state = s;
        },
        assetStatus: async () => ({}),
        assetData: async (a: any) => audio[a.id],
        open: async () => ({
          project: structuredClone(w.__stored),
          path: "/test/duck.castudio",
        }),
        save: async (p: any) => {
          w.__stored = structuredClone(p);
          return "/test/duck.castudio";
        },
      };
    },
    { fixture, audio },
  );
  await page.goto("http://127.0.0.1:5193");
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  await page.locator(".shot-card").nth(1).click();
  await expect(
    page.getByLabel("Lower music during this shot", { exact: true }),
  ).toBeChecked();
  const state = () => page.evaluate(() => (window as any).__state.project);
  await page.getByLabel("Ducked music level value", { exact: true }).fill("40");
  await expect
    .poll(async () => (await state()).storyboard.shots[1].musicDucking.volume)
    .toBe(0.4);
  await page.getByTitle("Undo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).storyboard.shots[1].musicDucking.volume)
    .toBe(0.25);
  await page.getByTitle("Redo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).storyboard.shots[1].musicDucking.volume)
    .toBe(0.4);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Saved composition", { exact: true }),
  ).toBeVisible();
  await page.getByTitle("Open composition", { exact: true }).click();
  await page.locator(".shot-card").nth(1).click();
  await expect(
    page.getByLabel("Ducked music level value", { exact: true }),
  ).toHaveValue("40");
  await page.screenshot({ path: "docs/ducking-032/inspector.png" });
  await page.locator(".story-waveform>summary").click();
  await page.locator(".story-waveform").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/ducking-032/waveform.png" });
  assert.deepEqual((await state()).moves, fixture.moves);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: duck inspector, Undo/Redo, save/reopen, waveform, source preservation; zero page errors",
  );
} finally {
  await browser?.close();
  server.kill();
}
