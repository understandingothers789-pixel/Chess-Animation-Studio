import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const port = "5202";
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
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
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    const w = window as any;
    w.__name = (value: unknown) => value;
    const preferences = {
      ffmpeg: "",
      stockfish: "",
      encoder: "auto",
      tokenPresent: false,
    };
    w.studio = {
      settings: async () => preferences,
      recent: async () => [],
      recover: async () => null,
      onAnalysis: () => () => {},
      onExport: () => () => {},
      present: (state: any) => {
        w.__workflow = state;
      },
      autosave: async () => {},
      assetStatus: async () => ({}),
      assetData: async () => null,
      tool: async (kind: string) => {
        if (kind !== "ffmpeg") throw Error("Unexpected tool request");
        return { ...preferences, ffmpeg: "ffmpeg" };
      },
      export: async () => false,
    };
  });
  await page.goto(origin);
  await page.waitForFunction(() => !!(window as any).__workflow);
  const button = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect
    .poll(
      async () =>
        (await page.locator(".preview-host canvas").boundingBox())?.height ?? 0,
    )
    .toBeGreaterThan(170);
  await page.setViewportSize({ width: 1440, height: 900 });
  const workspace = page.getByLabel("Workspace preset", { exact: true });
  const width = page.getByRole("separator", { name: "Left settings width" });
  const originalWidth = +(await width.getAttribute("aria-valuenow"))!;
  await width.press("ArrowRight");
  await workspace.selectOption("Preview");
  await button("Return to editing").click();
  await expect(width).toHaveAttribute(
    "aria-valuenow",
    String(originalWidth + 10),
  );

  await button("Settings").click();
  await button("Inspector").click();
  await page.keyboard.press("Control+k");
  const search = page.getByLabel("Search settings", { exact: true });
  await expect(search).toBeFocused();
  await search.fill("Rotation");
  await search.press("ArrowDown");
  const rotation = page.locator(".search-results button").first();
  await expect(rotation).toBeFocused();
  await rotation.press("Enter");
  await expect(page.getByLabel("Rotation", { exact: true })).toBeFocused();

  const playhead = page.getByLabel("Seek composition", { exact: true });
  await playhead.fill("0.83");
  const before = await playhead.inputValue();
  await button("presets").click();
  await page
    .locator(".animation-card")
    .filter({ hasText: "Dramatic landing" })
    .click();
  const components = page.getByRole("group", { name: "Preset components" });
  await expect(
    components.getByRole("checkbox", { name: "After effect" }),
  ).toBeChecked();
  await button("View original at this frame").click();
  await expect(button("View preset at this frame")).toBeVisible();
  await button("Cancel preview").click();
  await page.locator(".animation-card").filter({ hasText: "Soft hop" }).click();
  await button("Cancel preview").click();
  await expect(playhead).toHaveValue(before);
  await page.locator(".animation-card").filter({ hasText: "Soft hop" }).click();
  await button("Close animation library").click();
  await expect(playhead).toHaveValue(before);
  await button("presets").click();
  await page.locator(".animation-card").filter({ hasText: "Soft hop" }).click();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await expect(playhead).toHaveValue(before);
  await search.fill("Output format");
  await search.press("Enter");
  await expect(page.getByLabel("Output format", { exact: true })).toBeFocused();

  const clips = (index: number) =>
    page.locator(`.move-clip[data-move-index="${index}"] .clip-select`);
  await clips(0).click();
  await clips(1).click({ modifiers: ["Control"] });
  const state = () => page.evaluate(() => (window as any).__workflow.project);
  const original = (await state()).moves.map((move: any) => move.effect.preset);
  await button("presets").click();
  const scope = page.getByLabel("Preset target scope", { exact: true });
  await scope.selectOption("group");
  await page.locator(".animation-card").filter({ hasText: "Soft hop" }).click();
  await expect(page.locator(".preset-selection")).toContainText("2 moves");
  await button("Play original").click();
  await expect(page.locator(".preset-selection")).toContainText("Original");
  assert.deepEqual(
    (await state()).moves.map((move: any) => move.effect.preset),
    original,
  );
  await button("Play preset").click();
  await expect(page.locator(".preset-selection")).toContainText("Preview");
  await button("Apply & fine-tune").click();
  await expect(page.getByLabel("Move preset", { exact: true })).toBeFocused();
  assert.deepEqual(
    (await state()).moves.slice(0, 3).map((move: any) => move.effect.preset),
    ["hop", "hop", original[2]],
  );
  await page.getByTitle("Undo", { exact: true }).click();
  assert.deepEqual(
    (await state()).moves.map((move: any) => move.effect.preset),
    original,
  );
  await clips(0).click();

  const frames = page.locator(".move-frames");
  await frames.locator(":scope > summary").click();
  await frames.getByText("Effect timing", { exact: true }).click();
  await button("Seek to main movement midpoint").click();
  await button("Adjust main movement timing").press("Enter");
  const previousDuration = (await state()).moves[0].effect.duration;
  await page.getByLabel("Movement length value", { exact: true }).fill("2.8");
  await expect(page.locator(".timing-proposal [role=status]")).toContainText(
    "Later moves shift",
  );
  assert.equal((await state()).moves[0].effect.duration, previousDuration);
  await button("Apply timing").click();
  await expect
    .poll(async () => (await state()).moves[0].effect.duration)
    .toBe(2.8);
  await page.getByTitle("Undo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).moves[0].effect.duration)
    .toBe(previousDuration);

  await button("Tune after effect").click();
  const after = page.getByLabel("After-effect type", { exact: true });
  await expect(after).toBeFocused();
  await after.selectOption("size-pulse");
  await expect(button("Seek to after effect midpoint")).toBeEnabled();
  await button("Seek to after effect midpoint").click();
  await expect(button("View after-effect peak frame")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const handle = button("Adjust after effect timing");
  await handle.scrollIntoViewIfNeeded();
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 22,
    handleBox.y + handleBox.height / 2,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect(button("Apply timing")).toBeEnabled();
  const priorAfter = (await state()).moves[0].effect.after.duration;
  await button("Apply timing").click();
  await expect
    .poll(async () => (await state()).moves[0].effect.after.duration)
    .toBeGreaterThan(priorAfter);
  await page.getByTitle("Undo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).moves[0].effect.after.duration)
    .toBe(priorAfter);
  await frames.locator(":scope > summary").click();
  await page.getByTitle("Undo", { exact: true }).click();

  await button("effects").first().click();
  await button("Inspector").click();
  await button("Edit selected move’s capture impact →").click();
  await expect(button("Inspector")).toHaveAttribute("aria-pressed", "true");

  await page.setViewportSize({ width: 1100, height: 700 });
  await page.getByLabel("UI scale", { exact: true }).selectOption("150");
  await page
    .getByLabel("Output format", { exact: true })
    .selectOption("shorts");
  const preview = page.locator(".preview-host");
  await expect
    .poll(async () => (await preview.boundingBox())!.height)
    .toBeGreaterThan(115);
  const movesTrack = page.locator('.track-labels [data-track="move"]');
  await movesTrack.scrollIntoViewIfNeeded();
  await expect(movesTrack).toBeInViewport();
  await preview.scrollIntoViewIfNeeded();
  const tools = page.getByRole("button", { name: /^Tools/ });
  await expect(tools).toBeVisible();
  await expect(page.getByLabel("Preview zoom", { exact: true })).toBeHidden();
  await tools.click();
  await expect(page.getByLabel("Preview zoom", { exact: true })).toBeVisible();
  await page.getByLabel("Preview zoom", { exact: true }).press("Escape");
  await expect(tools).toBeFocused();

  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.setViewportSize({ width: 1440, height: 900 });
  await button("Make a Short from this move").click();
  await expect
    .poll(async () =>
      (await state()).storyboard.shots.map((shot: any) => shot.kind),
    )
    .toEqual(["position-hold", "move-range", "position-hold"]);
  await expect.poll(async () => (await state()).format).toBe("vertical");
  await page.getByTitle("Undo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).storyboard.shots.length)
    .toBe(0);
  await button("Add 1 selected move").click();
  await button("+ Opening shot").click();
  await expect
    .poll(async () =>
      (await state()).storyboard.shots.map((shot: any) => shot.kind),
    )
    .toEqual(["opening", "move-range"]);

  await workspace.selectOption("Timeline");
  await expect(button("Storyboard mode")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const storyHead = page.getByLabel("Seek storyboard", { exact: true });
  const end = (await storyHead.getAttribute("max"))!;
  await storyHead.fill(end);
  await button("Play storyboard").click();
  await expect
    .poll(async () => Number(await storyHead.inputValue()))
    .toBeLessThan(Number(end));
  await page.getByLabel("Pause storyboard", { exact: true }).click();

  await button("Export MP4").click();
  const exportDialog = page.getByRole("dialog", { name: "Export composition" });
  await expect(exportDialog).toBeVisible();
  await expect(exportDialog.getByLabel("Export range")).toHaveValue(
    "storyboard",
  );
  const render = exportDialog.getByRole("button", {
    name: "Choose output & render",
    exact: true,
  });
  await expect(render).toBeDisabled();
  await exportDialog.getByLabel("Export resolution").selectOption("0.5");
  await button("Preview selected export").click();
  const output = page.getByRole("img", { name: "Selected export frame" });
  await expect(output).toBeVisible({ timeout: 30000 });
  await expect
    .poll(() =>
      output.evaluate((el: HTMLImageElement) => [
        el.naturalWidth,
        el.naturalHeight,
      ]),
    )
    .toEqual([540, 960]);
  await button("Caption safe area").click();
  await expect(page.getByLabel("Export caption safe area")).toBeVisible();
  await button("Ending").click();
  const outputRange = page.getByLabel("Scrub selected export");
  await expect(outputRange).toHaveValue(
    (await outputRange.getAttribute("max"))!,
  );
  await button("Preview selected export").click();

  await exportDialog
    .getByRole("button", { name: "Choose FFmpeg…", exact: true })
    .click();
  await expect(render).toBeEnabled();
  await render.click();
  await expect(exportDialog.getByRole("status")).toHaveText(
    "Save dialog cancelled.",
  );
  await page.keyboard.press("Escape");
  await expect(exportDialog).toHaveCount(0);
  await expect(button("Export MP4")).toBeFocused();

  await page.getByTitle("New composition", { exact: true }).click();
  await button("Import PGN or FEN").click();
  await expect(page.getByLabel("Game text", { exact: true })).toBeFocused();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: workspace restore, keyboard settings search, scoped preset preview/apply/Undo, editable effect timing, narrow tools, opening shots, exact export preview, and empty-project workflow.",
  );
} finally {
  await browser?.close();
  server.kill();
}
