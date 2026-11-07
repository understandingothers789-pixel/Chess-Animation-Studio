import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { blank, VERSION } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { shotCaption, shotFromMove, titleShot } from "../src/core/storyboard";
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
// Keep process-level evidence when the Electron inspector context disappears.
// This is especially useful on CI, where the packaged profile is ephemeral.
const diagnostics: string[] = [];
const electronProcess = launch.process();
let completed = false;
electronProcess.stdout?.on("data", (data) =>
  diagnostics.push(`stdout: ${data}`),
);
electronProcess.stderr?.on("data", (data) =>
  diagnostics.push(`stderr: ${data}`),
);
electronProcess.on("exit", (code, signal) =>
  diagnostics.push(`process exit: code=${code} signal=${signal}`),
);
try {
  const page = await launch.firstWindow();
  await page.setViewportSize({ width: 1550, height: 980 });
  page.setDefaultTimeout(90000);
  page.on("crash", () => diagnostics.push("editor renderer crashed"));
  page.on("close", () => diagnostics.push("editor window closed"));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.waitForSelector(".app-shell");
  assert.equal(await page.title(), `Chess Animation Studio ${VERSION}`);
  assert.equal(await page.getByText(`LOCAL STUDIO · v${VERSION}`).count(), 1);
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
  // Validate actual context flyouts inside the packaged Electron runtime too.
  await page.locator(".move-clip").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Copy", exact: true }).hover();
  await expect(page.getByRole("menu")).toHaveCount(2);
  await expect(
    page.getByRole("menuitem", { name: "Copy", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: path.join(dir, "packaged-hover-flyout.png") });
  await page.keyboard.press("Escape");
  await page.locator(".move-clip").first().click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Speed / Duration", exact: true })
    .hover();
  await page
    .getByRole("menuitem", { name: "Set exact duration…", exact: true })
    .click();
  await expect(
    page.getByLabel("Duration value", { exact: true }),
  ).toBeFocused();
  await page.locator(".move-clip").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Bulk edit from/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Apply move settings" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  console.log(
    "PASS: packaged hover flyouts, exact duration targeting, and bulk panel cancellation.",
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.ok(
    await page.evaluate(() =>
      (window as any).__musicStarts.some((v: number) => v > 5),
    ),
    "Sample music should decode and schedule for playback.",
  );
  for (const panel of [
    "game",
    "presets",
    "music",
    "board",
    "framing",
    "atmosphere",
    "effects",
    "analysis",
    "files",
  ]) {
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
    assert.deepEqual(
      missing,
      [],
      `Every setting in ${panel} needs explanatory hover and accessible help.`,
    );
  }
  await page.getByRole("button", { name: "board", exact: true }).click();
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const first = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.getByLabel("Seek composition", { exact: true }).fill("12");
  await page.waitForTimeout(150);
  await page.getByLabel("Seek composition", { exact: true }).fill("1.2");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
  await page.getByRole("button", { name: "move", exact: true }).click();
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
  await page
    .locator(".library-tabs")
    .getByRole("button", { name: "atmosphere", exact: true })
    .click();
  assert.ok(
    await page.getByLabel("Inside board only", { exact: true }).isChecked(),
  );
  await page.getByLabel("Seek composition", { exact: true }).fill("0");
  await page.getByLabel("Particle count value", { exact: true }).fill("300");
  await page.getByLabel("Particle size value", { exact: true }).fill("0.18");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const snowInside = await page
    .locator(".preview-host canvas")
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.screenshot({ path: path.join(dir, "snow-inside.png") });
  await page.getByLabel("Inside board only", { exact: true }).uncheck();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
  await page.getByRole("button", { name: "move", exact: true }).click();
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
    p.bloom = {
      enabled: true,
      intensity: 0.35,
      threshold: 0.55,
      radius: 2,
      softness: 0.2,
      pieces: true,
      captures: true,
      highlights: true,
    };
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
  console.log("PASS: exact-time H.264/AAC MP4 with bloom exported at 60 FPS.");
  for (const fps of [24, 30]) {
    const file = path.join(dir, `creator-${fps}.mp4`);
    await launch.evaluate((_, file) => {
      (globalThis as any).__savePath = file;
    }, file);
    await page.evaluate(async (fps) => {
      (window as any).__progress = null;
      const p = await window.studio.sample();
      p.annotations = [
        {
          layout: {
            placement: "standard",
            maxWidth: 0.88,
            maxLines: 3,
            minSize: 28,
            autoSize: true,
            scale: 1,
            lineSpacing: 1.3,
            weight: 600,
            customMargins: false,
            top: 0.06,
            bottom: 0.12,
            left: 0.06,
            right: 0.06,
          },
          id: "caption-test",
          kind: "caption",
          from: "e2",
          to: "e4",
          text: "Find the winning move!",
          color: "#c8e79c",
          background: "#173322",
          width: 0.09,
          opacity: 1,
          start: 0,
          end: 20,
          fade: 0.1,
          entrance: "fade",
          exit: "fade",
          x: 0.5,
          y: 0.15,
          size: 48,
          font: "sans-serif",
          align: "center",
          outline: true,
          shadow: true,
        },
      ];
      await window.studio.export(p, {
        format: "landscape",
        start: 4,
        end: 4.25,
        width: 640,
        height: 360,
        fps,
      });
    }, fps);
    await page.waitForFunction(
      () => ["Complete", "Failed"].includes((window as any).__progress?.phase),
      {},
      { timeout: 180000 },
    );
    const result = await page.evaluate(() => (window as any).__progress);
    assert.equal(result.phase, "Complete", result.error);
    const probe = JSON.parse(
      execFileSync(
        ffprobe,
        ["-v", "error", "-show_streams", "-of", "json", file],
        { encoding: "utf8" },
      ),
    );
    assert.equal(
      probe.streams.find((s: any) => s.codec_type === "video").r_frame_rate,
      `${fps}/1`,
    );
  }
  console.log(
    "PASS: captions exported through the native compositor at 24 and 30 FPS.",
  );
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
  await page
    .locator(".inspector")
    .getByRole("button", { name: "effects", exact: true })
    .click();
  await page.getByLabel("Seek composition", { exact: true }).fill("3");
  await page.waitForTimeout(200);
  const settledPreview = async () => {
    await page.waitForFunction(() => {
      const c = document.querySelector<HTMLCanvasElement>(
        ".preview-host canvas",
      );
      return !!c && c.width >= 64 && c.height >= 64;
    });
    return page
      .locator(".preview-host canvas")
      .evaluate(async (c: HTMLCanvasElement) => {
        // Wait for React state and the preview's RAF draw, rather than elapsed wall time.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return c.toDataURL();
      });
  };
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
  await page.getByRole("button", { name: "move", exact: true }).click();
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
  await page
    .locator(".inspector")
    .getByRole("button", { name: "effects", exact: true })
    .click();
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
  const dustPixels = await settledPreview();
  await page.getByLabel("Seek composition", { exact: true }).fill("4");
  await page.waitForTimeout(150);
  await page
    .getByLabel("Seek composition", { exact: true })
    .fill(String(+dustTime.toFixed(3)));
  await page.waitForTimeout(300);
  assert.equal(await settledPreview(), dustPixels);
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
  win.on("pageerror", (e) => errors.push(e.message));
  const presentationFrame = await win
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await win.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    canvas
      .getContext("webgl2")!
      .getExtension("WEBGL_lose_context")!
      .loseContext();
  });
  await win.getByRole("button", { name: "Reload graphics" }).click();
  await win.waitForFunction(
    (expected) => document.querySelector("canvas")?.toDataURL() === expected,
    presentationFrame,
    { timeout: 60000 },
  );
  assert.equal(await win.getByRole("alert").count(), 0);
  console.log(
    "PASS: presentation recovers from simulated context loss with identical paused pixels and no uncaught exceptions.",
  );
  // Exercise the storyboard through the packaged IPC, UI and export worker.
  page.on("dialog", (d) => d.accept());
  const story = structuredClone(result.project);
  story.storyboard.shots = [
    shotFromMove(story, story.moves[20].id),
    shotFromMove(story, story.moves[0].id),
    shotFromMove(story, story.moves[10].id, "position-hold", "after"),
    titleShot(story, "Storyboard outro", 0.3),
  ];
  for (const s of story.storyboard.shots) {
    s.duration = 0.3;
    s.preHold = 0;
    s.postHold = 0;
    s.annotations.forEach((a) => {
      a.start = 0;
      a.end = 0.3;
    });
  }
  story.storyboard.shots[0].annotations = [
    shotCaption(
      story,
      "This bishop sacrifice looks completely losing until you notice the queen is trapped.",
      0.3,
    ),
  ];
  story.storyboard.beats = [
    { id: "native-beat", time: 0.1, accent: true, enabled: true },
  ];
  const storyPath = path.join(dir, "storyboard-roundtrip.castudio");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, storyPath);
  await page.evaluate((p) => window.studio.save(p, true), story);
  await launch.evaluate((_, file) => {
    (globalThis as any).__openPath = file;
  }, storyPath);
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  await page.locator(".shot-card").first().click();
  await page
    .getByLabel("Shot name", { exact: true })
    .fill("Packaged storyboard edit");
  await page.getByLabel("Shot name", { exact: true }).blur();
  await expect(page.locator(".shot-inspector h2")).toHaveText(
    "Packaged storyboard edit",
  );
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Saved composition", { exact: true }),
  ).toBeVisible();
  const reopened = await page.evaluate(() => window.studio.open());
  assert.equal(
    reopened!.project.storyboard.shots[0].name,
    "Packaged storyboard edit",
  );
  assert.deepEqual(reopened!.project.moves, story.moves);
  await page.locator(".story-waveform>summary").click();
  await expect(
    page.getByLabel("Music waveform and output ruler"),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Accent 1", exact: true }),
  ).toHaveCount(1);
  await page.locator(".story-waveform>summary").click();
  await page.getByLabel("Play storyboard", { exact: true }).click();
  await page.waitForTimeout(180);
  await expect(
    page.getByLabel("Seek storyboard", { exact: true }),
  ).not.toHaveValue("0");
  if (await page.getByLabel("Pause storyboard", { exact: true }).count())
    await page.getByLabel("Pause storyboard", { exact: true }).click();
  await page.screenshot({ path: path.join(dir, "packaged-storyboard.png") });
  const storyFile = path.join(dir, "packaged-storyboard.mp4");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, storyFile);
  await page.evaluate(async (p) => {
    (window as any).__progress = null;
    await window.studio.export(p, {
      mode: "storyboard",
      format: "landscape",
      start: 0,
      end: 1.2,
      width: 320,
      height: 180,
      fps: 30,
    });
  }, reopened!.project);
  await page.waitForFunction(
    () => ["Complete", "Failed"].includes((window as any).__progress?.phase),
    {},
    { timeout: 180000 },
  );
  const storyProgress = await page.evaluate(() => (window as any).__progress);
  assert.equal(storyProgress.phase, "Complete", storyProgress.error);
  const storyProbe = JSON.parse(
    execFileSync(
      ffprobe,
      ["-v", "error", "-show_streams", "-of", "json", storyFile],
      { encoding: "utf8" },
    ),
  );
  assert.equal(
    storyProbe.streams.find((s: any) => s.codec_type === "video").nb_frames,
    "36",
  );
  assert.equal(
    storyProbe.streams.find((s: any) => s.codec_type === "audio").codec_name,
    "aac",
  );
  const storyCancel = path.join(dir, "storyboard-cancelled.mp4");
  await launch.evaluate((_, file) => {
    (globalThis as any).__savePath = file;
  }, storyCancel);
  await page.evaluate(async (p) => {
    await window.studio.export(p, {
      mode: "storyboard",
      format: "landscape",
      start: 0,
      end: 1.2,
    });
  }, story);
  await page.evaluate(() => window.studio.cancelExport());
  assert.equal(
    await fs.stat(storyCancel).then(
      () => true,
      () => false,
    ),
    false,
  );
  await page.getByTitle("New composition", { exact: true }).click();
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue(
    blank().title,
  );
  console.log(
    "PASS: packaged storyboard creation, shot editing, native save/reopen, preview, nonconsecutive H.264/AAC export, cancellation, new project.",
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(dir, "desktop-validation.txt"),
    `PASS on ${process.platform}, ${packed ? "packaged app" : "development app"}; no renderer errors.\n`,
  );
  completed = true;
} finally {
  diagnostics.push(
    `before cleanup: exitCode=${electronProcess.exitCode} signalCode=${electronProcess.signalCode}`,
  );
  try {
    await launch.close();
  } finally {
    if (!completed)
      console.error("Electron process diagnostics:\n" + diagnostics.join("\n"));
    await fs.writeFile(
      path.join(dir, "electron-process-diagnostics.txt"),
      diagnostics.join("\n"),
    );
  }
}
