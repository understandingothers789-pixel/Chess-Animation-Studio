import { finishingFixtures } from "./finishing-fixtures";
/** Real shared-compositor → VideoJob → H.264/AAC verification, without an Electron display. */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { blank, type Format } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { annotation } from "../src/core/annotations";
import {
  shotFromMove,
  titleShot,
  compileStoryboard,
  shotCaption,
} from "../src/core/storyboard";
import { validateExport } from "../src/core/exportOptions";
import { VideoJob } from "../desktop/export";
import { writeProject, readProject } from "../desktop/files";
const composition = process.argv.includes("--composition");
const dir = path.resolve(
  process.env.STORY_TEST_DIR ??
    (composition
      ? "test-results/composition-render"
      : process.env.FINISHING_TEST || process.argv.includes("--finishing")
        ? "test-results/finishing-render"
        : "test-results/storyboard-render"),
);
await fs.mkdir(dir, { recursive: true });
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
execFileSync(ffmpeg, [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=3",
  "-ar",
  "48000",
  path.join(dir, "continuous.wav"),
]);
let p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6");
p.music.asset = "tone";
p.music.volume = 0.5;
p.music.fadeIn = 0;
p.music.fadeOut = 0;
p.music.sourceDuration = 3;
p.assets = [
  {
    id: "tone",
    kind: "audio",
    path: path.join(dir, "continuous.wav"),
    name: "continuous.wav",
    source: "test",
    guidance: "generated tone",
  },
];
p.audio.automatic = false;
p.storyboard.shots = [
  shotFromMove(p, p.moves[6].id),
  shotFromMove(p, p.moves[0].id),
  shotFromMove(p, p.moves[3].id, "position-hold", "after"),
  titleShot(p, "The end", 0.3),
];
for (const s of p.storyboard.shots) {
  s.duration = 0.3;
  s.preHold = 0;
  s.postHold = 0;
  s.annotations.forEach((a) => {
    a.start = 0;
    a.end = 0.3;
  });
}
p.storyboard.shots[0].annotations = [shotCaption(p, "Earlier caption", 0.3)];
if (process.env.FINISHING_TEST || process.argv.includes("--finishing")) {
  p.storyboard.shots[0].annotations = [
    shotCaption(
      p,
      "This bishop sacrifice looks completely losing until you notice the queen is trapped.",
      0.3,
    ),
  ];
  p.storyboard.shots[1].annotations = [
    shotCaption(p, "A thinking interval\nThen reveal the move", 0.3),
  ];
  p.storyboard.shots[1].annotations[0].font = "serif";
  p.storyboard.shots[2].annotations = [
    shotCaption(p, "Unicode café 中文 · 👨‍👩‍👦", 0.3),
  ];
  p.storyboard.beats = [{ id: "cut", time: 0.3, accent: true, enabled: true }];
}
if (composition) {
  p.storyboard.shots = [
    titleShot(p, "Find the winning move", 0.3),
    shotFromMove(p, p.moves[3].id, "position-hold", "before"),
    shotFromMove(p, p.moves[6].id),
    shotFromMove(p, p.moves[0].id),
  ];
  for (const [i, s] of p.storyboard.shots.entries()) {
    s.duration = 0.3;
    s.preHold = 0;
    s.postHold = 0;
    s.annotations = [
      shotCaption(
        p,
        [
          "Opening title",
          "Legal position hold",
          "Capture highlight",
          "Earlier move",
        ][i],
        0.3,
      ),
      { ...shotCaption(p, "White to move", 0.3), y: 0.8 },
    ];
    s.annotations.forEach((a) => {
      a.fade = 0;
      a.entrance = "none";
      a.exit = "none";
    });
    if (i === 1 || i === 3)
      s.transition = {
        type: i === 1 ? "cross-dissolve" : "fade-through-black",
        duration: 0.2,
        easing: "linear",
      };
  }
  p.storyboard.shots[2].musicDucking = {
    enabled: true,
    volume: 0.5,
    fadeDown: 0.03,
    fadeUp: 0.03,
  };
  p.storyboard.shots[2].annotations.push(
    ...(["arrow", "circle"] as const).map((kind) => ({
      ...annotation(kind, 0),
      from: kind === "arrow" ? "b5" : "c6",
      to: "c6",
      end: 0.3,
      entrance: "none" as const,
      exit: "none" as const,
    })),
  );
}
const order = p.moves.map((m) => m.id);
await writeProject(path.join(dir, "roundtrip.castudio"), p);
p = await readProject(path.join(dir, "roundtrip.castudio"));
assert.deepEqual(
  p.moves.map((m) => m.id),
  order,
);
const start = performance.now();
compileStoryboard(p);
const cold = performance.now() - start;
const cached = performance.now();
for (let i = 0; i < 10000; i++) compileStoryboard(p);
const hot = performance.now() - cached;
const port = process.env.STORY_TEST_PORT ?? "5187",
  origin = `http://127.0.0.1:${port}`,
  server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
    { stdio: "pipe" },
  );
let browser;
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
  const page = await browser.newPage();
  await page.addInitScript("globalThis.__name = fn => fn");
  await page.route("**/story-fixture.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    }),
  );
  await page.goto(origin + "/story-fixture.html");
  await page.evaluate(async (p) => {
    const { Scene } = await import("/src/render/Scene.ts" as string);
    const c = document.createElement("canvas");
    document.body.append(c);
    const s = new Scene(c);
    await s.ready;
    Object.assign(window, { storyScene: s, storyProject: p });
  }, p);
  if (composition) {
    const parity = await page.evaluate(() => {
      const w = window as any,
        s = w.storyScene,
        p = w.storyProject;
      const raw = (time: number, project = p) => {
        s.render(project, time, 320, 180, "landscape", "storyboard");
        return s.rgba();
      };
      raw(0.1);
      const lazyTextures = s.transitions.frames.length === 0;
      const direct = raw(0.4),
        textures = [...s.transitions.frames];
      raw(0.95);
      raw(0.1);
      const seek = raw(0.4);
      for (const time of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35]) raw(time);
      const sequential = raw(0.4);
      const reusedTextures =
        textures.length === 2 &&
        textures.every(
          (t: unknown, i: number) => t === s.transitions.frames[i],
        );
      const cut = structuredClone(p);
      cut.storyboard.shots.forEach((v: any) => (v.transition.type = "cut"));
      const a = raw(0.3 - 1e-7, cut),
        b = raw(0.4, cut);
      let different = 0,
        sequentialDifferent = 0,
        error = 0;
      const linear = (v: number) =>
        v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      const encode = (v: number) =>
        v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
      for (let i = 0; i < direct.length; i += 4)
        for (let ch = 0; ch < 3; ch++) {
          different += direct[i + ch] !== seek[i + ch] ? 1 : 0;
          sequentialDifferent += direct[i + ch] !== sequential[i + ch] ? 1 : 0;
          error += Math.abs(
            direct[i + ch] -
              255 *
                encode(
                  (linear(a[i + ch] / 255) + linear(b[i + ch] / 255)) * 0.5,
                ),
          );
        }
      const black = raw(1);
      let maxBlack = 0;
      for (let i = 0; i < black.length; i += 4)
        for (let c = 0; c < 3; c++) maxBlack = Math.max(maxBlack, black[i + c]);
      raw(0.4);
      const dissolve = s.renderer.domElement.toDataURL();
      raw(1);
      const fade = s.renderer.domElement.toDataURL();
      return {
        different,
        sequentialDifferent,
        lazyTextures,
        reusedTextures,
        meanError: error / (320 * 180 * 3),
        maxBlack,
        dissolve,
        fade,
      };
    });
    assert.equal(
      parity.different,
      0,
      "Direct seeking must equal out-of-order rendering",
    );
    assert.equal(
      parity.sequentialDifferent,
      0,
      "Sequential playback must equal direct rendering",
    );
    assert(
      parity.lazyTextures && parity.reusedTextures,
      "Transition textures must be allocated lazily and reused",
    );
    assert(
      parity.meanError < 2,
      `Linear-light whole-frame blending error ${parity.meanError}`,
    );
    assert(parity.maxBlack <= 1, "Fade-through-black midpoint");
    await fs.mkdir("docs/composition-033", { recursive: true });
    for (const name of ["dissolve", "fade"] as const)
      await fs.writeFile(
        `docs/composition-033/${name}-midpoint.png`,
        Buffer.from(parity[name].split(",")[1], "base64"),
      );
    await fs.writeFile(
      "docs/composition-033/frame-validation.json",
      JSON.stringify(
        {
          different: parity.different,
          sequentialDifferent: parity.sequentialDifferent,
          lazyTextures: parity.lazyTextures,
          reusedTextures: parity.reusedTextures,
          meanError: parity.meanError,
          maxBlack: parity.maxBlack,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: direct/out-of-order determinism, complete-frame linear-light dissolve and black midpoint",
      parity.meanError,
    );
  }
  const resizeCheck = await page.evaluate(async () => {
    const w = window as any,
      canvas = document.createElement("canvas"),
      fresh = new w.storyScene.constructor(canvas);
    await fresh.ready;
    w.storyScene.render(
      w.storyProject,
      0.15,
      640,
      360,
      "landscape",
      "storyboard",
    );
    w.storyScene.render(
      w.storyProject,
      1.05,
      240,
      135,
      "landscape",
      "storyboard",
    );
    const reused = w.storyScene.rgba(),
      reusedPng = w.storyScene.renderer.domElement.toDataURL();
    fresh.render(w.storyProject, 1.05, 240, 135, "landscape", "storyboard");
    const expected = fresh.rgba(),
      freshPng = canvas.toDataURL();
    let different = 0;
    for (let i = 0; i < expected.length; i++)
      if (expected[i] !== reused[i]) different++;
    fresh.dispose();
    return { different, reusedPng, freshPng };
  });
  await fs.writeFile(
    path.join(dir, "title-after-resize.png"),
    Buffer.from(resizeCheck.reusedPng.split(",")[1], "base64"),
  );
  await fs.writeFile(
    path.join(dir, "title-fresh.png"),
    Buffer.from(resizeCheck.freshPng.split(",")[1], "base64"),
  );
  assert.equal(
    resizeCheck.different,
    0,
    "A thumbnail resize must match a fresh renderer, without stale caption pixels",
  );
  let cases = 0,
    maxError = 0;
  const baseProject = p;
  const scenarios =
    !composition &&
    (process.env.FINISHING_TEST || process.argv.includes("--finishing"))
      ? finishingFixtures(p)
      : [
          {
            name: "storyboard",
            project: p,
            formats: (composition
              ? ["landscape", "vertical"]
              : [
                  "landscape",
                  "vertical",
                  "square",
                  "square-in-vertical",
                ]) as Format[],
            rates: [24, 30, 60],
          },
        ];
  for (const scenario of scenarios) {
    p = scenario.project;
    await fs.writeFile(
      path.join(dir, scenario.name + ".castudio"),
      JSON.stringify(p, null, 2),
    );
    await page.evaluate((p) => {
      (window as any).storyProject = p;
    }, p);
    for (const format of scenario.formats) {
      const [width, height] =
        format === "landscape"
          ? [160, 90]
          : format === "square"
            ? [90, 90]
            : [90, 160];
      for (const fps of scenario.rates) {
        const options = validateExport(p, {
          format,
          mode: "storyboard",
          start: 0,
          end: 1.2,
          width,
          height,
          fps,
        });
        const file = path.join(dir, `${scenario.name}-${format}-${fps}.mp4`),
          job = new VideoJob(p, options, file, ffmpeg, false, () => {});
        await job.start();
        const originals: Buffer[] = [];
        try {
          for (let i = 0; i < job.frames; i++) {
            const rgba = Buffer.from(
              await page.evaluate(
                ({ time, width, height, format }) => {
                  const w = window as any;
                  w.storyScene.render(
                    w.storyProject,
                    time,
                    width,
                    height,
                    format,
                    "storyboard",
                  );
                  const a = w.storyScene.rgba();
                  let s = "";
                  for (let i = 0; i < a.length; i++)
                    s += String.fromCharCode(a[i]);
                  return btoa(s);
                },
                { time: i / fps, width, height, format },
              ),
              "base64",
            );
            originals.push(rgba);
            await job.frame(rgba, i);
          }
          await job.finish();
        } catch (e) {
          await job.cancel();
          throw e;
        }
        const probe = JSON.parse(
          execFileSync(
            ffprobe,
            ["-v", "error", "-show_streams", "-of", "json", file],
            { encoding: "utf8" },
          ),
        );
        const v = probe.streams.find((s: any) => s.codec_type === "video"),
          a = probe.streams.find((s: any) => s.codec_type === "audio");
        assert.equal(v.nb_frames, String(job.frames));
        assert.equal(v.width, width);
        assert.equal(v.height, height);
        assert.equal(v.r_frame_rate, `${fps}/1`);
        assert.equal(a.codec_name, "aac");
        const decoded = execFileSync(
          ffmpeg,
          [
            "-v",
            "error",
            "-i",
            file,
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgba",
            "-an",
            "pipe:1",
          ],
          { maxBuffer: 30e6 },
        );
        assert.equal(decoded.length, job.frames * width * height * 4);
        for (let frame = 0; frame < job.frames; frame++) {
          let error = 0,
            n = 0;
          const expected = originals[frame],
            offset = frame * expected.length;
          for (let i = 0; i < expected.length; i += 16)
            for (let c = 0; c < 3; c++) {
              error += Math.abs(expected[i + c] - decoded[offset + i + c]);
              n++;
            }
          maxError = Math.max(maxError, error / n);
          assert.ok(
            error / n < 14,
            `Pixel parity ${format}/${fps} frame ${frame}: ${error / n}`,
          );
        }
        const pcm = execFileSync(ffmpeg, [
          "-v",
          "error",
          "-i",
          file,
          "-vn",
          "-f",
          "f32le",
          "-ac",
          "1",
          "-ar",
          "48000",
          "pipe:1",
        ]);
        for (const t of [0.05, 0.31, 0.61, 0.91, 1.1]) {
          let power = 0;
          for (let i = 0; i < 1000; i++)
            power += pcm.readFloatLE((Math.floor(t * 48000) + i) * 4) ** 2;
          assert.ok(Math.sqrt(power / 1000) > 0.02, `Continuous music at ${t}`);
        }
        cases++;
        console.log(
          `PASS: ${scenario.name}: ${format} ${fps} FPS, ${job.frames} actual H.264 frames + continuous AAC across cuts`,
        );
      }
    }
  }
  p = baseProject;
  // Exercise final fades and seeks using real AAC, including a soundtrack entirely outside output.
  const encodeAudio = async (
    project: typeof p,
    name: string,
    from = 0,
    to = 1.2,
  ) => {
    const file = path.join(dir, name + ".mp4");
    const job = new VideoJob(
      project,
      {
        mode: "storyboard",
        format: "landscape",
        start: from,
        end: to,
        width: 160,
        height: 90,
        fps: 30,
      },
      file,
      ffmpeg,
      false,
      () => {},
    );
    await job.start();
    for (let i = 0; i < job.frames; i++)
      await job.frame(new Uint8Array(160 * 90 * 4), i);
    await job.finish();
    return execFileSync(ffmpeg, [
      "-v",
      "error",
      "-i",
      file,
      "-vn",
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      "48000",
      "pipe:1",
    ]);
  };
  const rms = (pcm: Buffer, t: number) => {
    let power = 0;
    for (let i = 0; i < 800; i++)
      power += pcm.readFloatLE((Math.floor(t * 48000) + i) * 4) ** 2;
    return Math.sqrt(power / 800);
  };
  const fading = structuredClone(p);
  fading.music.fadeIn = 0.5;
  fading.music.fadeOut = 0.5;
  const fullAudio = await encodeAudio(fading, "fades");
  assert.ok(rms(fullAudio, 0.1) < rms(fullAudio, 0.6) * 0.4);
  assert.ok(rms(fullAudio, 1.1) < rms(fullAudio, 0.6) * 0.4);
  const seekAudio = await encodeAudio(fading, "fade-seek", 1, 1.2);
  assert.ok(
    Math.abs(rms(seekAudio, 0.04) - rms(fullAudio, 1.04)) < 0.008,
    "Seek fade retains output envelope",
  );
  const late = structuredClone(p);
  late.music.offset = 10;
  const silence = await encodeAudio(late, "late-track");
  assert.ok(rms(silence, 0.5) < 0.0001);
  const assetMissing = structuredClone(p);
  assetMissing.assets[0].path = path.join(dir, "not-present.wav");
  await assert.rejects(
    new VideoJob(
      assetMissing,
      {
        mode: "storyboard",
        format: "landscape",
        start: 0,
        end: 1.2,
        width: 160,
        height: 90,
        fps: 30,
      },
      path.join(dir, "missing.mp4"),
      ffmpeg,
      false,
      () => {},
    ).start(),
    /ENOENT/,
  );
  console.log(
    "PASS: real AAC fade-in/out, seek envelope parity, late soundtrack silence, missing asset rejection",
  );
  const cancelFile = path.join(dir, "cancelled.mp4"),
    cancel = new VideoJob(
      p,
      {
        mode: "storyboard",
        format: "landscape",
        start: 0,
        end: 1.2,
        width: 160,
        height: 90,
        fps: 30,
      },
      cancelFile,
      ffmpeg,
      false,
      () => {},
    );
  await cancel.start();
  await cancel.cancel();
  assert.equal(
    await fs.stat(cancelFile).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.equal(
    (await fs.readdir(dir)).some((s) => s.startsWith(".chess-studio-export-")),
    false,
  );
  const missing = structuredClone(p);
  missing.storyboard.shots.find((s) => s.source)!.source!.startMoveId =
    "missing";
  assert.throws(
    () =>
      validateExport(missing, {
        mode: "storyboard",
        format: "landscape",
        start: 0,
        end: 1,
      }),
    /missing/i,
  );
  const metrics = {
    cases,
    maxMeanAbsolutePixelError: maxError,
    coldCompileMs: cold,
    cached10000Ms: hot,
  };
  await fs.writeFile(
    path.join(dir, "metrics.json"),
    JSON.stringify(metrics, null, 2),
  );
  console.log(
    "PASS: project roundtrip, repair rejection, cancellation cleanup",
    metrics,
  );
} finally {
  await browser?.close();
  server.kill();
}
