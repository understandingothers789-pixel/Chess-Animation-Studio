import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { blank } from "../src/core/project";
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "studio-ui-")),
  dir = path.resolve("test-results");
await fs.mkdir(dir, { recursive: true });
const launch = () =>
  electron.launch({
    args: [
      ".",
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      STUDIO_USER_DATA: profile,
      STUDIO_TEST: "1",
      DISPLAY: ":100",
      FFMPEG_PATH: "/usr/bin/ffmpeg",
    },
    timeout: 60000,
  });
const app = await launch();
try {
  const page = await app.firstWindow();
  page.on("dialog", (d) => d.accept());
  await page.waitForSelector(".app-shell");
  await page.waitForFunction(
    () => !document.querySelector(".loading"),
    {},
    { timeout: 90000 },
  );
  await page
    .getByRole("button", { name: /Open Opera Game with original music/ })
    .click();
  await page.waitForTimeout(2200);
  assert.equal(
    await page.locator(".status-bar.error").count(),
    0,
    await page.locator(".status-bar").innerText(),
  );
  await page.evaluate(() => {
    const start = AudioBufferSourceNode.prototype.start;
    (window as any).__sounds = [];
    AudioBufferSourceNode.prototype.start = function (...args: any[]) {
      (window as any).__sounds.push(this.buffer?.duration ?? 0);
      return (start as any).apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  assert.ok(
    await page.evaluate(() =>
      (window as any).__sounds.some((x: number) => x > 5),
    ),
  );
  console.log(
    "PASS: sample music decodes, schedules and plays without image-loader errors.",
  );
  await page.getByLabel("Move preset", { exact: true }).selectOption("spin");
  await page.getByLabel("Seek composition", { exact: true }).fill("0.888");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, "thin-edge.png") });
  await page.getByLabel("Move preset", { exact: true }).selectOption("sway");
  await page.getByLabel("Seek composition", { exact: true }).fill("1.05");
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(dir, "slow-sway.png") });
  await page.getByLabel("Preset name", { exact: true }).fill("My slow lean");
  await page
    .getByRole("button", { name: "Save as reusable preset", exact: true })
    .click();
  await page.getByRole("button", { name: "styles", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "My slow lean", exact: true })
      .count(),
    1,
  );
  console.log("PASS: refined effects save as reusable presets.");
  await app.evaluate(({ dialog }, dir) => {
    (globalThis as any).__save = dir + "/first.castudio";
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: (globalThis as any).__save,
    });
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [(globalThis as any).__open],
    });
  }, dir);
  await page.evaluate(async () => {
    const p = await window.studio.sample();
    await window.studio.save(p, true);
  });
  await app.evaluate(
    (_, file) => {
      (globalThis as any).__save = file;
    },
    path.join(dir, "second.castudio"),
  );
  await page.evaluate((p) => window.studio.save(p, false), blank());
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "first.castudio"), "utf8"))
      .moves.length,
    33,
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "second.castudio"), "utf8"))
      .moves.length,
    0,
  );
  console.log(
    "PASS: a new project cannot overwrite another composition through a stale native save path.",
  );
  const music = path.join(profile, "music.wav");
  await fs.copyFile("samples/Opera-original.wav", music);
  await app.evaluate((_, file) => {
    (globalThis as any).__open = file;
  }, music);
  await page.getByRole("button", { name: "music", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Import music", exact: true })
    .click();
  await page.waitForTimeout(1500);
  await fs.unlink(music);
  await page.waitForFunction(
    () =>
      document
        .querySelector(".status-bar")
        ?.textContent?.includes("missing assets"),
    {},
    { timeout: 10000 },
  );
  await fs.copyFile("samples/Opera-original.wav", music);
  await page.waitForFunction(
    () =>
      !document
        .querySelector(".status-bar")
        ?.textContent?.includes("missing assets"),
    {},
    { timeout: 10000 },
  );
  await page.waitForTimeout(1200);
  assert.equal(
    await page.getByRole("button", { name: "Play", exact: true }).isEnabled(),
    true,
  );
  console.log(
    "PASS: deleted and restored assets invalidate caches and reload.",
  );
  await page.getByRole("button", { name: "scene", exact: true }).click();
  await page
    .getByLabel("Piece artwork", { exact: true })
    .selectOption("merida");
  await page.getByLabel("Seek composition", { exact: true }).fill("0");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, "editor.png") });
  await page.waitForTimeout(2200);
} finally {
  await app.close();
}
const reopened = await launch();
try {
  const page = await reopened.firstWindow();
  await page.waitForSelector(".recovery", { timeout: 30000 });
  assert.equal(
    await page
      .getByRole("button", { name: "Recover session", exact: true })
      .count(),
    1,
  );
  console.log("PASS: a fresh process offers the autosave recovery snapshot.");
} finally {
  await reopened.close();
}
