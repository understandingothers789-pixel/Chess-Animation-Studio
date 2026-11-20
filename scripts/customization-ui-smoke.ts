/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { sample } from "../src/core/chess";
import { uid } from "../src/core/project";
import { spawn } from "node:child_process";
const port = "5196",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port],
  { stdio: "pipe" },
);
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
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as any).__name = (fn: unknown) => fn;
    const w = window as any;
    w.studio = {
      settings: async () => ({
        ffmpeg: "/usr/bin/ffmpeg",
        stockfish: "",
        encoder: "auto",
        tokenPresent: false,
      }),
      export: async (project: unknown, options: unknown) => {
        w.__export = { project, options };
        return true;
      },
      recent: async () => [],
      recover: async () => null,
      onAnalysis: () => () => {},
      onExport: () => () => {},
      autosave: async (p: unknown) => {
        w.__saved = p;
      },
      present: (s: unknown) => {
        w.__state = s;
      },
      assetStatus: async () => ({}),
      assetData: async () => null,
    };
  });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  await page.goto(origin);
  await page.waitForSelector(".app-shell", { timeout: 90000 });
  await page.waitForFunction(() => !!(window as any).__state);
  await fs.mkdir("test-results/customization", { recursive: true });
  const fixture = sample();
  fixture.beats = [
    { id: uid(), time: 3.5, enabled: true, accent: true },
    { id: uid(), time: 4, enabled: true, accent: false },
  ];
  await page.evaluate((fixture) => {
    (window as any).studio.sample = async () => fixture;
  }, fixture);
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Open Opera Game with original music",
      exact: false,
    })
    .click();
  const state = () => page.evaluate(() => (window as any).__state.project);
  await page
    .getByRole("button", { name: "Add animation or effect", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Flip + smooth beat zoom", exact: true })
    .click();
  await expect(
    page.getByLabel("Beat zoom rhythm", { exact: true }),
  ).toBeInViewport();
  let p = await state();
  assert.equal(p.moves[0].effect.preset, "somersault");
  assert.equal(p.moves[0].effect.jam.rhythm, "swell");
  assert.equal(p.moves[0].effect.jam.enabled, true);
  await page.locator('.inspector [data-tab="move"]').click();
  await expect(
    page.getByLabel("Size during move", { exact: true }),
  ).toHaveValue("constant");
  await page
    .getByLabel("Size during move", { exact: true })
    .selectOption("smooth");
  await page.getByLabel("Peak piece size value", { exact: true }).fill("140");
  await page.getByLabel("Size return span value", { exact: true }).fill("65");
  await page.setViewportSize({ width: 1366, height: 768 });
  const frameStrip = page.locator(".move-frames");
  await frameStrip.locator("summary").click();
  await expect(frameStrip.locator("img")).toHaveCount(4, { timeout: 15000 });
  await page
    .getByRole("button", { name: "View mid-move frame", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View mid-move frame", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Next frame of move", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "View mid-move frame", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Next frame of move", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/customization/move-frames-laptop.png",
  });
  await frameStrip.locator("summary").click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByText("Align landing · active move e4", { exact: true })
    .click();
  const before = (await state()).moves[0].effect.duration;
  await page.getByRole("button", { name: "Nearest beat", exact: true }).click();
  assert.equal((await state()).moves[0].effect.duration, before);
  await expect(page.getByText(/Proposed landing/)).toBeVisible();
  await page
    .getByRole("button", { name: "Apply landing alignment", exact: true })
    .click();
  assert.notEqual((await state()).moves[0].effect.duration, before);
  await page.getByLabel("Lock timing", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Nearest beat", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Lock timing", { exact: true }).uncheck();
  await page
    .getByLabel("Preset name", { exact: true })
    .fill("My flip and zoom");
  await page
    .getByLabel("Save preset category", { exact: true })
    .selectOption("everything");
  await page
    .getByRole("button", { name: "Save as reusable preset", exact: true })
    .click();
  await page.getByRole("button", { name: "presets", exact: true }).click();
  await page
    .getByLabel("Search animation presets", { exact: true })
    .fill("My flip");
  await page
    .locator(".animation-card")
    .filter({ hasText: "My flip and zoom" })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByLabel("Preset settings category", { exact: true }),
  ).toHaveValue("everything");
  await page
    .getByText("Personal preset library · this computer", { exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Save selected to personal library",
      exact: true,
    })
    .click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("studio.personalPresets")!),
  );
  assert.equal(saved[0].name, "My flip and zoom");
  assert.equal(saved[0].effect.sizeProfile, "smooth");
  assert.equal(saved[0].effect.sizeReturn, 0.65);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download preset", exact: true })
    .click();
  await (
    await download
  ).saveAs("test-results/customization/flip.chess-preset.json");
  await page
    .getByLabel("Import preset", { exact: true })
    .setInputFiles("test-results/customization/flip.chess-preset.json");
  await page.waitForFunction(
    () => (window as any).__state.project.presets.length === 2,
  );
  assert.equal((await state()).presets.length, 2);
  await page.getByLabel("Search animation presets", { exact: true }).fill("");
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(size);
    for (const scale of ["100", "150"]) {
      await page.getByLabel("UI scale", { exact: true }).selectOption(scale);
      await page.locator(".preset-drawer").evaluate((e) => (e.scrollTop = 0));
      const box = await page.locator(".animation-card").first().boundingBox();
      assert.ok(
        box && box.y < size.height - 60,
        "Preset choices must be visible above the fold",
      );
      await page.screenshot({
        path: `test-results/customization/library-${size.width}-${scale}.png`,
      });
    }
  }
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator(".library")).toBeHidden();
  await expect(page.locator(".inspector-host")).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Close animation library", exact: true })
    .click();
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.getByLabel("Playback speed", { exact: true }).selectOption("0.5");
  await page
    .getByRole("button", { name: "Preview this move", exact: true })
    .click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByLabel("Playback speed", { exact: true }).selectOption("1");
  await page.locator('.move-clip[data-move-index="0"] .clip-select').click();
  await page.locator('.inspector [data-tab="move"]').click();
  await page.getByLabel("Lock timing", { exact: true }).check();
  const lockedDuration = (await state()).moves[0].effect.duration;
  await page
    .locator('.move-clip[data-move-index="1"] .clip-select')
    .click({ modifiers: ["Control"] });
  await page
    .getByRole("button", { name: "Add animation or effect", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Flip + smooth beat zoom", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      (window as any).__state.project.moves[1].effect.preset === "somersault",
  );
  const group = await state();
  assert.equal(group.moves[0].effect.duration, lockedDuration);
  assert.equal(group.moves[1].effect.jam.enabled, true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: recipe, landing proposal/commit/lock, preset category/save/import/export, personal library, laptop/large layouts and preview speed.",
  );
} finally {
  await browser.close();
  server.kill();
}
