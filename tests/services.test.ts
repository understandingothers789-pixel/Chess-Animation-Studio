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
import { VideoJob } from "../desktop/export";
import { sample, importPgn } from "../src/core/chess";
import { blank } from "../src/core/project";
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
  expect(JSON.parse(await fs.readFile(f, "utf8")).assets[0].path).toBe(
    "tone.wav",
  );
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
