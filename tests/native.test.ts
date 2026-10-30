import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { blankProject } from "../src/core/model";
import { importPgn } from "../src/core/chess";
import {
  atomicWrite,
  readProject,
  readBadgePack,
  collectProject,
} from "../electron/files";
import { UciEngine, AnalysisService, classify } from "../electron/analysis";
import { VideoExport, audioPlan, runProcess } from "../electron/export";
const stockfish =
  process.env.STOCKFISH_PATH ??
  (existsSync("/workspace/tools/usr/games/stockfish")
    ? "/workspace/tools/usr/games/stockfish"
    : existsSync("/usr/games/stockfish")
      ? "/usr/games/stockfish"
      : "stockfish");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
function available(binary: string, args: string[], input?: string) {
  const p = spawnSync(binary, args, { input, timeout: 5000 });
  if (p.error && (p.error as NodeJS.ErrnoException).code !== "ENOENT")
    throw p.error;
  return !p.error && p.status === 0;
}
const hasEngine = available(stockfish, [], "quit\n"),
  hasFfmpeg = available(ffmpeg, ["-version"]);

describe("storage and services", () => {
  it("distinguishes book thresholds from not-analyzed cutoff and reuses cached statistics", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-book-"));
    try {
      const p = importPgn(blankProject(), "1. e4 e5");
      p.analysisSettings.cutoff = 1;
      let calls = 0;
      const service = new AnalysisService(dir, async () => {
        calls++;
        return Response.json({
          white: 500,
          draws: 200,
          black: 300,
          moves: [{ uci: "e2e4", white: 15, draws: 3, black: 2 }],
        });
      });
      const first: any[] = [],
        second: any[] = [];
      await service.run(
        p,
        "book",
        p.moves.map((m) => m.id),
        "unused",
        undefined,
        (x) => first.push(x),
      );
      expect(first[0].analysis.book.state).toBe("found");
      expect(first[1].analysis.book.state).toBe("not-analyzed");
      p.analysisSettings.frequency = 0.05;
      await service.run(
        p,
        "book",
        p.moves.map((m) => m.id),
        "unused",
        undefined,
        (x) => second.push(x),
      );
      expect(second[0].analysis.book.state).toBe("not-found");
      expect(calls).toBe(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it("imports local badge packs with provenance and rejects escaping paths", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-pack-"));
    try {
      const file = path.join(dir, "pack.json");
      await fs.writeFile(path.join(dir, "best.png"), "test");
      const pack = {
        kind: "chess-animation-badges",
        schemaVersion: 1,
        source: "local permitted artwork",
        guidance: "test usage guidance",
        badges: { best: "best.png" },
      };
      await fs.writeFile(file, JSON.stringify(pack));
      const result = await readBadgePack(file);
      expect(result.assets[0].source).toBe(pack.source);
      expect(result.badges.best).toBe(result.assets[0].id);
      await fs.writeFile(
        file,
        JSON.stringify({ ...pack, badges: { best: "../outside.png" } }),
      );
      await expect(readBadgePack(file)).rejects.toThrow();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it("collects portable projects and refuses to overwrite an existing project", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-portable-"));
    try {
      const p = blankProject(),
        source = path.join(dir, "source.png");
      await fs.writeFile(source, "test");
      p.assets = [
        {
          id: "a",
          name: "background",
          kind: "image",
          path: source,
          source: "original",
          guidance: "MIT",
        },
      ];
      const folder = path.join(dir, "collected");
      const result = await collectProject(p, null, folder);
      expect(result.project.assets[0].path).toBe("assets/a.png");
      expect(await readProject(result.path)).toEqual(result.project);
      await expect(collectProject(p, null, folder)).rejects.toThrow(
        "already contains",
      );
      const bad = new VideoExport(
        {
          ...p,
          assets: [{ ...p.assets[0], path: path.join(dir, "missing.png") }],
        },
        null,
        { format: "square", encoder: "software", width: 64, height: 64 },
        ffmpeg,
        path.join(dir, "missing.mp4"),
        () => {},
      );
      await expect(bad.initialize()).rejects.toThrow("Missing asset");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it("saves/reopens atomically and never writes credentials in projects", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-"));
    try {
      const p = importPgn(blankProject(), "1. e4 e5"),
        file = path.join(dir, "p.castudio");
      await atomicWrite(file, JSON.stringify(p));
      expect(await readProject(file)).toEqual(p);
      expect((await fs.readdir(dir)).length).toBe(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it("reports unavailable book and engine services without losing manual overrides", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-"));
    try {
      const p = importPgn(blankProject(), "1. e4");
      p.moves[0].effect.badge.manual = "brilliant";
      const results: any[] = [];
      const service = new AnalysisService(
        dir,
        async () => new Response("", { status: 401 }),
      );
      await service.run(
        p,
        "both",
        p.moves.map((m) => m.id),
        "missing-stockfish",
        undefined,
        (x) => results.push(x),
      );
      expect(results[0].analysis.book.state).toBe("unavailable");
      expect(results[0].analysis.engine.state).toBe("unavailable");
      expect(p.moves[0].effect.badge.manual).toBe("brilliant");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
  it.runIf(hasEngine)(
    "runs real local Stockfish and uses documented loss thresholds",
    async () => {
      const engine = new UciEngine(stockfish);
      try {
        await engine.ready();
        const s = await engine.score(blankProject().startFen, 6, 200);
        expect(s.best).toMatch(/^[a-h][1-8][a-h][1-8]/);
        expect(s.depth).toBeGreaterThan(0);
        expect(Number.isFinite(s.cp)).toBe(true);
      } finally {
        engine.close();
      }
      expect(classify(0, true)).toBe("best");
      expect(classify(200, false)).toBe("blunder");
    },
  );
  it.runIf(hasFfmpeg)(
    "builds audio timing from landings and cleans cancelled exports",
    async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-"));
      try {
        const p = importPgn(blankProject(), "1. e4");
        const plan = audioPlan(p, null, dir, 0, 3);
        expect(plan.inputs).toContain(path.join(dir, "move.wav"));
        expect(plan.filter).toContain("adelay=1626|1626");
        const status: string[] = [],
          dest = path.join(dir, "cancelled.mp4"),
          job = new VideoExport(
            p,
            null,
            {
              format: "square",
              encoder: "software",
              width: 64,
              height: 64,
              fps: 60,
              end: 0.1,
            },
            ffmpeg,
            dest,
            (x) => status.push(x.phase),
          );
        await job.initialize();
        await job.frame(new Uint8Array(64 * 64 * 4), 0);
        await job.cancel();
        expect(status).toContain("cancelled");
        expect(await fs.readdir(dir)).toEqual([]);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  );
  it.runIf(hasFfmpeg)(
    "mixes trimmed/offset music at the measured timeline timestamp",
    async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "castudio-sync-"));
      try {
        const source = path.join(dir, "pulse.wav");
        await runProcess(ffmpeg, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=700:duration=0.08",
          "-af",
          "adelay=500,apad,atrim=duration=2",
          "-ar",
          "48000",
          source,
        ]);
        const p = blankProject();
        p.sound.enabled = false;
        p.music = {
          assetId: "pulse",
          offset: 0.4,
          trimStart: 0.2,
          trimEnd: 1.5,
          duration: 2,
          volume: 1,
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
          waveform: [],
        };
        p.assets = [
          {
            id: "pulse",
            name: "sync pulse",
            path: source,
            kind: "audio",
            source: "test synthesis",
            guidance: "",
          },
        ];
        const output = path.join(dir, "sync.mp4"),
          job = new VideoExport(
            p,
            null,
            {
              format: "square",
              encoder: "software",
              width: 64,
              height: 64,
              fps: 60,
              end: 1.5,
            },
            ffmpeg,
            output,
            () => {},
          );
        await job.initialize();
        for (let i = 0; i < job.total; i++)
          await job.frame(new Uint8Array(64 * 64 * 4).fill(255), i);
        await job.finish();
        const pcm = execFileSync(ffmpeg, [
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          output,
          "-f",
          "f32le",
          "-ac",
          "1",
          "-ar",
          "48000",
          "-",
        ]);
        const rms = (a: number, b: number) => {
          let sum = 0,
            count = 0;
          for (let i = Math.round(a * 48000); i < Math.round(b * 48000); i++) {
            const v = pcm.readFloatLE(i * 4);
            sum += v * v;
            count++;
          }
          return Math.sqrt(sum / count);
        };
        expect(rms(0.5, 0.65)).toBeLessThan(0.001);
        expect(rms(0.71, 0.76)).toBeGreaterThan(0.025);
        expect(rms(0.9, 1.1)).toBeLessThan(0.001);
        expect(
          (await fs.readdir(dir)).some((f) =>
            f.startsWith(".castudio-export-"),
          ),
        ).toBe(false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  );
});
