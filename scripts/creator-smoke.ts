/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const port = "5183",
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
  await fs.mkdir("docs/ui-refinement/creator", { recursive: true });
  const shot = async (name: string) => {
    await page.screenshot({ path: `docs/ui-refinement/creator/${name}.png` });
  };
  const state = () =>
    page.evaluate(() => JSON.stringify((window as any).__state.project));
  const initial = await state();
  await shot("compact-navigation");
  const preset = page.getByLabel("Workspace preset", { exact: true });
  for (const name of ["Editing", "Preview", "Effects", "Timeline"]) {
    await preset.selectOption(name);
    await shot("workspace-" + name.toLowerCase());
  }
  await preset.selectOption("Editing");
  const splitter = page.getByRole("separator", { name: "Left settings width" });
  const before = await splitter.getAttribute("aria-valuenow");
  await splitter.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(+(await splitter.getAttribute("aria-valuenow"))!, +before! + 10);
  const box = await splitter.boundingBox();
  await page.mouse.move(box!.x + 3, box!.y + 80);
  await page.mouse.down();
  await page.mouse.move(box!.x + 53, box!.y + 80, { steps: 10 });
  await page.mouse.up();
  assert.equal(+(await splitter.getAttribute("aria-valuenow"))!, +before! + 60);
  assert.equal(
    await state(),
    initial,
    "Workspace changes do not edit projects",
  );
  for (const label of ["Settings", "Inspector"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await shot("collapsed-" + label.toLowerCase());
    await page.getByRole("button", { name: label, exact: true }).click();
  }
  await page.getByLabel("Preview zoom", { exact: true }).fill("200");
  await page
    .getByLabel("Preview guides", { exact: true })
    .selectOption("thirds");
  await page.getByRole("button", { name: "Pan", exact: true }).click();
  const preview = page.locator(".preview-host");
  const b = await preview.boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2 + 35, b!.y + b!.height / 2 + 15);
  await page.mouse.up();
  assert.equal(await state(), initial, "Viewport tools do not edit projects");
  await page.getByRole("button", { name: "Fit", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save PNG", exact: true }).click();
  const download = await downloadEvent;
  assert.ok(download.suggestedFilename().endsWith(".png"));
  await download.saveAs("test-results/creator-frame.png");
  await page.getByRole("button", { name: "presets", exact: true }).click();
  await page.locator(".animation-card").filter({ hasText: "Soft hop" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.equal(await state(), initial, "Preset browsing is nondestructive");
  await shot("preset-browser");
  await page.getByLabel("Preset target scope").selectOption("all");
  await page.getByRole("button", { name: /Apply to \d+ moves/ }).click();
  assert.ok(
    await page.evaluate(() =>
      (window as any).__state.project.moves.every(
        (m: any) => m.effect.preset === "hop",
      ),
    ),
  );
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await state(), initial);
  console.log("passed presets");
  const clip = page
    .getByRole("slider", { name: "Duration of e4", exact: true })
    .first();
  await clip.scrollIntoViewIfNeeded();
  const cb = await clip.boundingBox();
  await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + 10);
  await page.mouse.down();
  await page.mouse.move(cb!.x + 60, cb!.y + 10, { steps: 20 });
  await page.mouse.up();
  assert.notEqual(await state(), initial);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await state(), initial, "One undo reverses the full clip drag");
  console.log("passed clip drag");
  await page.locator('.inspector [data-tab="keys"]').click();
  await page
    .getByRole("button", { name: "+ Add keyframe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Add keyframe", exact: true })
    .click();
  await shot("curve-editor");
  const curve = page.locator(".curve-editor svg");
  const cr = await curve.boundingBox();
  const beforeCurve = await state();
  const point = page.getByRole("button", {
    name: "Curve point 2",
    exact: true,
  });
  const pb = await point.boundingBox();
  await page.mouse.move(pb!.x + pb!.width / 2, pb!.y + pb!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cr!.x + cr!.width * 0.65, cr!.y + cr!.height * 0.3, {
    steps: 12,
  });
  await page.mouse.up();
  assert.notEqual(await state(), beforeCurve);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(await state(), beforeCurve);
  await page.locator(".annotation-drawer summary").click();
  await page.getByRole("button", { name: "+ caption", exact: true }).click();
  await page.getByLabel("Annotation text").fill("Find the winning move!");
  await page.getByLabel("Annotation start", { exact: true }).fill("0");
  await page.getByLabel("Annotation end", { exact: true }).fill("10");
  await page.getByLabel("Seek composition", { exact: true }).fill("1");
  await shot("annotation-editor");
  assert.equal(
    await page.evaluate(
      () => (window as any).__state.project.annotations.length,
    ),
    1,
  );
  await page
    .locator(".composition-bar")
    .getByLabel("Output format", { exact: true })
    .selectOption("shorts");
  await page
    .getByLabel("Preview guides", { exact: true })
    .selectOption("shorts");
  await shot("shorts-preview");
  await page.getByRole("button", { name: "Export MP4", exact: true }).click();
  await page.getByLabel("Export frame rate").selectOption("24");
  await page.getByLabel("Export range").selectOption("move");
  await shot("export-dialog");
  await page
    .getByRole("button", { name: "Choose output & render", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => (window as any).__export.options.fps),
    24,
  );
  assert.ok(
    await page.evaluate(
      () =>
        (window as any).__export.options.end >
        (window as any).__export.options.start,
    ),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator(".composition-bar")
    .getByLabel("Output format", { exact: true })
    .selectOption("landscape");
  await page.getByLabel("Preview guides", { exact: true }).selectOption("none");
  await shot("landscape-preview");
  await page.setViewportSize({ width: 900, height: 720 });
  await shot("narrow");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await shot("large");
  for (const scale of ["100", "110", "125", "150"]) {
    await page.getByLabel("UI scale", { exact: true }).selectOption(scale);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.reload();
  await page.waitForSelector(".app-shell", { timeout: 90000 });
  assert.equal(
    await page
      .getByRole("separator", { name: "Left settings width" })
      .getAttribute("aria-valuenow"),
    String(+before! + 60),
  );
  await expect(
    page.getByRole("button", { name: "Reload graphics", exact: true }),
  ).not.toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: saved splitters and workspaces, viewport isolation, PNG download, nondestructive presets, scopes, clip and curve drag undo, captions, export ranges/FPS, 900–1920px, UI scales.",
  );
} finally {
  await browser.close();
  server.kill();
}
