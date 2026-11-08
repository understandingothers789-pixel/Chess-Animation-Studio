import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { readProject } from "../desktop/files";
import { blank } from "../src/core/project";
import { titleShot } from "../src/core/storyboard";
import { annotation } from "../src/core/annotations";
const fixture = blank();
fixture.format = "vertical";
fixture.storyboard.shots = [titleShot(fixture, "Composition", 4)];
fixture.storyboard.shots[0].annotations = [0, 1, 2].map((i) => ({
  ...annotation("caption", 0),
  id: "text" + i,
  text: [
    "FIND THE WINNING MOVE",
    "White to move",
    "This bishop sacrifice wins the queen and ends the game",
  ][i],
  y: [0.15, 0.55, 0.8][i],
  end: 4,
  entrance: "none" as const,
  exit: "none" as const,
  layout: {
    ...annotation("caption", 0).layout,
    maxWidth: i === 2 ? 0.5 : 0.88,
    autoSize: false,
  },
}));
const audio = {};
await fs.mkdir("docs/composition-033", { recursive: true });
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5194"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5194")).ok) break;
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
  await page.goto("http://127.0.0.1:5194");
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(1);
  await page.locator(".shot-card").first().click();
  const state = () => page.evaluate(() => (window as any).__state.project);
  const layer = page.locator('[data-annotation-id="text2"]');
  await expect(layer).toBeVisible();
  await layer.click();
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    fixture.storyboard.shots[0].annotations[2].text,
  );
  await expect(layer).toHaveClass(/text-selected/);
  await page.screenshot({ path: "docs/composition-033/selected-layers.png" });
  const box = (await layer.boundingBox())!;
  const before = (await state()).storyboard.shots[0].annotations[2];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 - 45,
    { steps: 8 },
  );
  await page.screenshot({ path: "docs/composition-033/dragging.png" });
  await page.mouse.up();
  await expect
    .poll(async () => (await state()).storyboard.shots[0].annotations[2].y)
    .not.toBe(before.y);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.deepEqual((await state()).storyboard.shots[0].annotations[2], before);
  await page.getByTitle("Redo", { exact: true }).click();
  const handle = page.getByLabel("Resize text width", { exact: true });
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 60, hb.y + hb.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  const resized = (await state()).storyboard.shots[0].annotations[2];
  assert(resized.layout.maxWidth > before.layout.maxWidth);
  assert.equal(resized.size, before.size);
  await page.screenshot({ path: "docs/composition-033/resizing.png" });
  await layer.focus();
  await page.keyboard.press("ArrowLeft");
  const nudged = (await state()).storyboard.shots[0].annotations[2];
  assert(nudged.x < resized.x);
  await page
    .getByRole("button", { name: "Duplicate layer", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).storyboard.shots[0].annotations.length)
    .toBe(4);
  await page
    .getByLabel("Shot caption", { exact: true })
    .fill("Another editable layer");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTitle("Open composition", { exact: true }).click();
  await page.locator(".shot-card").first().click();
  assert.equal(
    (await state()).storyboard.shots[0].annotations[3].text,
    "Another editable layer",
  );
  await page
    .getByRole("button", { name: "Caption guides", exact: true })
    .click();
  await page.screenshot({ path: "docs/composition-033/safe-guides.png" });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.screenshot({ path: "docs/composition-033/narrow.png" });
  assert.deepEqual((await state()).moves, fixture.moves);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: multi-layer selection, live dragging, one-step Undo/Redo, resizing without font mutation, keyboard nudge, duplicate, persistence, source preservation",
  );
} finally {
  await browser?.close();
  server.kill();
}
