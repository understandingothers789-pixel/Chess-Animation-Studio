import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { appendMove, importFen } from "../src/core/chess";
import { blank, boardPalettes, camera } from "../src/core/project";
import { duration, segments } from "../src/core/timeline";
import { shotFromMove } from "../src/core/storyboard";
import { VideoJob } from "../desktop/export";
import { dataUrl } from "../desktop/files";
const dir = path.resolve("test-results/customization-render");
await fs.mkdir(dir, { recursive: true });
const imagePath = path.join(dir, "meme-reaction.svg");
await fs.writeFile(
  imagePath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">
  <rect width="300" height="100" fill="#00ff00"/>
  <rect x="100" width="100" height="100" fill="#ff0080"/>
  <text x="150" y="52" font-family="sans-serif" font-size="21" font-weight="bold" text-anchor="middle" fill="white">MY TURN</text>
</svg>`,
);
const p = appendMove(
  importFen(blank(), "7k/8/8/1q6/8/8/8/4KB2 w - - 0 1"),
  -1,
  "f1",
  "b5",
);
p.lead = 1.2;
Object.assign(p.style, boardPalettes.monochrome);
p.playerIntro = {
  enabled: true,
  name: "Example player",
  size: 0.42,
  transition: "zoom",
  asset: "portrait",
};
const portrait = path.join(dir, "test-portrait.svg");
await fs.writeFile(
  portrait,
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="160">
  <rect x="4" y="4" width="92" height="152" rx="18" fill="#00c9fd"/>
</svg>`,
);
p.tail = 0.1;
p.format = "square";
p.boardFX.intro = false;
p.boardFX.enabled = false;
p.cinematic.enabled = false;
p.moves[0].effect.cameras.square = { ...camera(), mode: "full", tilt: 0 };
p.moves[0].effect.preMoveMeme = { asset: "reaction", duration: 0.65 };
p.assets = [
  {
    id: "reaction",
    name: "Sample reaction",
    kind: "image",
    path: imagePath,
    source: "Test fixture",
    guidance: "",
  },
];
p.assets.push({
  ...p.assets[0],
  id: "portrait",
  path: portrait,
  name: "Example player image",
});
const shot = shotFromMove(p, p.moves[0].id);
const intro = shotFromMove(p, "@start", "position-hold");
intro.showPlayerIntro = true;
p.storyboard.shots = [intro, shot];
const port = "5198";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
  { stdio: "pipe" },
);
const origin = `http://127.0.0.1:${port}`;
const size = 320;
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
  const page = await browser.newPage();
  await page.addInitScript("globalThis.__name=fn=>fn");
  await page.route("**/validation.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto(origin + "/validation.html");
  await page.evaluate(
    async ({ p, urls }) => {
      const { Scene } = await import("/src/render/Scene.ts" as string);
      const scene = new Scene(document.createElement("canvas"));
      await scene.ready;
      await scene.prepareAssets(urls);
      Object.assign(window, { scene, project: p });
    },
    {
      p,
      urls: {
        reaction: await dataUrl(p.assets[0]),
        portrait: await dataUrl(p.assets[1]),
      },
    },
  );
  const frame = async (
    time: number,
    mode: "source" | "storyboard" = "source",
    orientation = "white",
  ) =>
    Buffer.from(
      await page.evaluate(
        ({ time, mode, size, orientation }) => {
          const w = window as any;
          const p =
            orientation === "black"
              ? { ...w.project, style: { ...w.project.style, orientation } }
              : w.project;
          w.scene.render(p, time, size, size, "square", mode);
          let text = "";
          for (const byte of w.scene.rgba()) text += String.fromCharCode(byte);
          return btoa(text);
        },
        { time, mode, size, orientation },
      ),
      "base64",
    );
  const boardPixel = (x: number, y: number) => [
    Math.floor(size / 2 + (x * size) / 9.3),
    Math.floor(size / 2 - (y * size) / 9.3),
  ];
  const pink = (rgba: Buffer, x: number, y: number) => {
    const [col, row] = boardPixel(x, y);
    const offset = (row * size + col) * 4;
    return rgba[offset] > 190 && rgba[offset + 1] < 70 && rgba[offset + 2] > 55;
  };
  const blueCenter = (rgba: Buffer) => {
    const [col, row] = boardPixel(0, 0);
    const offset = (row * size + col) * 4;
    return (
      rgba[offset] < 65 && rgba[offset + 1] > 140 && rgba[offset + 2] > 190
    );
  };
  assert.equal(blueCenter(await frame(0)), false, "Portrait fades in");
  assert.ok(
    blueCenter(await frame(0.6)),
    "Portrait appears at the board center",
  );
  assert.ok(
    blueCenter(await frame(0.6, "storyboard")),
    "Position hold shows the same portrait",
  );
  assert.equal(
    blueCenter(await frame(p.lead)),
    false,
    "Portrait disappears before the first move",
  );
  const depart = segments(p)[0].depart;
  const memeTime = p.lead + 0.2;
  const active = await frame(memeTime);
  for (const x of [1.08, 1.92])
    for (const y of [-3.92, -3.08])
      assert.ok(
        pink(active, x, y),
        "The center crop fills all four corners of f1",
      );
  assert.equal(pink(active, 2.1, -3.5), false, "The effect stays inside f1");
  assert.ok(pink(await frame(intro.duration + 0.2, "storyboard"), 1.2, -3.7));
  assert.ok(pink(await frame(memeTime, "source", "black"), -1.2, 3.7));
  assert.equal(pink(await frame(depart), 1.2, -3.7), false);
  assert.deepEqual(
    await frame(memeTime),
    active,
    "Seeking backward restores the image",
  );
  const destination = path.join(dir, "player-intro-and-square-meme.mp4");
  const job = new VideoJob(
    p,
    {
      format: "square",
      mode: "source",
      start: 0,
      end: duration(p),
      width: size,
      height: size,
      fps: 24,
    },
    destination,
    "ffmpeg",
    false,
    () => {},
  );
  await job.start();
  try {
    for (let index = 0; index < job.frames; index++)
      await job.frame(await frame(index / 24), index);
    await job.finish();
  } catch (error) {
    await job.cancel();
    throw error;
  }
  const decoded = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      destination,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-",
    ],
    { maxBuffer: 80 * 1024 * 1024 },
  );
  const decodedFrame = (index: number) =>
    decoded.subarray(index * size * size * 4, (index + 1) * size * size * 4);
  assert.ok(blueCenter(decodedFrame(14)), "MP4 contains the player portrait");
  assert.equal(blueCenter(decodedFrame(Math.ceil(p.lead * 24))), false);
  assert.ok(pink(decodedFrame(Math.round(memeTime * 24)), 1.2, -3.7));
  assert.equal(pink(decodedFrame(Math.ceil(depart * 24)), 1.2, -3.7), false);
  console.log(
    "PASS: centered player intro, storyboard, decoded MP4, exact-square crop, and backward seeking.",
  );
} finally {
  await browser?.close();
  server.kill();
}
