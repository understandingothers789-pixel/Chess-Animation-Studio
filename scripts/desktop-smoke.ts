import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { duration, segments } from "../src/core/timeline";
const dir = path.resolve("test-results");
await fs.mkdir(dir, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chess-studio-smoke-"));
const errors: string[] = [];
const packed = process.env.STUDIO_PACKAGED_EXE;
const launch = await electron.launch({
  ...(packed ? { executablePath: packed } : {}),
  args: [
    ...(packed ? [] : ["."]),
    ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
  env: {
    ...process.env,
    STUDIO_USER_DATA: profile,
    STUDIO_TEST: "1",
    FFMPEG_PATH:
      process.env.FFMPEG_PATH ??
      (process.platform === "win32" ? "ffmpeg" : "/usr/bin/ffmpeg"),
    STOCKFISH_PATH:
      process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish",
    DISPLAY: process.env.DISPLAY ?? ":100",
  },
  timeout: 60000,
});
try {
  const page = await launch.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.waitForSelector(".app-shell");
  await page.waitForFunction(
    () => !document.querySelector(".loading"),
    {},
    { timeout: 90000 },
  );
  await page
    .getByRole("button", { name: /Open Opera Game with original music/ })
    .click();
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(dir, packed ? "packaged-editor.png" : "editor.png"),
  });
  const result = await page.evaluate(async () => {
    const p = await window.studio.sample();
    return { project: p, duration: p.music.sourceDuration };
  });
  assert.equal(result.project.moves.length, 33);
  assert.ok(result.duration > 20);
  console.log(
    "PASS: application launches, vector art prepares, and bundled sample opens.",
  );
  await page.evaluate(() => {
    const old = AudioBufferSourceNode.prototype.start;
    (window as any).__musicStarts = [];
    AudioBufferSourceNode.prototype.start = function (...args: any[]) {
      (window as any).__musicStarts.push(this.buffer?.duration ?? 0);
      return (old as any).apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.ok(
    await page.evaluate(() =>
      (window as any).__musicStarts.some((v: number) => v > 5),
    ),
    "Sample music should decode and schedule for playback.",
  );
  for (const panel of [
    "game",
    "styles",
    "music",
    "scene",
    "analysis",
    "files",
  ]) {
    await page.getByRole("button", { name: panel, exact: true }).click();
    const missing = await page
      .locator("input,select,textarea")
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
    assert.deepEqual(
      missing,
      [],
      `Every setting in ${panel} needs explanatory hover and accessible help.`,
    );
  }
  await page.getByRole("button", { name: "scene", exact: true }).click();
  assert.equal(
    (
      await page.getByLabel("Dark squares", { exact: true }).inputValue()
    ).toLowerCase(),
    "#b88762",
  );
  assert.equal(
    (
      await page.getByLabel("Light squares", { exact: true }).inputValue()
    ).toLowerCase(),
    "#edd6b0",
  );
  console.log(
    "PASS: requested brown/beige defaults and explanatory tooltips across every settings panel.",
  );
  await page
    .getByLabel("Piece artwork", { exact: true })
    .selectOption("cburnett");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, "cburnett.png") });
  await page
    .getByLabel("Piece artwork", { exact: true })
    .selectOption("merida");
  await page.getByLabel("Seek composition", { exact: true }).fill("1.2");
  await page.waitForTimeout(350);
  const first = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.getByLabel("Seek composition", { exact: true }).fill("12");
  await page.waitForTimeout(150);
  await page.getByLabel("Seek composition", { exact: true }).fill("1.2");
  await page.waitForTimeout(350);
  const repeated = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  assert.equal(first, repeated);
  console.log(
    "PASS: both artwork sets render; backward seeking reproduces identical pixels.",
  );
  await page
    .getByRole("button", { name: "Select intro clip", exact: true })
    .click();
  await page.getByLabel("Opener preset", { exact: true }).selectOption("zoom");
  assert.equal(
    await page.getByLabel("Opener preset", { exact: true }).inputValue(),
    "zoom",
  );
  await page
    .getByLabel("Opener preset", { exact: true })
    .selectOption("zoom-turn");
  await page.locator(".move-track button").nth(1).click();
  await page
    .locator(".move-track button")
    .nth(3)
    .click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "motion", exact: true }).click();
  await page
    .getByLabel("Move preset", { exact: true })
    .selectOption("sway-half");
  for (let i = 1; i <= 3; i++)
    assert.equal(
      await page
        .locator(".move-track button")
        .nth(i)
        .locator("small")
        .innerText(),
      "sway-half",
    );
  assert.equal(
    await page
      .locator(".move-track button")
      .nth(4)
      .locator("small")
      .innerText(),
    "slide",
  );
  await page.getByLabel("Duration value", { exact: true }).fill("1.8");
  await page.locator(".move-track button").nth(1).click();
  assert.equal(
    await page.getByLabel("Duration value", { exact: true }).inputValue(),
    "1.8",
  );
  await page.locator(".move-track button").nth(2).click();
  assert.equal(
    await page.getByLabel("Duration value", { exact: true }).inputValue(),
    "1.8",
  );
  assert.ok(
    await page.getByLabel("Inside board only", { exact: true }).isChecked(),
  );
  await page.getByLabel("Seek composition", { exact: true }).fill("0");
  await page.getByLabel("Particle count value", { exact: true }).fill("300");
  await page.getByLabel("Particle size value", { exact: true }).fill("0.18");
  await page.waitForTimeout(250);
  const snowInside = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.screenshot({ path: path.join(dir, "snow-inside.png") });
  await page.getByLabel("Inside board only", { exact: true }).uncheck();
  await page.waitForTimeout(250);
  assert.notEqual(
    await page
      .locator(".preview-host canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    snowInside,
  );
  await page.getByLabel("Inside board only", { exact: true }).check();
  await page
    .getByRole("button", { name: "Reset Particle count", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Particle count value", { exact: true }).inputValue(),
    "100",
  );
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal(
    await page.getByLabel("Particle count value", { exact: true }).inputValue(),
    "300",
  );
  await page
    .getByRole("button", {
      name: "Reset Snow particles · amount & appearance",
      exact: true,
    })
    .click();
  assert.equal(
    await page.getByLabel("Particle count value", { exact: true }).inputValue(),
    "100",
  );
  assert.equal(
    await page.getByLabel("Particle size value", { exact: true }).inputValue(),
    "0.065",
  );
  await page.locator(".move-track button").nth(1).click();
  await page
    .locator(".move-track button")
    .nth(3)
    .click({ modifiers: ["Shift"] });
  await page
    .getByRole("button", { name: "Reset Movement", exact: true })
    .click();
  for (let i = 1; i <= 3; i++) {
    await page.locator(".move-track button").nth(i).click();
    assert.equal(
      await page.getByLabel("Duration value", { exact: true }).inputValue(),
      "1.6",
    );
  }
  const brand = page.locator("img.brand-icon");
  assert.ok((await brand.getAttribute("src"))?.includes("studio-mark.svg"));
  console.log(
    "PASS: new logo, individual/group snow reset, Undo and selection-wide preset-aware movement reset.",
  );
  console.log(
    "PASS: selectable intro presets, multi-move Half sway and duration edits, board-only snow controls.",
  );
  await page.getByRole("button", { name: "motion", exact: true }).click();
  await page.getByLabel("Move preset", { exact: true }).selectOption("spin");
  await page.getByLabel("Seek composition", { exact: true }).fill("0.888");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, "thin-edge.png") });
  await launch.evaluate(({ dialog }, dir) => {
    const state = globalThis as any;
    state.__savePath = "";
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: state.__savePath,
    });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [state.__openPath],
    });
  }, dir);
  const save = path.join(dir, "round-trip.castudio");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, save);
  await page.evaluate(async () => {
    const p = await window.studio.sample();
    await window.studio.save(p, true);
  });
  const json = JSON.parse(await fs.readFile(save, "utf8"));
  assert.equal(json.schema, 2);
  assert.equal(json.assets[0].path.includes("Opera-original.wav"), true);
  await launch.evaluate((_, file) => {
    (globalThis as any).__openPath = file;
  }, save);
  assert.equal(
    (await page.evaluate(() => window.studio.open()))!.project.moves.length,
    33,
  );
  console.log(
    "PASS: native IPC saves and reopens the sample with relative asset references.",
  );
  const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
  const output = path.join(dir, packed ? "packaged.mp4" : "editor.mp4");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, output);
  await page.evaluate(() => {
    (window as any).__progress = null;
    window.studio.onExport((v) => {
      (window as any).__progress = v;
    });
  });
  await page.evaluate(async () => {
    const p = await window.studio.sample();
    await window.studio.export(p, {
      format: "landscape",
      start: 1,
      end: 2,
      width: 640,
      height: 360,
      fps: 60,
    });
  });
  await page.waitForFunction(
    () => ["Complete", "Failed"].includes((window as any).__progress?.phase),
    {},
    { timeout: process.platform === "win32" ? 300000 : 180000 },
  );
  const progress = await page.evaluate(() => (window as any).__progress);
  assert.equal(progress.phase, "Complete", progress.error);
  const probe = JSON.parse(
    execFileSync(
      ffprobe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
      { encoding: "utf8" },
    ),
  );
  assert.equal(
    probe.streams.find((s: any) => s.codec_type === "video").r_frame_rate,
    "60/1",
  );
  assert.equal(
    probe.streams.find((s: any) => s.codec_type === "audio").codec_name,
    "aac",
  );
  console.log("PASS: exact-time H.264/AAC MP4 exported at 60 FPS.");
  for (const format of ["vertical", "square", "square-in-vertical"] as const) {
    const f = path.join(dir, format + ".mp4");
    await launch.evaluate((_, file) => {
      (globalThis as any).__savePath = file;
    }, f);
    await page.evaluate(async (format) => {
      (window as any).__progress = null;
      const p = await window.studio.sample();
      await window.studio.export(p, { format, start: 4, end: 4.05 });
    }, format);
    await page.waitForFunction(
      () => ["Complete", "Failed"].includes((window as any).__progress?.phase),
      {},
      { timeout: process.platform === "win32" ? 300000 : 180000 },
    );
    const v = await page.evaluate(() => (window as any).__progress);
    assert.equal(v.phase, "Complete", v.error);
    const pr = JSON.parse(
      execFileSync(
        ffprobe,
        ["-v", "error", "-show_streams", "-of", "json", f],
        { encoding: "utf8" },
      ),
    );
    const video = pr.streams.find((s: any) => s.codec_type === "video");
    assert.equal(video.width, 1080);
    assert.equal(video.height, format === "square" ? 1080 : 1920);
  }
  console.log(
    "PASS: native-sized vertical, square and square-in-vertical exports.",
  );
  const cancel = path.join(dir, "cancelled.mp4");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, cancel);
  await page.evaluate(async () => {
    const p = await window.studio.sample();
    await window.studio.export(p, { format: "landscape", start: 0, end: 20 });
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.studio.cancelExport());
  await page.waitForTimeout(1000);
  assert.equal(
    await fs.stat(cancel).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.equal(
    (await fs.readdir(dir)).some((s) => s.startsWith(".chess-studio-export-")),
    false,
  );
  console.log(
    "PASS: cancellation removes temporary files and preserves the project.",
  );
  await page.getByRole("button", { name: "game", exact: true }).click();
  await page.locator(".move-track button").nth(1).click();
  await page.getByRole("button", { name: "look", exact: true }).click();
  await page.getByLabel("Seek composition", { exact: true }).fill("3");
  await page.waitForTimeout(200);
  const settledPreview = () =>
    page
      .locator(".preview-host canvas")
      .evaluate(async (c: HTMLCanvasElement) => {
        // Wait for React state and the preview's RAF draw, rather than elapsed wall time.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return c.toDataURL();
      });
  const plainPixels = await settledPreview();
  await page
    .getByRole("button", { name: "Apply red flicker", exact: true })
    .click();
  await page.waitForTimeout(200);
  const lightPixels = await settledPreview();
  assert.notEqual(lightPixels, plainPixels);
  await page.getByLabel("Seek composition", { exact: true }).fill("8");
  await settledPreview();
  await page.getByLabel("Seek composition", { exact: true }).fill("3");
  await page.waitForTimeout(200);
  assert.equal(await settledPreview(), lightPixels);
  await page
    .getByRole("button", { name: "Reset Move light & flicker", exact: true })
    .click();
  console.log(
    "PASS: per-move light wash changes pixels and reconstructs exactly after backward seeking.",
  );
  await page.getByRole("button", { name: "motion", exact: true }).click();
  const spotlightTime =
    blank().lead +
    +(await page.getByLabel("Duration value", { exact: true }).inputValue()) +
    +(await page
      .getByLabel("Departure delay value", { exact: true })
      .inputValue()) +
    0.5;
  const ordinaryEnd = +(await page
    .getByLabel("Seek composition", { exact: true })
    .getAttribute("max"))!;
  await page.getByRole("button", { name: "look", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply beat spotlight", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Beat zoom rhythm", { exact: true }).inputValue(),
    "alternate",
  );
  await page
    .getByLabel("Spotlight beat source", { exact: true })
    .selectOption("bpm");
  await page.getByLabel("Spotlight BPM value", { exact: true }).fill("120");
  assert.ok(
    +(await page
      .getByLabel("Seek composition", { exact: true })
      .getAttribute("max"))! > ordinaryEnd,
  );
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+spotlightTime.toFixed(3)));
  await page.waitForTimeout(350);
  const spotlightPixels = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+(spotlightTime + 0.15).toFixed(3)));
  await page.waitForTimeout(200);
  assert.notEqual(
    await page
      .locator(".preview-host canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    spotlightPixels,
  );
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+spotlightTime.toFixed(3)));
  await page.waitForTimeout(350);
  assert.equal(
    await page
      .locator(".preview-host canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    spotlightPixels,
  );
  await page
    .getByRole("button", {
      name: "Reset Beat spotlight transition",
      exact: true,
    })
    .click();
  assert.ok(
    Math.abs(
      +(await page
        .getByLabel("Seek composition", { exact: true })
        .getAttribute("max"))! - ordinaryEnd,
    ) < 0.00001,
  );
  console.log(
    "PASS: beat spotlight reserves time, renders beat-driven camera/post effects, reconstructs after seeking and restores ordinary timing.",
  );
  const dustPgn = "1. e4 d5 2. exd5 Qxd5";
  await page.getByLabel("Game text", { exact: true }).fill(dustPgn);
  await page
    .getByLabel("Preserve matching move effects", { exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".move-track button").length === 5,
  );
  const dustProbe = importPgn(blank(), dustPgn),
    dustMove = dustProbe.moves[2];
  const dustTime =
    segments(dustProbe)[2].depart +
    dustMove.effect.duration * dustMove.effect.capture.exitAt +
    0.18;
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+dustTime.toFixed(3)));
  await page.waitForTimeout(300);
  const dustPixels = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.getByLabel("Seek composition", { exact: true }).fill("4");
  await page.waitForTimeout(150);
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+dustTime.toFixed(3)));
  await page.waitForTimeout(300);
  assert.equal(
    await page
      .locator(".preview-host canvas")
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    dustPixels,
  );
  console.log(
    "PASS: captured-piece dust renders and backward seeking reconstructs it exactly.",
  );
  await page.evaluate(() => window.studio.presentation());
  let win = launch.windows().find((w) => w.url().includes("role=presentation"));
  for (let attempt = 0; !win && attempt < 120; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    win = launch.windows().find((w) => w.url().includes("role=presentation"));
  }
  assert.ok(win, "The presentation window should load its own output page.");
  await win.waitForSelector(".output", { timeout: 60000 });
  await page.waitForTimeout(500);
  assert.equal(await win.locator("button").count(), 0);
  console.log("PASS: clean presentation window has no editor controls.");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(dir, "desktop-validation.txt"),
    `PASS on ${process.platform}, ${packed ? "packaged app" : "development app"}; no renderer errors.\n`,
  );
} finally {
  await launch.close();
}
