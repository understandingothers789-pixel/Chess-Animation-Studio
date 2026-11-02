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
