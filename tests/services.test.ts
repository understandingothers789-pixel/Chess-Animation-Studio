import { it, expect } from "vitest";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  atomic,
  readProject,
  writeProject,
  readPack,
  collectProject,
} from "../desktop/files";
import { analyze } from "../desktop/analysis";
import {
  introDuration,
  introSourceFrame,
  prepareIntroVideo,
} from "../desktop/introVideo";
import { VideoJob } from "../desktop/export";
import { sample, importPgn } from "../src/core/chess";
import { blank, parseProject } from "../src/core/project";
import { badge } from "../src/core/timeline";
const temp = () => fs.mkdtemp(path.join(os.tmpdir(), "studio-test-"));
it("writes and reads projects atomically, preserving relative references", async () => {
  const dir = await temp(),
    p = sample();
  p.assets = [
    {
      id: "a",
      name: "tone",
      kind: "audio",
      path: path.join(dir, "tone.wav"),
      source: "source",
      guidance: "guidance",
    },
  ];
  const f = path.join(dir, "p.castudio");
  await writeProject(f, p);
  const saved = JSON.parse(await fs.readFile(f, "utf8"));
  expect(saved.assets[0].path).toBe("tone.wav");
  expect(saved.defaults).toMatchObject({
    easing: "smooth",
    travelEasing: "ease-out",
  });
  expect((await readProject(f)).defaults.easing).toBe("ease-out");
  expect((await readProject(f)).assets[0].path).toBe(p.assets[0].path);
  expect((await fs.readdir(dir)).some((x) => x.includes(".tmp-"))).toBe(false);
});
it("imports local badge provenance and rejects pack traversal", async () => {
  const dir = await temp();
  await fs.writeFile(
    path.join(dir, "badge.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  const manifest = path.join(dir, "pack.json");
  await fs.writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      source: "local creator",
      guidance: "local use",
      badges: { book: "badge.svg" },
    }),
  );
  const pack = await readPack(manifest);
  expect(pack.assets[0].source).toBe("local creator");
  await fs.writeFile(
    manifest,
    JSON.stringify({ version: 1, badges: { book: "../outside.svg" } }),
  );
  await expect(readPack(manifest)).rejects.toThrow();
});
it("caches Masters statistics separately from thresholds and handles cutoff/unavailability", async () => {
  const p = importPgn(blank(), "1. e4 e5"),
    dir = await temp(),
    real = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return new Response(
      JSON.stringify({
        white: 100,
        draws: 100,
        black: 100,
        moves: [{ uci: "e2e4", white: 20, draws: 20, black: 20 }],
      }),
      { status: 200 },
    );
  };
  try {
    const run = () =>
      analyze(
        p,
        "book",
        [0, 1],
        dir,
        "",
        "",
        new AbortController().signal,
        () => {},
      );
    p.analysis.cutoff = 1;
    const a = await run();
    expect(a[p.moves[0].id].book?.state).toBe("found");
    expect(a[p.moves[1].id].book?.state).toBe("not-analyzed");
    p.analysis.minGames = 200;
    expect((await run())[p.moves[0].id].book?.state).toBe("not-found");
    expect(requests).toBe(1);
    globalThis.fetch = async () => new Response("", { status: 401 });
    const bad = await analyze(
      p,
      "book",
      [0],
      await temp(),
      "",
      "",
      new AbortController().signal,
      () => {},
    );
    expect(bad[p.moves[0].id].book?.state).toBe("unavailable");
  } finally {
    globalThis.fetch = real;
  }
});
it.runIf(process.platform !== "win32")(
  "preserves completed reviews if the engine exits mid-game",
  async () => {
    const dir = await temp();
    const executable = path.join(dir, "fixture-engine");
    await fs.writeFile(
      executable,
      String.raw`#!/usr/bin/env node
const io = require("node:readline").createInterface({ input: process.stdin });
let searches = 0;
io.on("line", (line) => {
  if (line === "uci") console.log("id name Fixture UCI\nuciok");
  if (line === "isready") console.log("readyok");
  if (line.startsWith("go ") && searches++ === 0)
    console.log("info depth 6 score cp 25 pv e2e4 e7e5\nbestmove e2e4");
  else if (line.startsWith("go ")) process.exit(1);
});
`,
      { mode: 0o700 },
    );
    const p = importPgn(blank(), "1. e4 e5");
    const result = await analyze(
      p,
      "engine",
      [0, 1],
      dir,
      executable,
      "",
      new AbortController().signal,
      () => {},
    );
    expect(result[p.moves[0].id].engine).toMatchObject({
      state: "done",
      score: 25,
    });
    expect(result[p.moves[1].id].engine?.state).toBe("unavailable");
  },
);

it.runIf(
  existsSync(
    process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish",
  ),
)("runs local Stockfish and preserves manual badge preference", async () => {
  const executable =
    process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish";
  if (!(await fs.stat(executable).catch(() => null))) return;
  const p = importPgn(blank(), "1. e4");
  p.analysis.depth = 5;
  p.analysis.milliseconds = 200;
  p.moves[0].effect.badge.manual = "brilliant";
  const r = await analyze(
    p,
    "engine",
    [0],
    await temp(),
    executable,
    "",
    new AbortController().signal,
    () => {},
  );
  expect(r[p.moves[0].id].engine?.state).toBe("done");
  expect(p.moves[0].effect.badge.manual).toBe("brilliant");
});
it.runIf(
  existsSync(
    process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish",
  ),
)(
  "marks sound Stockfish sacrifices while skipping material blunders and trades",
  async () => {
    const executable =
      process.env.STOCKFISH_PATH ?? "/workspace/tools/usr/games/stockfish";
    const dir = await temp();
    const review = async (p: ReturnType<typeof blank>, indices: number[]) => {
      p.analysis.threads = 1;
      p.analysis.milliseconds = 3000;
      const result = await analyze(
        p,
        "engine",
        indices,
        dir,
        executable,
        "",
        new AbortController().signal,
        () => {},
      );
      for (const i of indices) p.moves[i].analysis = result[p.moves[i].id];
    };

    const opera = sample();
    const queen = opera.moves.findIndex((m) => m.san === "Qb8+");
    await review(opera, [queen]);
    expect(opera.moves[queen].analysis.engine).toMatchObject({
      label: "brilliant",
      sacrifice: { reply: "Nxb8", continuation: "Rd8#", material: 9 },
    });
    opera.moves[queen].analysis.book = {
      state: "found",
      games: 10,
      frequency: 0.5,
      message: "Opening badge",
    };
    const move = parseProject(opera).moves[queen];
    expect(badge(move)).toBe("brilliant");
    move.effect.badge.manual = "mistake";
    expect(badge(move)).toBe("mistake");
    move.effect.badge.manual = "none";
    expect(badge(move)).toBeNull();

    for (const pgn of [
      '[FEN "7k/8/3p4/2Q5/8/8/8/K7 w - - 0 1"] 1. Qe5+',
      '[FEN "3q2rk/8/8/8/8/8/8/K2Q4 w - - 0 1"] 1. Qxd8',
    ]) {
      const p = importPgn(blank(), pgn);
      await review(p, [0]);
      expect(p.moves[0].analysis.engine?.state).toBe("done");
      expect(p.moves[0].analysis.engine?.label).not.toBe("brilliant");
      expect(p.moves[0].analysis.engine?.sacrifice).toBeUndefined();
    }
  },
);
it("exports measured audio offset and trim, and cleans up cancelled jobs", async () => {
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
  try {
    execFileSync(ffmpeg, ["-version"], { stdio: "ignore" });
  } catch {
    throw Error("FFmpeg is required for service export validation.");
  }
  const dir = await temp(),
    sound = path.join(dir, "pulse.wav");
  execFileSync(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=0.08",
    "-af",
    "adelay=500,apad=whole_dur=1.1",
    "-y",
    sound,
  ]);
  const p = blank();
  p.audio.automatic = false;
  p.music = {
    ...p.music,
    asset: "pulse",
    trimStart: 0.2,
    trimEnd: 1.1,
    offset: 0.4,
    fadeIn: 0,
    fadeOut: 0,
    volume: 1,
    volumePoints: Array.from({ length: 1000 }, (_, i) => ({
      time: i / 1000,
      value: i % 2 ? 1 : 0.9,
    })),
  };
  p.assets = [
    {
      id: "pulse",
      name: "Pulse",
      path: sound,
      kind: "audio",
      source: "test",
      guidance: "",
    },
  ];
  const out = path.join(dir, "output.mp4"),
    job = new VideoJob(
      p,
      {
        format: "landscape",
        start: 0,
        end: 1,
        width: 160,
        height: 90,
        fps: 10,
      },
      out,
      ffmpeg,
      false,
      () => {},
    );
  await job.start();
  const frame = new Uint8Array(160 * 90 * 4);
  for (let i = 0; i < 10; i++) await job.frame(frame, i);
  await job.finish();
  const pcm = execFileSync(ffmpeg, [
    "-v",
    "error",
    "-i",
    out,
    "-f",
    "f32le",
    "-ac",
    "1",
    "-ar",
    "48000",
    "pipe:1",
  ]);
  const samples = new Float32Array(
    pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength),
  );
  const rms = (at: number) => {
    let sum = 0;
    for (
      let i = Math.floor(at * 48000);
      i < Math.floor((at + 0.04) * 48000);
      i++
    )
      sum += samples[i] ** 2;
    return Math.sqrt(sum / (0.04 * 48000));
  };
  expect(rms(0.72)).toBeGreaterThan(0.01);
  expect(rms(0.3)).toBeLessThan(0.002);
  const cancelled = new VideoJob(
    p,
    { format: "landscape", start: 0, end: 1, width: 160, height: 90, fps: 10 },
    path.join(dir, "cancelled.mp4"),
    ffmpeg,
    false,
    () => {},
  );
  await cancelled.start();
  await cancelled.cancel();
  expect(
    (await fs.readdir(dir)).some((f) => f.startsWith(".chess-studio-export")),
  ).toBe(false);
}, 20000);

it("preserves an existing output and removes temporary files after renderer/encoder failures", async () => {
  const dir = await temp(),
    out = path.join(dir, "existing.mp4");
  await fs.writeFile(out, "existing output");
  const options = {
    format: "landscape" as const,
    start: 0,
    end: 1,
    width: 160,
    height: 90,
    fps: 10,
  };
  for (const encoder of [
    process.env.FFMPEG_PATH ?? "ffmpeg",
    path.join(dir, "missing-encoder"),
  ]) {
    const phases: string[] = [];
    const job = new VideoJob(blank(), options, out, encoder, false, (p) =>
      phases.push(p.phase),
    );
    try {
      await job.start();
      if (encoder.includes("missing"))
        await new Promise((r) => setTimeout(r, 50));
      await expect(job.finish("Asset preparation failed")).rejects.toThrow();
      expect(await fs.readFile(out, "utf8")).toBe("existing output");
      expect(phases).not.toContain("Complete");
    } finally {
      await job.clean();
    }
    expect(
      (await fs.readdir(dir)).some((f) => f.startsWith(".chess-studio-export")),
    ).toBe(false);
  }
});

it("cancels during asynchronous encoder startup without leaving late temporary files", async () => {
  const dir = await temp();
  const job = new VideoJob(
    blank(),
    { format: "landscape", start: 0, end: 1, width: 160, height: 90, fps: 10 },
    path.join(dir, "cancel.mp4"),
    process.env.FFMPEG_PATH ?? "ffmpeg",
    false,
    () => {},
  );
  const started = job.start(),
    rejected = expect(started).rejects.toThrow(/cancelled/);
  await job.cancel();
  await rejected;
  await job.clean();
  expect(await fs.readdir(dir)).toEqual([]);
});

it("exports a large audio mix with reused move sounds and muted cues", async () => {
  const dir = await temp();
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
  const project = blank();
  project.audio.chess = 0;
  project.cues = Array.from({ length: 156 }, (_, i) => ({
    id: `cue-${i}`,
    move: null,
    asset: null,
    time: 0.15 + 0.003 * i,
    volume: 0.4,
    kind: "move",
    bus: i % 4 === 0 ? "chess" : "effects",
  }));
  const out = path.join(dir, "many-cues.mp4");
  const job = new VideoJob(
    project,
    { format: "landscape", start: 0, end: 1, width: 16, height: 16, fps: 5 },
    out,
    ffmpeg,
    false,
    () => {},
  );
  await job.start();
  for (let i = 0; i < job.frames; i++)
    await job.frame(new Uint8Array(16 * 16 * 4), i);
  await job.finish();
  const pcm = execFileSync(ffmpeg, [
    "-v",
    "error",
    "-i",
    out,
    "-vn",
    "-f",
    "s16le",
    "-ac",
    "1",
    "-ar",
    "48000",
    "pipe:1",
  ]);
  const peak = (from: number, to: number) => {
    let result = 0;
    for (let sample = from * 48000; sample < to * 48000; sample++)
      result = Math.max(result, Math.abs(pcm.readInt16LE(sample * 2)));
    return result;
  };
  expect(peak(0, 0.1)).toBeLessThan(10);
  expect(peak(0.22, 0.28)).toBeGreaterThan(500);
}, 20000);

it("rejects an acknowledged frame after cancellation instead of reporting late progress", async () => {
  const phases: string[] = [];
  const job = new VideoJob(
    blank(),
    { format: "landscape", start: 0, end: 1, width: 2, height: 2, fps: 1 },
    "unused.mp4",
    "unused",
    false,
    (p) => phases.push(p.phase),
  );
  let acknowledge!: (error?: Error) => void;
  Object.assign(job, {
    child: {
      stdin: {
        write(_bytes: unknown, done: (error?: Error) => void) {
          acknowledge = done;
        },
      },
      kill() {},
    },
  });
  const pending = job.frame(new Uint8Array(16), 0),
    rejected = expect(pending).rejects.toThrow(/cancelled/);
  await job.cancel();
  acknowledge();
  await rejected;
  expect(phases).toEqual(["Cancelled"]);
});

it("treats final rename as an irreversible commit and preserves destinations when it fails", async () => {
  const { vi } = await import("vitest");
  const dir = await temp(),
    out = path.join(dir, "output.mp4");
  const realRename = fs.rename.bind(fs);
  const options = {
    format: "landscape" as const,
    start: 0,
    end: 1,
    width: 16,
    height: 16,
    fps: 1,
  };
  const phases: string[] = [];
  const job = new VideoJob(
    blank(),
    options,
    out,
    process.env.FFMPEG_PATH ?? "ffmpeg",
    false,
    (p) => phases.push(p.phase),
  );
  await job.start();
  await job.frame(new Uint8Array(16 * 16 * 4), 0);
  let entered!: () => void, proceed!: () => void;
  const barrier = new Promise<void>((r) => (entered = r)),
    gate = new Promise<void>((r) => (proceed = r));
  const spy = vi
    .spyOn(fs, "rename")
    .mockImplementationOnce(async (from, to) => {
      entered();
      await gate;
      return realRename(from, to);
    });
  try {
    const finish = job.finish();
    await barrier;
    const cancel = job.cancel();
    proceed();
    await Promise.all([finish, cancel]);
    expect(phases.at(-1)).toBe("Complete");
    expect(phases).not.toContain("Cancelled");
  } finally {
    spy.mockRestore();
    await job.clean();
  }
  await fs.writeFile(out, "keep existing");
  const failed = new VideoJob(
    blank(),
    options,
    out,
    process.env.FFMPEG_PATH ?? "ffmpeg",
    false,
    () => {},
  );
  await failed.start();
  await failed.frame(new Uint8Array(16 * 16 * 4), 0);
  const failure = vi
    .spyOn(fs, "rename")
    .mockRejectedValueOnce(Error("final rename failed"));
  try {
    await expect(failed.finish()).rejects.toThrow("final rename failed");
  } finally {
    failure.mockRestore();
    await failed.clean();
  }
  expect(await fs.readFile(out, "utf8")).toBe("keep existing");
  expect(
    (await fs.readdir(dir)).some((f) => f.startsWith(".chess-studio-export")),
  ).toBe(false);
});

it.runIf(
  Boolean(process.env.STOCKFISH_PATH && existsSync(process.env.STOCKFISH_PATH)),
)(
  "keeps a slower winning mate out of the centipawn mistake threshold",
  async () => {
    const p = importPgn(
      blank(),
      '[FEN "7k/8/5K2/8/8/8/5Q2/8 w - - 0 1"] 1. Kg6',
    );
    p.analysis.depth = 14;
    p.analysis.milliseconds = 700;
    const dir = await temp();
    try {
      const review = await analyze(
        p,
        "engine",
        [0],
        dir,
        process.env.STOCKFISH_PATH!,
        "",
        new AbortController().signal,
        () => {},
      );
      const move = p.moves[0];
      move.analysis = review[move.id];
      expect(move.analysis.engine).toMatchObject({
        state: "done",
        mate: 3,
        bestMate: 2,
        loss: 0,
        label: "good",
      });
      expect(badge(move)).toBe("good");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);

it("renders and collects a re-editable video intro with its original source", async () => {
  const dir = await temp();
  const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
  const source = path.join(dir, "source video.mp4");
  const output = path.join(dir, "intro.jpg");
  try {
    execFileSync(ffmpeg, [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=256x144:rate=24:duration=2",
      "-pix_fmt",
      "yuv420p",
      "-y",
      source,
    ]);
    const duration = await introDuration(ffmpeg, source);
    expect(duration).toBeCloseTo(2, 1);
    const trim = { start: 0.5, x: 0.9, y: 0.5 };
    expect(await introSourceFrame(ffmpeg, source, 0.5)).toMatch(
      /^data:image\/jpeg;base64,\/9j/,
    );
    await prepareIntroVideo(ffmpeg, source, output, trim);
    const p = blank();
    p.assets.push({
      id: "opener",
      name: "Opener",
      kind: "filmstrip",
      path: output,
      source: "local",
      guidance: "",
      videoSource: source,
      videoTrim: trim,
      videoDuration: duration,
    });
    const collected = await collectProject(p, path.join(dir, "collected"));
    const stored = JSON.parse(await fs.readFile(collected.path, "utf8"))
      .assets[0];
    expect(path.isAbsolute(stored.videoSource)).toBe(false);
    const reopened = await readProject(collected.path);
    expect(reopened.assets[0].videoTrim).toEqual(trim);
    expect(reopened.assets[0].videoSource).not.toBe(source);
    expect(await fs.readFile(reopened.assets[0].videoSource!)).toEqual(
      await fs.readFile(source),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 15000);
