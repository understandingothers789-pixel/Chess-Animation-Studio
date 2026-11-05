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
  const menu = page.getByRole("menu");
  const first = page.locator(".move-clip").first();
  await first.click({ button: "right" });
  await expect(menu).toBeVisible();
  await page.screenshot({ path: "test-results/timeline-menus/move-menu.png" });
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
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await page.screenshot({ path: "test-results/timeline-menus/copy-menu.png" });
  await page.getByRole("menuitem", { name: "Movement", exact: true }).click();
  await page.locator(".move-clip").nth(3).click({ button: "right" });
  assert.equal(await page.locator(".move-clip.checked").count(), 1);
  await page
    .getByRole("menuitem", { name: "Paste to this move", exact: true })
    .click();
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
  await page.getByRole("menuitem", { name: /^Apply source settings/ }).click();
  await page.getByRole("menuitem", { name: "Movement", exact: true }).click();
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
    }
  }
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
