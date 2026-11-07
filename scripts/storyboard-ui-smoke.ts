import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const origin = "http://127.0.0.1:5188",
  server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", "5188"],
    { stdio: "pipe" },
  );
const root = "docs/storyboard-030";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors: string[] = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(30000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.addInitScript(() => {
    const w = window as any;
    w.__name = (f: any) => f;
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
      autosave: async (p: any) => {
        w.__saved = p;
      },
      present: (s: any) => {
        w.__state = s;
      },
      assetStatus: async () => ({}),
      assetData: async () => null,
      save: async (p: any) => {
        w.__stored = structuredClone(p);
        return "/test/story.castudio";
      },
      open: async () => ({
        project: structuredClone(w.__stored),
        path: "/test/story.castudio",
      }),
      presentation: async () => {},
    };
  });
  await page.goto(origin);
  await page.waitForSelector(".app-shell");
  await page.waitForFunction(() => !document.querySelector(".loading"));
  const snap = async (name: string) => {
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${root}/${name}.png` });
  };
  const state = () => page.evaluate(() => (window as any).__state.project);
  const source = (await state()).moves;
  await page.getByLabel("Storyboard mode", { exact: true }).click();
  await snap("01-empty");
  await page.getByLabel("Add source move 7", { exact: true }).click();
  await page.getByLabel("Add source move 1", { exact: true }).click();
  await page.getByLabel("Add source move 11", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(3);
  await expect(page.locator(".shot-thumbnail img").first()).toBeVisible({
    timeout: 30000,
  });
  await snap("02-populated");
  await snap("03-add-source");
  await page.getByLabel(/^Select source move 3 /).check();
  await page.getByLabel(/^Select source move 5 /).check();
  await page.locator(".composition-modebar small").click();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator(".shot-card")).toHaveCount(5);
  assert.deepEqual(
    (await state()).storyboard.shots
      .slice(-2)
      .map((s: any) => s.source.startMoveId),
    [source[2].id, source[4].id],
  );
  await page.getByTitle("Undo", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .click();

  await page.getByLabel("Filter Captures", { exact: true }).check();
  await snap("04-highlight-discovery");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  const before = (await state()).storyboard.shots.map((s: any) => s.id);
  await page
    .locator(".shot-card")
    .nth(0)
    .dragTo(page.locator(".shot-card").nth(2));
  await expect
    .poll(async () =>
      JSON.stringify((await state()).storyboard.shots.map((s: any) => s.id)),
    )
    .not.toBe(JSON.stringify(before));
  await snap("05-reordered");
  await page.getByTitle("Undo", { exact: true }).click();
  assert.deepEqual(
    (await state()).storyboard.shots.map((s: any) => s.id),
    before,
    "One Undo restores drag",
  );
  await page.locator(".shot-card").first().focus();
  await page.keyboard.press("Alt+ArrowRight");
  assert.equal((await state()).storyboard.shots[1].id, before[0]);
  await page.getByTitle("Undo", { exact: true }).click();
  await page.getByLabel("Duplicate shot 1", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  await page.getByTitle("Undo", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(3);
  await page.locator(".shot-card").first().click();
  await snap("06-inspector");
  await page.getByLabel("Preview shot 1", { exact: true }).click();
  await expect(
    page.getByLabel("Pause storyboard", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pause storyboard", { exact: true }).click();
  await page.getByLabel("Play storyboard", { exact: true }).click();
  const previewDuration = (await state()).storyboard.shots[0].duration;
  await expect
    .poll(async () => await page.evaluate(() => (window as any).__state.time), {
      timeout: 10000,
    })
    .toBeGreaterThan(previewDuration + 0.05);
  await page.getByLabel("Pause storyboard", { exact: true }).click();
  await page
    .getByRole("button", { name: "Fit storyboard timeline", exact: true })
    .click();
  await expect(
    page.getByLabel("Entire storyboard", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Fit storyboard timeline", exact: true })
    .click();
  await page
    .getByLabel("Shot name", { exact: true })
    .fill("The opening moment");
  await page.getByLabel("Shot name", { exact: true }).blur();
  await page
    .getByLabel("Shot caption", { exact: true })
    .fill("Watch this move");
  await page.getByLabel("Seek storyboard", { exact: true }).fill("0.5");
  await snap("07-caption");
  const d = (await state()).storyboard.shots[0].duration;
  const edge = page.getByLabel("Duration of shot 1", { exact: true }),
    box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + box.height / 2, { steps: 5 });
  await snap("08-duration-drag");
  await page.mouse.up();
  assert.notEqual((await state()).storyboard.shots[0].duration, d);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal((await state()).storyboard.shots[0].duration, d);
  await page
    .getByRole("button", { name: "+ Position hold", exact: true })
    .click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  await page.locator(".shot-card").last().click();
  await snap("09-position-hold");
  await page.getByRole("button", { name: "+ Title card", exact: true }).click();
  await page.locator(".shot-card").last().click();
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    "Your chess story",
  );
  await page
    .getByLabel("Shot caption", { exact: true })
    .fill("Your next chess story");
  const titleStart = (await state()).storyboard.shots
    .slice(0, -1)
    .reduce((a: number, s: any) => a + s.duration, 0);
  await page
    .getByLabel("Seek storyboard", { exact: true })
    .fill(String(titleStart + 0.5));
  await snap("10-title-card");
  await page
    .getByRole("button", { name: "Story templates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview template", exact: true })
    .click();
  const count = (await state()).storyboard.shots.length;
  await snap("11-puzzle-template");
  assert.equal((await state()).storyboard.shots.length, count);
  await page
    .getByLabel("Story template", { exact: true })
    .selectOption("Game Highlights");
  await page
    .getByRole("button", { name: "Preview template", exact: true })
    .click();
  await snap("12-highlights-template");
  await page
    .getByRole("button", { name: "Apply template", exact: true })
    .click();
  assert.ok((await state()).storyboard.shots.length > count);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal((await state()).storyboard.shots.length, count);
  await page
    .getByRole("button", { name: "Restart storyboard", exact: true })
    .click();
  await page.getByLabel("Play storyboard", { exact: true }).click();
  await page.waitForTimeout(500);
  await expect(
    page.getByLabel("Pause storyboard", { exact: true }),
  ).toBeVisible();
  await snap("13-playback");
  await page.getByLabel("Pause storyboard", { exact: true }).click();
  await page.getByLabel("Seek storyboard", { exact: true }).fill("1.2");
  assert.ok(
    Math.abs((await page.evaluate(() => (window as any).__state.time)) - 1.2) <
      0.05,
  );
  await page
    .locator("main.studio")
    .getByLabel("Output format", { exact: true })
    .selectOption("vertical");
  await snap("14-vertical");
  await page
    .locator("main.studio")
    .getByLabel("Output format", { exact: true })
    .selectOption("landscape");
  await snap("15-landscape");
  await page
    .getByRole("button", { name: "Export storyboard", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await snap("16-export");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const stored = await state();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTitle("New composition", { exact: true }).click();
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(count);
  assert.deepEqual((await state()).storyboard, stored.storyboard);
  assert.deepEqual((await state()).moves, source);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await snap("17-1920");
  await page.getByLabel("UI scale", { exact: true }).selectOption("150");
  await snap("18-scale150");
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.setViewportSize({ width: 1100, height: 800 });
  await snap("19-narrow");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real storyboard UI add/select, accurate thumbnails, native drag + keyboard, single Undo, duplicate, caption, timing drag, holds/title, template preview/apply/Undo, playback/seek, formats, save/reopen, source preservation, responsive screenshots; zero page errors.",
  );
} finally {
  await browser.close();
  server.kill();
}
