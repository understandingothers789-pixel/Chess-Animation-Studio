import {
  _electron as electron,
  type Page,
  type ElectronApplication,
} from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  parseProject,
  FORMATS,
  DIMENSIONS,
  type Project,
  type Format,
} from "../src/core/model";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  results = path.join(root, "test-results");
await fs.mkdir(results, { recursive: true });
for (const name of await fs.readdir(results))
  if (name.startsWith(".castudio-export-"))
    await fs.rm(path.join(results, name), { recursive: true, force: true });
const data = await fs.mkdtemp("/tmp/castudio-smoke-"),
  savedPath = path.join(data, "Round-trip.castudio");
await fs.writeFile(
  path.join(data, "settings.json"),
  JSON.stringify({
    ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
    stockfish:
      process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish",
    recent: [path.join(root, "samples/Opera-Game.castudio")],
  }),
);
const launch = () =>
  electron.launch({
    args: [
      root,
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":99",
      STUDIO_TEST_DATA: data,
    },
  });
const errors: string[] = [];
let app: ElectronApplication | null = await launch();
const checkPage = (page: Page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/ALSA|AudioContext/.test(m.text()))
      errors.push(m.text());
  });
};
const snapshot = (page: Page) =>
  page
    .locator("canvas")
    .first()
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
async function exportClip(
  page: Page,
  p: Project,
  format: Format,
  end: number,
  small = false,
) {
  const output = path.join(results, `${small ? "foundation" : format}.mp4`);
  await fs.rm(output, { force: true });
  await page.evaluate(
    async ({ project, output, format, end, small }) => {
      (window as any).__exportEvents = [];
      await window.studio.exportVideo(project, null, {
        format,
        encoder: "software",
        ...(small ? { width: 640, height: 360 } : {}),
        fps: 60,
        start: small ? 0 : 4,
        end: small ? end : 4 + end,
        path: output,
      });
    },
    { project: p, output, format, end, small },
  );
  await page.waitForFunction(
    () =>
      (window as any).__exportEvents.some((p: any) =>
        ["complete", "error"].includes(p.phase),
      ),
    {},
    { timeout: 180000 },
  );
  const events = await page.evaluate(() => (window as any).__exportEvents);
  assert.equal(events.at(-1).phase, "complete", JSON.stringify(events.at(-1)));
  const probe = JSON.parse(
    execFileSync(
      process.env.FFPROBE_PATH ?? "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
      { encoding: "utf8" },
    ),
  );
  const video = probe.streams.find((s: any) => s.codec_type === "video"),
    audio = probe.streams.find((s: any) => s.codec_type === "audio");
  const [w, h] = small ? [640, 360] : DIMENSIONS[format];
  assert.equal(video.width, w);
  assert.equal(video.height, h);
  assert.equal(video.avg_frame_rate, "60/1");
  assert.equal(video.codec_name, "h264");
  assert.equal(audio.codec_name, "aac");
  assert.ok(Math.abs(Number(probe.format.duration) - end) < 0.04);
  await fs.writeFile(
    path.join(results, `${small ? "foundation" : format}-probe.json`),
    JSON.stringify(probe, null, 2),
  );
  console.log(
    `PASS: Electron → H.264/AAC ${format}, ${w}×${h}, 60 FPS, ${probe.format.duration}s.`,
  );
  return output;
}
try {
  const page = await app.firstWindow();
  checkPage(page);
  await page.waitForSelector("canvas");
  await page.waitForTimeout(500);
  // Real controls must alter the live scene, and seeking/undo must reconstruct it.
  await page.getByTitle("3. Nf3", { exact: true }).click();
  await page.waitForTimeout(100);
  const before = await snapshot(page);
  await page.getByTitle("5. d4", { exact: true }).click();
  await page.getByTitle("3. Nf3", { exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(
    await snapshot(page),
    before,
    "Backward seek changed deterministic frame",
  );
  await page
    .getByRole("spinbutton", { name: "Rotation value", exact: true })
    .fill("540");
  await page.waitForTimeout(100);
  assert.notEqual(
    await snapshot(page),
    before,
    "Rotation control had no visible effect",
  );
  await page.getByTitle("Undo (Ctrl+Z)", { exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(
    await snapshot(page),
    before,
    "Undo did not restore rendered frame",
  );
  console.log(
    "PASS: move selection, backward seeking, live rotation editing, and undo reconstruct identical pixels.",
  );
  await page
    .getByRole("button", {
      name: "Open sample with original music",
      exact: true,
    })
    .click();
  await page.waitForTimeout(300);
  await page.getByTitle("Music", { exact: true }).click();
  assert.ok((await page.locator(".beat-row").count()) > 20);
  assert.ok((await page.locator(".mini-wave line").count()) > 100);
  await page.evaluate(() => {
    const start = AudioBufferSourceNode.prototype.start;
    (window as any).__audioDurations = [];
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<typeof start>
    ) {
      (window as any).__audioDurations.push(this.buffer?.duration);
      return start.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.ok(
    (
      await page.evaluate(() => (window as any).__audioDurations as number[])
    ).some((v) => v > 5),
    "Imported music was not decoded/scheduled for playback",
  );
  await page
    .getByRole("button", { name: "Preview automatic timing", exact: true })
    .click();
  await page.waitForSelector(".arrangement-banner");
  await page
    .locator(".arrangement-banner")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Beat 1 time", exact: true })
    .fill("1.8");
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Beat 1 time", exact: true })
      .inputValue(),
    "1.8",
  );
  await page.getByRole("button", { name: "look", exact: true }).click();
  await page
    .getByLabel("Badge override", { exact: true })
    .selectOption("brilliant");
  await page.getByTitle("Analysis", { exact: true }).click();
  await page
    .getByRole("button", { name: "Local Stockfish", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes("Engine · best") ||
      document.body.textContent?.includes("Engine · good") ||
      document.body.textContent?.includes("Engine · inaccuracy") ||
      document.body.textContent?.includes("Engine · mistake") ||
      document.body.textContent?.includes("Engine · blunder"),
    {},
    { timeout: 20000 },
  );
  assert.equal(
    await page.getByLabel("Badge override", { exact: true }).inputValue(),
    "brilliant",
  );
  console.log(
    "PASS: music waveform, beat correction, timing preview, local Stockfish, and manual badge priority.",
  );
  // Stub user choices in native dialogs, exercising the actual project IPC/filesystem.
  await app.evaluate(({ dialog }, savedPath) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: savedPath,
    })) as any;
    dialog.showMessageBox = (async () => ({
      response: 1,
      checkboxChecked: false,
    })) as any;
  }, savedPath);
  await page.getByRole("button", { name: "Save as", exact: true }).click();
  await page.waitForFunction(() =>
    document.body.textContent?.includes("Project saved safely."),
  );
  const saved = parseProject(JSON.parse(await fs.readFile(savedPath, "utf8")));
  assert.equal(saved.moves[0].effect.badge.manual, "brilliant");
  assert.equal(saved.beats[0].time, 1.8);
  assert.ok(!path.isAbsolute(saved.assets[0].path));
  await page.getByTitle("Game", { exact: true }).click();
  await page.getByTitle("New project", { exact: true }).click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".move-row").count(), 0);
  // Enter a legal move by clicking the actual GPU board.
  const canvas = page.getByLabel("Composition preview", { exact: true }),
    rect = (await canvas.boundingBox())!;
  for (const y of [-2.5, -0.5])
    await page.mouse.click(
      rect.x + rect.width / 2 + (0.5 * rect.height) / 9.5,
      rect.y + rect.height / 2 - (y * rect.height) / 9.5,
    );
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".move-row b").first().textContent(), "e4");
  await app.evaluate(({ dialog }, savedPath) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [savedPath],
    })) as any;
  }, savedPath);
  await page.getByTitle("Open project", { exact: true }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator(".move-row").count(), 33);
  assert.equal(
    await page.getByLabel("Badge override", { exact: true }).inputValue(),
    "brilliant",
  );
  await page.getByTitle("Styles", { exact: true }).click();
  await page.getByTitle("3. Nf3", { exact: true }).click();
  await page.screenshot({ path: path.join(results, "editor.png") });
  console.log(
    "PASS: native project save/open round trip, relative assets, and legal board input.",
  );
  await page.evaluate(() => {
    (window as any).__exportEvents = [];
    window.studio.onExport((p) => (window as any).__exportEvents.push(p));
  });
  const p = parseProject(
    JSON.parse(
      await fs.readFile(path.join(root, "samples/Opera-Game.castudio"), "utf8"),
    ),
  );
  p.assets.forEach((a) => (a.path = path.join(root, "samples", a.path)));
  const video = await exportClip(page, p, "landscape", 6, true);
  execFileSync(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "4.2333",
    "-i",
    video,
    "-frames:v",
    "1",
    path.join(results, "thin-turn.png"),
  ]);
  for (const format of FORMATS) {
    await exportClip(page, p, format, 0.3);
  }
  const cancelled = path.join(results, "must-not-exist.mp4");
  await fs.rm(cancelled, { force: true });
  await page.evaluate(
    async ({ project, output }) => {
      (window as any).__exportEvents = [];
      await window.studio.exportVideo(project, null, {
        format: "square",
        encoder: "software",
        width: 640,
        height: 640,
        end: 20,
        path: output,
      });
    },
    { project: p, output: cancelled },
  );
  await page.waitForFunction(
    () => (window as any).__exportEvents.some((p: any) => p.done >= 15),
    {},
    { timeout: 30000 },
  );
  await page.evaluate(() => window.studio.cancelExport());
  await page.waitForFunction(() =>
    (window as any).__exportEvents.some((p: any) => p.phase === "cancelled"),
  );
  await assert.rejects(fs.access(cancelled));
  assert.ok(
    !(await fs.readdir(results)).some((n) => n.startsWith(".castudio-export-")),
  );
  console.log(
    "PASS: desktop export cancellation preserves project and removes all partial files.",
  );
  const windowPromise = app.waitForEvent("window");
  await page.getByRole("button", { name: "Present", exact: true }).click();
  const presentation = await windowPromise;
  await presentation.waitForSelector("canvas");
  await presentation.waitForTimeout(250);
  assert.equal(await presentation.locator("button,input,select").count(), 0);
  await presentation.screenshot({
    path: path.join(results, "presentation.png"),
  });
  await presentation.close();
  console.log(
    "PASS: clean presentation window uses the composition without editor controls.",
  );
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Recovered composition");
  await page.waitForTimeout(1800);
  assert.ok(
    (await fs.readFile(path.join(data, "recovery.json"), "utf8")).includes(
      "Recovered composition",
    ),
  );
  await app.close();
  app = await launch();
  const recovered = await app.firstWindow();
  checkPage(recovered);
  await recovered
    .getByRole("button", { name: "Recover session", exact: true })
    .click();
  await recovered.waitForTimeout(200);
  assert.equal(
    await recovered.getByLabel("Project title", { exact: true }).inputValue(),
    "Recovered composition",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: autosave recovery after a fresh app launch; no renderer exceptions.",
  );
  await fs.writeFile(
    path.join(results, "desktop-validation.txt"),
    "PASS: deterministic pixels, live controls, audio/beat editing, engine/manual overrides, legal input, save/open, all four production resolutions at 60 FPS, cancellation, clean presentation, recovery.\nLinux Electron with SwiftShader; Windows, native AMD GPU, OBS and Resolve not tested.\n",
  );
} finally {
  await app?.close();
  await fs.rm(data, { recursive: true, force: true });
}
