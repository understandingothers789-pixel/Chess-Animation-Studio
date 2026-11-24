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
  const preview = page.locator(".preview-host canvas");
  await expect(preview).toBeVisible();
  await page.evaluate(async () => {
    const { Scene } = await import("/src/render/Scene.ts" as string);
    const render = Scene.prototype.render;
    (window as any).__previewDraws = 0;
    Scene.prototype.render = function (...args: Parameters<typeof render>) {
      (window as any).__previewDraws++;
      return render.apply(this, args);
    };
  });
  const drawCount = () =>
    page.evaluate(() => (window as any).__previewDraws as number);
  const canvasWidth = () =>
    preview.evaluate((canvas: HTMLCanvasElement) => canvas.width);
  await page.getByLabel("Seek composition", { exact: true }).fill("3");
  await expect.poll(drawCount).toBeGreaterThan(0);
  // A paused preview should settle with zero further draw calls.
  await page.waitForTimeout(100);
  const idleDraws = await drawCount();
  await page.waitForTimeout(400);
  assert.equal(
    await drawCount(),
    idleDraws,
    "Paused preview must not schedule repeated renders",
  );
  const originalWidth = await canvasWidth();
  await page.setViewportSize({ width: 1200, height: 700 });
  await expect.poll(canvasWidth).not.toBe(originalWidth);
  const resizedWidth = await canvasWidth();
  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  assert.match((await png).suggestedFilename(), /frame\.png$/);
  await expect.poll(canvasWidth).toBe(resizedWidth);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(canvasWidth).toBe(originalWidth);
  await preview.evaluate((canvas: HTMLCanvasElement) =>
    canvas
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext(),
  );
  await page
    .getByRole("button", { name: "Reload graphics", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reload graphics", exact: true }),
  ).toHaveCount(0);
  await expect.poll(canvasWidth).toBe(originalWidth);
  console.log(
    "PASS: paused redraw stops, preview seeks and resizes, PNG restores the canvas, context loss recovers.",
  );
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
  const options = page
    .getByLabel("Move preset", { exact: true })
    .locator("option");
  const descriptions = await options.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("title")),
  );
  assert.equal(descriptions.length, 11);
  assert.ok(descriptions.every((description) => !!description?.trim()));
  const original = JSON.stringify(await state());
  await page
    .getByRole("button", { name: "Preview move presets", exact: true })
    .click();
  const demo = page.getByRole("dialog", {
    name: "Move preset preview",
    exact: true,
  });
  const demoCanvas = demo.getByLabel("Example chess animation", {
    exact: true,
  });
  const pixels = () =>
    demoCanvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
  const pause = demo.getByRole("button", { name: "Pause demo", exact: true });
  await expect(pause).toBeEnabled();
  await pause.click();
  const hop = demo.getByRole("button", { name: "Soft hop", exact: true });
  await hop.hover();
  await expect(
    demo.getByRole("tooltip").filter({ hasText: "Rises off the board" }),
  ).toBeVisible();
  await hop.click();
  const scrub = demo.getByLabel("Scrub preset demo", { exact: true });
  await scrub.fill("0");
  const start = await pixels();
  await scrub.fill("0.67");
  assert.notEqual(
    await pixels(),
    start,
    "Scrubbing must change the rendered animation",
  );
  await demo.getByRole("button", { name: "Restart", exact: true }).click();
  assert.equal(await pixels(), start, "Restart must restore the initial pose");
  assert.equal(
    JSON.stringify(await state()),
    original,
    "Previewing must not edit the project",
  );
  await page.keyboard.press("Escape");
  await expect(demo).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Preview move presets", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Preview move presets", exact: true })
    .click();
  await expect(
    demo.getByRole("button", { name: "Play demo", exact: true }),
  ).toBeEnabled();
  const dramatic = demo.getByRole("button", {
    name: "Dramatic landing",
    exact: true,
  });
  await dramatic.focus();
  await expect(
    demo.getByRole("tooltip").filter({ hasText: "full turn" }),
  ).toBeVisible();
  await dramatic.click();
  await scrub.fill("0.85");
  await page.screenshot({
    path: "test-results/customization/preset-preview.png",
  });
  await demo
    .getByRole("button", { name: "Apply movement", exact: true })
    .click();
  await expect(demo).toHaveCount(0);
  await expect
    .poll(async () => (await state()).moves[0].effect.preset)
    .toBe("dramatic");
  await page.emulateMedia({ reducedMotion: "no-preference" });
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
    .getByRole("button", { name: "Add animation or effect", exact: true })
    .click();
  await page
    .getByRole("button", { name: "3D piece flip", exact: true })
    .click();
  await expect
    .poll(async () => (await state()).style.pieceSet)
    .toBe("sculpted");
  assert.equal((await state()).moves[0].effect.axis, "x");
  assert.equal((await state()).moves[0].effect.scale, 1.4);
  assert.equal((await state()).moves[0].effect.sizeReturn, 0.65);
  await page
    .getByRole("navigation", { name: "Move effect modules" })
    .getByRole("button", { name: "After effect", exact: true })
    .click();
  const after = page.getByLabel("After-effect type", { exact: true });
  await after.selectOption("size-pulse");
  await page
    .getByLabel("After-effect delay value", { exact: true })
    .fill("0.2");
  await page
    .getByLabel("After-effect duration value", { exact: true })
    .fill("0.6");
  await page
    .getByLabel("After-effect strength value", { exact: true })
    .fill("60");
  assert.deepEqual((await state()).moves[0].effect.after, {
    kind: "size-pulse",
    delay: 0.2,
    duration: 0.6,
    strength: 0.6,
  });
  await frameStrip.locator("summary").click();
  await expect(frameStrip.locator("img")).toHaveCount(6, { timeout: 20000 });
  const peak = frameStrip.getByRole("button", {
    name: "View after-effect peak frame",
    exact: true,
  });
  await page
    .getByRole("button", { name: "View after-effect peak", exact: true })
    .click();
  await expect(peak).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Reload graphics", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/customization/sculpted-after-effect.png",
  });
  await frameStrip.locator("summary").click();
  await page.getByLabel("Lock timing", { exact: true }).check();
  await expect(after).toBeDisabled();
  await expect(
    page.getByLabel("After-effect duration value", { exact: true }),
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
    .getByRole("button", {
      name: "Pop-up preview for Capture flip",
      exact: true,
    })
    .click();
  await expect(
    demo.getByRole("button", { name: "Capture flip", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await demo.getByRole("button", { name: "Close", exact: true }).click();
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
  assert.equal(saved[0].effect.after.kind, "size-pulse");
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
  await page.locator('.move-clip[data-move-index="0"] .clip-select').click();
  await page.locator('.inspector [data-tab="move"]').click();
  await page.getByLabel("Lock timing", { exact: true }).uncheck();
  await page.evaluate(() => {
    const w = window as any;
    w.studio.importAsset = async () => ({
      id: "meme-image",
      name: "Reaction.svg",
      path: "/fixtures/reaction.svg",
      kind: "image",
      source: "Fixture",
      guidance: "",
    });
    w.studio.assetData = async () =>
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#ff0080"/></svg>',
      );
  });
  await page
    .getByRole("button", { name: "Add animation or effect", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Add animation or effect", exact: true })
    .getByRole("button", { name: "Starting-square meme", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import meme image", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Meme preview cropped to a square" }),
  ).toBeVisible();
  await page.getByLabel("Meme duration value", { exact: true }).fill("0.65");
  await expect
    .poll(async () => (await state()).moves[0].effect.preMoveMeme)
    .toEqual({
      asset: "meme-image",
      duration: 0.65,
    });
  assert.equal((await state()).moves[1].effect.preMoveMeme, null);
  await page
    .getByRole("button", { name: "Preview meme on board", exact: true })
    .click();
  await frameStrip.locator("summary").click();
  await expect(frameStrip.locator("img")).toHaveCount(7, { timeout: 20000 });
  await frameStrip
    .getByRole("button", { name: "View meme frame", exact: true })
    .click();
  await expect(
    frameStrip.getByRole("button", { name: "View meme frame", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/customization/starting-square-meme.png",
  });
  await page.getByLabel("Meme image", { exact: true }).selectOption("");
  await expect
    .poll(async () => (await state()).moves[0].effect.preMoveMeme)
    .toBeNull();
  await page.getByRole("button", { name: "board", exact: true }).click();
  await page
    .getByLabel("Board palette", { exact: true })
    .selectOption("monochrome");
  await expect.poll(async () => (await state()).style.dark).toBe("#858589");
  await expect.poll(async () => (await state()).style.light).toBe("#F5F5F5");
  await page
    .getByLabel("Piece artwork", { exact: true })
    .selectOption("merida");
  await expect(
    page.getByLabel("Edge depth value", { exact: true }),
  ).toHaveValue("40");
  await page.getByLabel("Edge depth value", { exact: true }).fill("57");
  await expect
    .poll(async () => (await state()).style.pieceEdgeDepth)
    .toBe(0.57);

  await page.getByRole("button", { name: "framing", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit intro clip →", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import player photo", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Player photo preview", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Player name", { exact: true }).fill("Example player");
  await page
    .getByLabel("Player transition", { exact: true })
    .selectOption("zoom");
  await page.getByLabel("Player photo size value", { exact: true }).fill("49");
  await expect
    .poll(async () => (await state()).playerIntro)
    .toEqual({
      enabled: true,
      asset: "meme-image",
      name: "Example player",
      transition: "zoom",
      size: 0.49,
    });
  await page
    .getByRole("button", { name: "Preview player intro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: preset tooltips and live pop-up, explicit apply, reduced motion, landing alignment, preview controls, edge depth, board palette, and player intro.",
  );
} finally {
  await browser.close();
  server.kill();
}
