/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const port = "5184",
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
  page.setDefaultTimeout(20000);
  await page.goto(origin);
  await page.waitForFunction(() => !!(window as any).__state);
  await fs.mkdir("docs/ui-refinement", { recursive: true });
  const shot = (name: string) =>
    page.screenshot({ path: `docs/ui-refinement/${name}.png` });
  const snapshot = () =>
    page.evaluate(() => JSON.stringify((window as any).__state.project));
  const value = () =>
    page.evaluate(
      () => (window as any).__state.project.moves[0].effect.duration as number,
    );
  const handle = page.getByRole("slider", {
    name: "Duration of e4",
    exact: true,
  });
  await page.locator(".move-clip .clip-select").first().click();
  await handle.scrollIntoViewIfNeeded();
  const original = await snapshot(),
    duration = await value();
  await handle.click();
  assert.equal(
    await snapshot(),
    original,
    "A resize click without drag must not edit the project",
  );
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  assert.ok(Math.abs((await value()) - duration - 0.05) < 0.00001);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await snapshot(), original);
  await handle.hover();
  await shot("resize-hover");
  assert.equal(
    await handle.getAttribute("title"),
    "Drag to change move duration.",
  );
  assert.equal(
    await page.locator("button [role=slider]").count(),
    0,
    "Resize handle must not be nested inside selection button",
  );
  const drag = async (dx: number, alt = false) => {
    await handle.scrollIntoViewIfNeeded();
    const b = await handle.boundingBox();
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
    if (alt) await page.keyboard.down("Alt");
    await page.mouse.down();
    await page.mouse.move(b!.x + b!.width / 2 + dx, b!.y + b!.height / 2, {
      steps: 12,
    });
    await expect(page.locator(".duration-feedback")).toBeVisible();
    await shot(alt ? "resize-unsnapped" : "resize-drag");
    await page.mouse.up();
    if (alt) await page.keyboard.up("Alt");
  };
  await drag(27);
  assert.ok(
    Math.abs((await value()) * 20 - Math.round((await value()) * 20)) < 0.00001,
  );
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await snapshot(), original, "A complete drag is one undo step");
  await drag(17, true);
  assert.ok(
    Math.abs((await value()) * 20 - Math.round((await value()) * 20)) > 0.01,
  );
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await snapshot(), original);
  await shot("selected-timeline");
  await page.getByRole('button',{name:'Fit timeline',exact:true}).click();assert.ok(await page.locator('.timeline-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'Fit timeline shows the entire sequence');await page.getByLabel('Timeline zoom',{exact:true}).fill('1');
  const format = page
      .locator(".composition-bar")
      .getByLabel("Output format", { exact: true }),
    workspace = page.getByLabel("Workspace preset", { exact: true });
  await format.selectOption("vertical");
  await page.getByLabel("Preview guides", { exact: true }).selectOption("safe");
  await page.getByLabel("Preview zoom", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  assert.equal(
    await page.getByLabel("Preview guides", { exact: true }).inputValue(),
    "safe",
  );
  await shot("vertical");
  await page.getByRole("button", { name: "Full preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play preview", exact: true }),
  ).toBeVisible();
  await shot("fullscreen");
  await page
    .getByRole("button", { name: "Exit full preview", exact: true })
    .click();
  for (const size of [
    [1100, 768],
    [1280, 720],
    [1440, 900],
    [1650, 900],
    [1920, 1080],
    [2560, 1440],
  ]) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    for (const scale of ["100", "110", "125", "150"]) {
      await page.getByLabel("UI scale", { exact: true }).selectOption(scale);
      for (const mode of ["Editing", "Preview", "Effects", "Timeline"]) {
        await workspace.selectOption(mode);
        await page.waitForFunction(() => {
          const h = document.querySelector(".preview-host") as HTMLElement,
            c = document.querySelector(".composition-viewport") as HTMLElement;
          if (!h || !c) return false;
          const expected = Math.min(
            h.clientWidth / 1080,
            h.clientHeight / 1920,
          );
          return (
            Math.abs(c.clientHeight - Math.floor(1920 * expected)) < 3 &&
            Math.abs(c.clientWidth - Math.floor(1080 * expected)) < 3
          );
        });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        if (
          scale === "100" &&
          [1100, 1440, 1920].includes(size[0]) &&
          mode === "Editing"
        )
          await shot(`${size[0]}x${size[1]}`);
        if (size[0] === 1440 && scale === "100")
          await shot("workspace-" + mode.toLowerCase());
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await workspace.selectOption("Editing");
  await format.selectOption("landscape");
  await shot("landscape");
  for (const width of [1100, 1920]) {
    await page.setViewportSize({ width, height: width === 1100 ? 768 : 1080 });
    await page.getByLabel("UI scale", { exact: true }).selectOption("150");
    await shot(`scale150-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.getByLabel("Duration value", { exact: true }).fill("0.2");
  await page.locator(".move-clip .clip-select").first().click();
  assert.equal(
    await page
      .locator(".move-clip .clip-select")
      .first()
      .getAttribute("aria-pressed"),
    "true",
  );
  await page.getByTitle("Undo", { exact: true }).click();
  await page.locator('.inspector [data-tab="camera"]').click();
  await shot("camera-inspector");
  assert.equal(
    await snapshot(),
    original,
    "Workspace, Fit, fullscreen and scaling preserve all project data",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: independent selection/resize, click safety, keyboard duration, snapping, Alt bypass, drag feedback and undo, fullscreen playback, guide-preserving Fit; all 96 resolution/scale/workspace combinations fit without camera edits.",
  );
} finally {
  await browser.close();
  server.kill();
}
