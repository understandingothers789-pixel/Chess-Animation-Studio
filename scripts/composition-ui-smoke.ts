import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { titleShot, shotFromMove } from "../src/core/storyboard";
import { annotation } from "../src/core/annotations";
const fixture = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
fixture.format = "vertical";
fixture.storyboard.shots = [
  shotFromMove(fixture, fixture.moves[0].id, "position-hold", "after"),
  titleShot(fixture, "Transition title", 1),
  shotFromMove(fixture, fixture.moves[3].id),
];
fixture.storyboard.shots[0].duration = 4;
fixture.storyboard.shots[2].duration = 1;
fixture.storyboard.shots[2].preHold = 0;
fixture.storyboard.shots[2].postHold = 0;
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
const audio: Record<string, string> = {};
fixture.annotations = [
  {
    ...annotation("caption", 0),
    id: "inherited",
    text: "Source-owned caption",
    y: 0.35,
    end: 60,
    entrance: "none",
    exit: "none",
  },
];
fixture.storyboard.shots[0].inheritAnnotations = true;
await fs.mkdir("docs/composition-033", { recursive: true });
const port = process.env.COMPOSITION_PORT ?? "5194",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
  { stdio: "pipe" },
);
let browser;
let page: import("@playwright/test").Page | undefined;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
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
  page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Page error:", e.message);
  });
  page.setDefaultTimeout(90000);
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
  await page.goto(origin);
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(3);
  await page.locator(".shot-card").first().click();
  const state = () => page!.evaluate(() => (window as any).__state.project);
  const layer = page.locator('[data-annotation-id="text2"]');
  await expect(layer).toBeVisible();
  await page.locator('[data-annotation-id="source-inherited"]').click();
  await expect(
    page.getByText(
      /Text inherited from Source or an outgoing transition is read-only/,
    ),
  ).toBeVisible();
  assert.deepEqual((await state()).annotations, fixture.annotations);
  const pixelsBeforeSelection = await page
    .getByLabel("Chess composition preview", { exact: true })
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await layer.click();
  assert.equal(
    await page
      .getByLabel("Chess composition preview", { exact: true })
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    pixelsBeforeSelection,
    "Selection handles must not change composited/export pixels",
  );
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    fixture.storyboard.shots[0].annotations[2].text,
  );
  await expect(layer).toHaveClass(/text-selected/);
  await expect(
    page.getByLabel("Shot caption", { exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "docs/composition-033/selected-layers.png" });
  console.log(
    "PASS: selection and inspector synchronization; source ownership is preserved",
  );
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
  console.log("PASS: drag transaction Undo and Redo");
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
  const copyId = (await state()).storyboard.shots[0].annotations[3].id;
  const copyLayer = page.locator(`[data-annotation-id="${copyId}"]`);
  const cb = (await copyLayer.boundingBox())!,
    ob = (await layer.boundingBox())!;
  const left = Math.max(cb.x, ob.x),
    right = Math.min(cb.x + cb.width, ob.x + ob.width),
    top = Math.max(cb.y, ob.y),
    bottom = Math.min(cb.y + cb.height, ob.y + ob.height);
  assert(
    right > left && bottom > top,
    "Duplicate fixture must overlap for hit testing",
  );
  await page.mouse.click((left + right) / 2, (top + bottom) / 2);
  await expect(copyLayer).toHaveClass(/text-selected/);
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
  console.log(
    "PASS: resize, keyboard, duplicate, persistence and narrow layout",
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator(".shot-card").nth(1).click();
  await page
    .getByLabel("Transition type", { exact: true })
    .selectOption("cross-dissolve");
  await page
    .getByLabel("Transition duration value", { exact: true })
    .fill("0.4");
  await page.getByLabel("Seek storyboard", { exact: true }).fill("4.2");
  await page.screenshot({
    path: "docs/composition-033/transition-dissolve.png",
  });
  await page
    .getByRole("button", { name: "Preview transition", exact: true })
    .click();
  await expect(
    page.getByLabel("Pause storyboard", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pause storyboard", { exact: true }).click();
  await page.locator(".shot-card").nth(2).click();
  await page
    .getByLabel("Transition type", { exact: true })
    .selectOption("fade-through-black");
  await page.getByLabel("Seek storyboard", { exact: true }).fill("5.25");
  await page.screenshot({ path: "docs/composition-033/transition-black.png" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTitle("Open composition", { exact: true }).click();
  assert.equal(
    (await state()).storyboard.shots[1].transition.type,
    "cross-dissolve",
  );
  await page
    .getByRole("main")
    .getByLabel("Output format", { exact: true })
    .selectOption("landscape");
  await page.screenshot({ path: "docs/composition-033/landscape.png" });
  await page.getByLabel("UI scale", { exact: true }).selectOption("150");
  await page.screenshot({ path: "docs/composition-033/scale150.png" });
  await page.getByLabel("UI scale", { exact: true }).selectOption("100");
  await page.locator(".shot-card").first().click();
  await page.getByLabel("Seek storyboard", { exact: true }).fill("0.5");
  await page
    .getByRole("main")
    .getByLabel("Output format", { exact: true })
    .selectOption("square");
  await page.getByLabel("Preview zoom", { exact: true }).fill("150");
  await page.locator('[data-annotation-id="text1"]').click();
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    "White to move",
  );
  await page.screenshot({ path: "docs/composition-033/zoom-square.png" });
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: "Full preview", exact: true }).click();
  await page.locator('[data-annotation-id="text0"]').click();
  await expect(page.locator('[data-annotation-id="text0"]')).toHaveClass(
    /text-selected/,
  );
  await page.screenshot({ path: "docs/composition-033/fullscreen.png" });
  await page.keyboard.press("Escape");
  assert.deepEqual((await state()).annotations, fixture.annotations);
  assert.deepEqual((await state()).moves, fixture.moves);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: multi-layer selection, live dragging, one-step Undo/Redo, resizing without font mutation, keyboard nudge, duplicate, persistence, source preservation",
  );
} catch (e) {
  await page
    ?.screenshot({ path: "test-results/composition-ui-failure.png" })
    .catch(() => {});
  throw e;
} finally {
  await browser?.close();
  server.kill();
}
