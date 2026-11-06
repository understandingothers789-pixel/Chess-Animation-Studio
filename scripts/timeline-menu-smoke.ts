/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const port = "5187",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
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
  await page.waitForSelector(".app-shell", { timeout: 60000 });
  await page.waitForFunction(() => !!(window as any).__state);
  await fs.mkdir("test-results/timeline-menus", { recursive: true });
  const menu = page.getByRole("menu").first();
  const first = page.locator(".move-clip").first();
  await first.click({ button: "right" });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-menus/move-menu.png" });
  // Real hover interactions: parents remain visible and hover does not steal focus.
  const copyParent = page.getByRole("menuitem", { name: "Copy", exact: true });
  const focusedBeforeHover = await page.evaluate(
    () => document.activeElement?.id,
  );
  await copyParent.hover();
  await expect(page.getByRole("menu")).toHaveCount(2);
  await expect(copyParent).toHaveAttribute("aria-expanded", "true");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    focusedBeforeHover,
  );
  await expect(menu).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-menus/hover-copy.png" });
  await page.getByRole("menuitem", { name: /^Paste to /, exact: true }).hover();
  await expect(page.getByRole("menu").last()).toHaveAttribute(
    "aria-label",
    /^Paste to /,
  );
  await copyParent.hover();
  await expect(page.getByRole("menu").last()).toHaveAttribute(
    "aria-label",
    "Copy",
  );
  // Both fast and slow diagonals cross other root rows en route to the flyout.
  for (const stepDelay of [0, 35]) {
    await copyParent.hover();
    const parent = await copyParent.boundingBox(),
      child = await page.getByRole("menu").last().boundingBox();
    const dest = {
      x: child!.x + child!.width / 2,
      y: child!.y + child!.height - 25,
    };
    const start = {
      x: parent!.x + parent!.width * 0.6,
      y: parent!.y + parent!.height / 2,
    };
    await page.mouse.move(start.x, start.y);
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(
        start.x + ((dest.x - start.x) * i) / 6,
        start.y + ((dest.y - start.y) * i) / 6,
      );
      if (stepDelay) await page.waitForTimeout(stepDelay);
    }
    await expect(copyParent).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menu")).toHaveCount(2);
  }
  await page.mouse.move(12, 12);
  await expect(page.getByRole("menu")).toHaveCount(1);

  await page
    .getByRole("menuitemcheckbox", { name: "Lock timing", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.moves[0].effect.locked,
  );
  const lockedDuration = await page.evaluate(
    () => (window as any).__state.project.moves[0].effect.duration,
  );
  await expect(first.locator(".clip-resize")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await first
    .locator(".clip-resize")
    .dispatchEvent("keydown", { key: "ArrowRight" });
  const grip = await first.locator(".clip-resize").boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip!.x + 60, grip!.y + 10);
  await page.mouse.up();
  assert.equal(
    await page.evaluate(
      () => (window as any).__state.project.moves[0].effect.duration,
    ),
    lockedDuration,
  );
  await first.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Speed / Duration", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "25% faster", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/timeline-menus/speed-menu.png" });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await first.click({ button: "right" });
  await page
    .getByRole("menuitemcheckbox", { name: "Lock timing", exact: true })
    .click();
  await page.waitForFunction(
    () => !(window as any).__state.project.moves[0].effect.locked,
  );
  await first.locator(".clip-resize").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (d: number) => (window as any).__state.project.moves[0].effect.duration > d,
    lockedDuration,
  );
  await page.locator(".camera-track button").first().click({ button: "right" });
  await page.screenshot({
    path: "test-results/timeline-menus/camera-menu.png",
  });
  await page.getByRole("menuitem", { name: /^Edit camera/ }).click();
  await expect(page.locator('.inspector [data-tab="camera"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByLabel("Camera framing", { exact: true }),
  ).toBeFocused();
  await page.locator(".effect-track button").first().click({ button: "right" });
  await page.screenshot({
    path: "test-results/timeline-menus/effects-menu.png",
  });
  await page
    .getByRole("menuitemcheckbox", { name: "Beat spotlight", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.moves[0].effect.jam.enabled,
  );
  await page
    .getByLabel("Workspace preset", { exact: true })
    .selectOption("Timeline");
  await page.locator('.track-labels [data-track="music"]').click();
  await page.screenshot({ path: "test-results/timeline-menus/music-menu.png" });
  await page
    .getByRole("menuitem", {
      name: "Knight horse sound settings…",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-category="music"]')).toBeVisible();
  await expect(
    page.getByText("Knight horse sound", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Horse sound volume", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByLabel("Horse sound volume value", { exact: true }),
  ).toBeFocused();
  const playhead = await page.evaluate(() => (window as any).__state.time);
  await page.locator('.track-labels [data-track="music"]').click();
  await page
    .getByRole("menuitem", { name: "Add beat at playhead", exact: true })
    .click();
  await page.waitForFunction(
    (t: number) =>
      (window as any).__state.project.beats.some(
        (b: any) => Math.abs(b.time - t) < 0.001,
      ),
    playhead,
  );
  await page.locator(".annotation-drawer > summary").click();
  await page.getByRole("button", { name: "+ text", exact: true }).click();
  await page
    .locator(".annotation-track button")
    .first()
    .click({ button: "right" });
  await page.screenshot({
    path: "test-results/timeline-menus/annotation-menu.png",
  });
  await page
    .getByRole("menuitem", { name: "Duplicate annotation", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.annotations.length === 2,
  );
  await page
    .locator(".annotation-track button")
    .last()
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Delete annotation", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.annotations.length === 1,
  );
  await page.locator("[data-intro]").click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Edit intro & title…", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return to selected move", exact: true }),
  ).toBeVisible();
  await page.locator('.track-labels [data-track="camera"]').click();
  await page.getByRole("menuitem", { name: "Hide track", exact: true }).click();
  await expect(page.locator(".camera-track")).toBeHidden();
  await page.reload();
  await page.waitForSelector(".app-shell", { timeout: 60000 });
  await expect(page.locator(".camera-track")).toBeHidden();
  await page.locator('.track-labels [data-track="timeline"]').click();
  await page
    .getByRole("menuitem", { name: "Show all tracks", exact: true })
    .click();
  await expect(page.locator(".camera-track")).toBeVisible();
  await first.locator(".clip-select").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.track-labels [data-track="music"]').click();
  const rect = await menu.boundingBox();
  assert.ok(
    rect &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= 1024 &&
      rect.y + rect.height <= 768,
  );
  await page.screenshot({
    path: "test-results/timeline-menus/small-window.png",
  });
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Workspace preset", { exact: true })
    .selectOption("Editing");
  for (const panel of ["music", "atmosphere"]) {
    await page
      .locator(".library-tabs")
      .getByRole("button", { name: panel, exact: true })
      .click();
    const missing = await page
      .locator("input:visible,select:visible,textarea:visible")
      .evaluateAll((els) =>
        els
          .filter(
            (e) =>
              !e.getAttribute("title") ||
              !e.getAttribute("aria-description") ||
              e.getAttribute("title")!.startsWith("Adjust "),
          )
          .map((e) => e.getAttribute("aria-label")),
      );
    assert.deepEqual(missing, [], `Missing help in ${panel}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".move-clip .clip-select").first().click();
  await page
    .locator(".move-clip .clip-select")
    .nth(2)
    .click({ modifiers: ["Control"] });
  await page.locator(".move-clip").nth(2).click({ button: "right" });
  assert.equal(await page.locator(".move-clip.checked").count(), 2);
  await page.screenshot({
    path: "test-results/timeline-menus/multi-selection.png",
  });
  const beforeExact = await page.evaluate(() => ({
    project: JSON.stringify((window as any).__state.project),
    time: (window as any).__state.time,
  }));
  await page
    .getByRole("menuitem", { name: "Speed / Duration", exact: true })
    .hover();
  await page
    .getByRole("menuitem", { name: "Set exact duration…", exact: true })
    .click();
  await expect(
    page.getByLabel("Duration value", { exact: true }),
  ).toBeFocused();
  assert.equal(await page.locator(".move-clip.checked").count(), 2);
  assert.deepEqual(
    await page.evaluate(() => ({
      project: JSON.stringify((window as any).__state.project),
      time: (window as any).__state.time,
    })),
    beforeExact,
  );
  await page.locator(".move-clip").nth(2).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await page.screenshot({ path: "test-results/timeline-menus/copy-menu.png" });
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("menuitem", { name: "Copy", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("menuitem", { name: "Movement", exact: true }),
  ).toBeFocused();
  await page.getByRole("menuitem", { name: "Movement", exact: true }).click();
  const beforeContextTime = await page.evaluate(
    () => (window as any).__state.time,
  );
  await page.locator(".move-clip").nth(3).click({ button: "right" });
  assert.equal(
    await page.evaluate(() => (window as any).__state.time),
    beforeContextTime,
  );
  assert.equal(await page.locator(".move-clip.checked").count(), 1);
  await page.getByRole("menuitem", { name: /^Paste to /, exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Camera", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "test-results/timeline-menus/paste-menu.png" });
  const beforePaste = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  await page.getByRole("menuitem", { name: "Movement", exact: true }).click();
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (before: string) =>
      JSON.stringify((window as any).__state.project) === before,
    beforePaste,
  );
  await page.locator(".move-clip").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Apply .*settings to/ }).hover();
  await page.getByRole("menuitem", { name: "Movement", exact: true }).hover();
  await expect(page.getByRole("menu")).toHaveCount(3);
  await expect(page.getByRole("menu").nth(0)).toBeVisible();
  await expect(page.getByRole("menu").nth(1)).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-menus/bulk-menu.png" });
  const beforeBulk = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  await page.getByRole("menuitem", { name: /^Knight moves/ }).click();
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (before: string) =>
      JSON.stringify((window as any).__state.project) === before,
    beforeBulk,
  );

  await first.click({ button: "right" });
  await page
    .getByRole("menuitemcheckbox", { name: "Lock timing", exact: true })
    .click();
  const beforePanel = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  await first.click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Bulk edit from/ }).click();
  const panel = page.getByRole("dialog", { name: "Apply move settings" });
  await expect(panel).toBeVisible();
  await page.getByLabel("Bulk settings category").selectOption("timing");
  await page.getByLabel("Bulk target group").selectOption("All moves");
  await expect(panel).toContainText("1 timing-locked moves");
  assert.equal(
    await page.evaluate(() => JSON.stringify((window as any).__state.project)),
    beforePanel,
  );
  await page.screenshot({ path: "test-results/timeline-menus/bulk-panel.png" });
  await page.getByRole("button", { name: /^Apply timing to/ }).click();
  await expect(panel).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (p: string) => JSON.stringify((window as any).__state.project) === p,
    beforePanel,
  );

  await page.keyboard.press("Escape");
  const countBeats = await page.evaluate(
    () => (window as any).__state.project.beats.length,
  );
  await page.locator(".ruler").dblclick({ position: { x: 90, y: 15 } });
  assert.equal(
    await page.evaluate(() => (window as any).__state.project.beats.length),
    countBeats,
  );
  await page.locator(".music-track").dblclick({ position: { x: 160, y: 20 } });
  await page.waitForFunction(
    (n: number) => (window as any).__state.project.beats.length === n + 1,
    countBeats,
  );
  const beatControl = page.locator(".beat").last();
  const beforeNudge = Number(await beatControl.getAttribute("aria-valuenow"));
  const beforeNudgeTime = await page.evaluate(
    () => (window as any).__state.time,
  );
  await beatControl.focus();
  await page.keyboard.press("ArrowRight");
  await expect(beatControl).toHaveAttribute(
    "aria-valuenow",
    String(beforeNudge + 0.01),
  );
  assert.equal(
    await page.evaluate(() => (window as any).__state.time),
    beforeNudgeTime,
  );
  await page.locator(".beat").last().click({ button: "right" });
  await page.screenshot({ path: "test-results/timeline-menus/beat-menu.png" });
  await page.keyboard.press("Escape");
  await page.getByLabel("Seek composition", { exact: true }).fill("0");
  const board = page.locator(".preview-host canvas");
  const box = await board.boundingBox();
  await board.click({
    button: "right",
    position: { x: box!.width / 2, y: box!.height / 2 },
  });
  await expect(page.getByRole("menu", { name: /Square/ })).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-menus/board-menu.png" });
  const square = (await menu.getAttribute("aria-label"))!.replace(
    "Square ",
    "",
  );
  const beforeBoard = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  await page
    .getByRole("menuitem", {
      name: "Highlight square / add circle",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    (sq: string) =>
      (window as any).__state.project.annotations.some(
        (a: any) => a.kind === "circle" && a.from === sq,
      ),
    square,
  );
  const afterBoard = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (p: string) => JSON.stringify((window as any).__state.project) === p,
    beforeBoard,
  );
  await page.keyboard.press("Control+Shift+Z");
  await page.waitForFunction(
    (p: string) => JSON.stringify((window as any).__state.project) === p,
    afterBoard,
  );
  await page.keyboard.press("Control+z");
  await board.click({
    button: "right",
    position: { x: box!.width / 2, y: box!.height / 2 },
  });
  await page.getByRole("menuitem", { name: /^Draw arrow from/ }).click();
  await board.click({ position: { x: box!.width * 0.6, y: box!.height / 2 } });
  await page.waitForFunction(
    (sq: string) =>
      (window as any).__state.project.annotations.some(
        (a: any) => a.kind === "arrow" && a.from === sq && a.to !== sq,
      ),
    square,
  );
  await page.keyboard.press("Control+z");
  await page.waitForFunction(
    (p: string) => JSON.stringify((window as any).__state.project) === p,
    beforeBoard,
  );

  // Preview viewing commands keep playback live and never touch project cameras.
  await page.getByLabel("Seek composition", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => (window as any).__state.playing);
  const previewBefore = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  const background = await page.locator(".preview-host").boundingBox();
  await page.mouse.click(background!.x + 5, background!.y + 5, {
    button: "right",
  });
  await expect(menu).toHaveAttribute("aria-label", "Preview view");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/timeline-menus/blank-preview.png",
  });
  await page
    .getByRole("menuitem", { name: "Fit preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => JSON.stringify((window as any).__state.project)),
    previewBefore,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as any).__copiedFen = text;
        },
      },
    }),
  );
  await page.mouse.click(background!.x + 5, background!.y + 5, {
    button: "right",
  });
  await page
    .getByRole("menuitem", { name: "Copy position FEN", exact: true })
    .click();
  await expect(page.locator(".status-bar")).toContainText("FEN copied");
  assert.match(
    await page.evaluate(() => (window as any).__copiedFen),
    / [wb] /,
  );
  await page.mouse.click(background!.x + 5, background!.y + 5, {
    button: "right",
  });
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("menuitem", { name: "Save current frame as PNG", exact: true })
    .click();
  const png = await downloaded;
  assert.ok(png.suggestedFilename().endsWith(".png"));
  assert.equal(await png.failure(), null);
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  // A visible text annotation has its own editing menu and exact field target.
  const textAnnotation = await page.evaluate(() =>
    (window as any).__state.project.annotations.find(
      (a: any) => a.kind === "text",
    ),
  );
  if (textAnnotation) {
    await page
      .getByLabel("Seek composition", { exact: true })
      .fill(String(textAnnotation.start + 0.6));
    await page.waitForTimeout(150);
    const rect = await board.boundingBox();
    await page.mouse.click(
      rect!.x + textAnnotation.x * rect!.width,
      rect!.y + textAnnotation.y * rect!.height,
      { button: "right" },
    );
    await expect(menu).toHaveAttribute("aria-label", "Annotation");
    await page
      .getByRole("menuitem", { name: "Edit text…", exact: true })
      .click();
    await expect(
      page.getByLabel("Annotation text", { exact: true }),
    ).toBeFocused();
  }

  // Exercise every edge and corner with actual hover after context invocation.
  for (const [name, cx, cy] of [
    ["top-left", 2, 2],
    ["top-right", 1438, 2],
    ["bottom-left", 2, 898],
    ["bottom-right", 1438, 898],
    ["left", 2, 450],
    ["right", 1438, 450],
  ] as const) {
    await first.dispatchEvent("contextmenu", {
      button: 2,
      clientX: cx,
      clientY: cy,
    });
    await page.getByRole("menuitem", { name: "Copy", exact: true }).hover();
    await expect(page.getByRole("menu")).toHaveCount(2);
    for (const r of await page.getByRole("menu").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    ))
      assert.ok(
        r.x >= 0 && r.y >= 0 && r.right <= 1440 && r.bottom <= 900,
        JSON.stringify(r),
      );
    await page.screenshot({
      path: `test-results/timeline-menus/flyout-${name}.png`,
    });
    await page.keyboard.press("Escape");
  }
  await page.keyboard.press("Escape");
  for (const [w, h] of [
    [1100, 768],
    [1280, 720],
    [1440, 900],
    [1650, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    for (const scale of ["100", "110", "125", "150"]) {
      await page.getByLabel("UI scale", { exact: true }).selectOption(scale);
      await page.locator('.track-labels [data-track="move"]').click();
      const r = await menu.boundingBox();
      assert.ok(
        r &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.width <= w + 1 &&
          r.y + r.height <= h + 1,
      );
      if (scale === "150")
        await page.screenshot({
          path: `test-results/timeline-menus/view-${w}-${scale}.png`,
        });
      await page.keyboard.press("Escape");
      await first.dispatchEvent("contextmenu", {
        button: 2,
        clientX: w - 4,
        clientY: h - 4,
      });
      await page.getByRole("menuitem", { name: "Copy", exact: true }).hover();
      await expect(page.getByRole("menu")).toHaveCount(2);
      for (const box of await page.getByRole("menu").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      ))
        assert.ok(
          box.x >= 0 && box.y >= 0 && box.right <= w + 1 && box.bottom <= h + 1,
        );
      if (scale === "150")
        await page.screenshot({
          path: `test-results/timeline-menus/flyout-${w}-150.png`,
        });
      await page.keyboard.press("Escape");
    }
  }
  await page.setViewportSize({ width: 700, height: 768 });
  await first.dispatchEvent("contextmenu", {
    button: 2,
    clientX: 680,
    clientY: 740,
  });
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(
    page.getByRole("menuitem", { name: "← Back", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/timeline-menus/narrow-fallback.png",
  });
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("menuitem", { name: "Copy", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Inspector", exact: true }).click();
  await page.locator(".camera-track").scrollIntoViewIfNeeded();
  const edge = await page.locator(".camera-track button").evaluateAll((els) => {
    const candidates = els
      .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
      .filter(
        ({ r }) =>
          r.left < innerWidth - 20 &&
          r.right > innerWidth - 250 &&
          r.top > 0 &&
          r.bottom < innerHeight,
      );
    const { r, i } = candidates[candidates.length - 1];
    return {
      index: i,
      x: Math.min(innerWidth - 22, r.right - 5),
      y: r.top + r.height / 2,
    };
  });
  const invoker = page.locator(".camera-track button").nth(edge.index);
  await invoker.evaluate((e) =>
    (e as HTMLElement).focus({ preventScroll: true }),
  );
  await page.mouse.click(edge.x, edge.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  const corner = await menu.boundingBox();
  await expect(page.getByRole("menu")).toHaveCount(2);
  await expect(page.getByRole("menu").last()).toHaveAttribute(
    "data-direction",
    "left",
  );
  assert.ok(
    corner &&
      corner.x + corner.width > 1420 &&
      corner.x + corner.width <= 1440 &&
      corner.y + corner.height <= 900,
  );
  await page.screenshot({
    path: "test-results/timeline-menus/corner-submenu.png",
  });
  await page.keyboard.press("Escape");
  await expect(invoker).toBeFocused();
  await page.getByRole("button", { name: "Full preview", exact: true }).click();
  await page.waitForFunction(
    () =>
      !!document.fullscreenElement &&
      (document.querySelector(".preview-host canvas")?.getBoundingClientRect()
        .width ?? 0) >
        innerWidth * 0.8,
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await board.click({ button: "right" });
  await expect(menu).toBeVisible();
  assert.ok(
    await page.evaluate(() =>
      document.fullscreenElement?.contains(
        document.querySelector('[role="menu"]'),
      ),
    ),
  );
  await page
    .getByRole("menuitem", { name: "Preview view", exact: true })
    .hover();
  await expect(page.getByRole("menu")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/timeline-menus/fullscreen-board-menu.png",
  });
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  const picks = await page.evaluate(async () => {
    const scenePath = "/src/render/Scene.ts",
      threePath = "/node_modules/three/build/three.module.js",
      modelPath = "/src/core/project.ts";
    const { Scene } = await import(scenePath),
      T = await import(threePath),
      model = await import(modelPath);
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;left:20px;top:20px;width:500px;height:350px;transform:translate(25px,15px) scale(1.25);transform-origin:top left";
    document.body.append(canvas);
    const scene = new Scene(canvas);
    await scene.ready;
    let checked = 0;
    try {
      for (const orientation of ["white", "black"])
        for (const format of ["landscape", "vertical"])
          for (const tilt of [0, 18]) {
            const p = structuredClone((window as any).__state.project);
            p.style.orientation = orientation;
            p.format = format;
            p.boardFX.intro = false;
            for (const m of p.moves)
              m.effect.cameras[format] = {
                ...model.camera(),
                mode: "manual",
                x: 0.25,
                y: -0.2,
                zoom: 1,
                tilt,
                rotation: 15,
              };
            const w = format === "vertical" ? 360 : 640,
              h = format === "vertical" ? 640 : 360;
            scene.render(p, 3, w, h, format);
            scene.cameras.camera.updateMatrixWorld(true);
            const c = scene.current,
              r = canvas.getBoundingClientRect();
            for (let i = 0; i < 64; i++) {
              const mesh = scene.board.squares[i],
                v = mesh
                  .getWorldPosition(new T.Vector3())
                  .project(scene.cameras.camera);
              const x = r.left + ((v.x + 1) / 2) * r.width,
                py = c.viewY + ((v.y + 1) / 2) * c.viewH,
                y = r.top + (1 - py / h) * r.height;
              if (x < r.left || x > r.right || y < r.top || y > r.bottom)
                continue;
              const expected =
                  String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1),
                actual = scene.pick(x, y);
              if (actual !== expected)
                throw Error(
                  `Picking mismatch ${orientation} ${format} ${tilt}: ${expected} vs ${actual} details=${JSON.stringify({ x, y, py, h, cH: c.h, viewY: c.viewY, viewH: c.viewH, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, v: { x: v.x, y: v.y, z: v.z } })}`,
                );
              checked++;
            }
          }
    } finally {
      scene.dispose();
      canvas.remove();
    }
    return checked;
  });
  assert.ok(
    picks > 100,
    `Expected broad transformed square coverage, got ${picks}`,
  );
  console.log(`Verified ${picks} transformed board-square picks.`);
  assert.deepEqual(errors, []);
  console.log(
    "Timeline menus: clip targeting, edits, locks, deep links, saved visibility, keyboard and viewport checks passed.",
  );
} finally {
  await browser.close();
  server.kill();
}
