import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { blank, effect } from "../src/core/project";
import { importPgn, buildGame } from "../src/core/chess";
import {
  afterEffectWindow,
  duration,
  segments,
  evaluate,
} from "../src/core/timeline";
import { validateExport } from "../src/core/exportOptions";
import { VideoJob } from "../desktop/export";
const dir = path.resolve("test-results/customization-render");
await fs.mkdir(dir, { recursive: true });
const p = importPgn(blank(), "1. Nf3");
p.style.pieceSet = "sculpted";
p.lead = 0.2;
p.tail = 0;
p.boardFX.intro = false;
p.moves[0].effect = effect("somersault");
const e = p.moves[0].effect;
e.duration = 1;
e.axis = "x";
e.after = { kind: "size-pulse", delay: 0.7, duration: 0.8, strength: 0.44 };
e.landing = 0.8;
e.hold = 0;
e.sizeProfile = "smooth";
e.scale = 1.5;
e.sizeReturn = 0.55;
e.jam.enabled = true;
e.jam.rhythm = "swell";
e.jam.start = "landing";
e.jam.duration = 1.2;
e.jam.roll = 0;
e.jam.shake = 0;
p.beats = [
  { id: "landing", time: 1, enabled: true, accent: true },
  { id: "second", time: 1.5, enabled: true, accent: false },
];
e.landingBeat = "landing";
p.audio.automatic = false;
const end = duration(p),
  audio = path.join(dir, "beats.wav");
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  `aevalsrc=exprs='0.08*sin(2*PI*440*t)+0.6*sin(2*PI*880*t)*(between(t,1,1.08)+between(t,1.5,1.58))':s=48000:d=${end}`,
  "-ar",
  "48000",
  audio,
]);
p.music.asset = "tone";
p.music.offset = 0;
p.music.volume = 0.5;
p.music.fadeIn = 0;
p.music.fadeOut = 0;
p.music.sourceDuration = end;
p.assets = [
  {
    id: "tone",
    kind: "audio",
    path: audio,
    name: "Validation tone",
    source: "generated",
    guidance: "Validation audio",
  },
];
const game = buildGame(p),
  mid = evaluate(p, 0.6, game, "landscape"),
  land = evaluate(p, 1, game, "landscape");
const moved = game.steps[0].pieceId;
const after = afterEffectWindow(e, segments(p)[0])!;
const sizeAt = (time: number) =>
  evaluate(p, time, game, "landscape").pieces.find(
    (piece) => piece.id === moved,
  )!.scale;
assert.ok(sizeAt(0.56) > 1.45);
assert.ok(Math.abs(sizeAt(29 / 30) - 1) < 0.01);
assert.equal(sizeAt(1), 1);
assert.equal(sizeAt(1.2), 1);
assert.ok(sizeAt((after.start + after.end) / 2) > 1.4);
assert.equal(sizeAt(after.end), 1);
assert.ok(Math.abs(mid.pieces.find((v) => v.id === moved)!.rx) > 0.2);
assert.ok(
  Math.abs(Math.sin(land.pieces.find((v) => v.id === moved)!.rx)) < 0.001,
);
assert.ok(
  evaluate(p, 1.08, game, "landscape").camera.zoom !==
    evaluate(p, 1.4, game, "landscape").camera.zoom,
);
assert.equal(segments(p)[0].land, 1);
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5197"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5197")).ok) break;
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
  const page = await browser.newPage();
  await page.addInitScript("globalThis.__name=fn=>fn");
  await page.route("**/validation.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto("http://127.0.0.1:5197/validation.html");
  await page.evaluate(async (p) => {
    const { Scene } = await import("/src/render/Scene.ts" as string);
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const scene = new Scene(canvas);
    await scene.ready;
    Object.assign(window, { scene, project: p });
  }, p);
  for (const [preset, set] of [
    ["spin", "merida"],
    ["flip", "neo"],
    ["dramatic", "cburnett"],
    ["somersault", "merida"],
  ] as const) {
    const turning = structuredClone(p);
    turning.style.pieceSet = set;
    turning.moves[0].effect = effect(preset);
    if (preset === "somersault") turning.moves[0].effect.axis = "x";
    const dir = turning.moves[0].effect.axis === "x" ? "rx" : "ry";
    const game = buildGame(turning);
    const clip = segments(turning)[0];
    const turn = Array.from({ length: 180 }, (_, i) => {
      const time = clip.depart + ((clip.land - clip.depart) * i) / 180;
      const piece = evaluate(turning, time, game).pieces.find(
        (item) => item.id === game.steps[0].pieceId,
      )!;
      return { time, error: Math.abs(piece[dir] - Math.PI / 2) };
    }).sort((a, b) => a.error - b.error)[0];
    assert.ok(turn.error < 0.06);
    const rendered = await page.evaluate(
      ({ turning, turn, clip }) => {
        const { scene } = window as any;
        const thin = {
          ...turning,
          style: { ...turning.style, solidPieceSides: false },
        };
        const capture = (project: typeof turning, time: number) => {
          scene.render(project, time, 320, 180, "landscape");
          return scene.renderer.domElement.toDataURL();
        };
        const edge = capture(turning, turn.time);
        return {
          edgeChanged: edge !== capture(thin, turn.time),
          restMatches:
            capture(turning, clip.depart) === capture(thin, clip.depart),
          seekMatches: edge === capture(turning, turn.time),
        };
      },
      { turning, turn, clip },
    );
    assert.deepEqual(
      rendered,
      { edgeChanged: true, restMatches: true, seekMatches: true },
      `${preset} in ${set}`,
    );
  }
  console.log(
    "PASS: solid sides during X/Y turns across all illustrated artwork sets.",
  );
  const options = validateExport(p, {
    format: "landscape",
    mode: "source",
    start: 0,
    end,
    width: 320,
    height: 180,
    fps: 30,
  });
  const file = path.join(dir, "piece-flip-beat-zoom.mp4"),
    job = new VideoJob(p, options, file, "ffmpeg", false, () => {});
  await job.start();
  const originals: Buffer[] = [];
  try {
    for (let i = 0; i < job.frames; i++) {
      const rgba = Buffer.from(
        await page.evaluate((time) => {
          const w = window as any;
          w.scene.render(w.project, time, 320, 180, "landscape", "source");
          const bytes = w.scene.rgba();
          let text = "";
          for (const b of bytes) text += String.fromCharCode(b);
          return btoa(text);
        }, i / 30),
        "base64",
      );
      originals.push(rgba);
      await job.frame(rgba, i);
    }
    await job.finish();
  } catch (error) {
    await job.cancel();
    throw error;
  }
  let darkPiecePixels = 0;
  const opening = originals[7];
  for (let offset = 0; offset < opening.length; offset += 4) {
    const red = opening[offset];
    const blue = opening[offset + 2];
    if (red < 100 && blue > red + 18) darkPiecePixels++;
  }
  assert.ok(
    darkPiecePixels > 150,
    "The 3D pieces must be visible in the rendered frame",
  );
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_streams", "-of", "json", file],
      { encoding: "utf8" },
    ),
  );
  const video = probe.streams.find((s: any) => s.codec_type === "video"),
    sound = probe.streams.find((s: any) => s.codec_type === "audio");
  assert.equal(video.codec_name, "h264");
  assert.equal(video.r_frame_rate, "30/1");
  assert.equal(+video.nb_frames, job.frames);
  assert.equal(sound.codec_name, "aac");
  assert.ok(Math.abs(+sound.duration - job.frames / 30) < 0.06);
  const decoded = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { maxBuffer: 100 * 1024 * 1024 },
  );
  assert.equal(decoded.length, job.frames * 320 * 180 * 4);
  let error = 0,
    count = 0;
  for (let frame = 0; frame < job.frames; frame++)
    for (let i = 0; i < originals[frame].length; i += 4) {
      error += Math.abs(
        decoded[frame * 320 * 180 * 4 + i] - originals[frame][i],
      );
      count++;
    }
  assert.ok(error / count < 15);
  const pcm = execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "48000", "-"],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  for (let start = 0; start + 9600 < pcm.length; start += 9600) {
    let energy = 0;
    for (let i = start; i < start + 9600; i += 2)
      energy += Math.abs(pcm.readInt16LE(i));
    assert.ok(energy > 4800, "Audio must remain present across beats");
  }
  const energyAt = (time: number) => {
    const start = Math.round(time * 48000) * 2;
    let sum = 0;
    for (let i = start; i < start + 1920; i += 2)
      sum += Math.abs(pcm.readInt16LE(i));
    return sum / 960;
  };
  assert.ok(
    energyAt(1.02) > energyAt(0.8) * 3,
    "First decoded audio beat must match the landing marker",
  );
  assert.ok(
    energyAt(1.52) > energyAt(1.3) * 3,
    "Second decoded audio beat must match the zoom marker",
  );
  await fs.writeFile(
    path.join(dir, "result.json"),
    JSON.stringify(
      {
        frames: job.frames,
        fps: 30,
        landing: 1,
        landingFrame: 30,
        pieceSizeAtLanding: sizeAt(1),
        pieceSizeBeforeLanding: sizeAt(29 / 30),
        afterEffectPeak: (after.start + after.end) / 2,
        darkPiecePixels,
        audioDuration: +sound.duration,
        decodedMeanError: error / count,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(dir, "flip-and-zoom.castudio"),
    JSON.stringify(p, null, 2),
  );
  console.log(
    `PASS: ${job.frames} decoded H.264 frames, continuous AAC, visible sculpted pieces, smooth size return, upright landing at frame 30, beat-driven zoom and an after-effect pulse.`,
  );
} finally {
  await browser?.close();
  server.kill();
}
