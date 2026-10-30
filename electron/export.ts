import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import type { Project } from "../src/core/model";
import { DIMENSIONS } from "../src/core/model";
import type { ExportOptions, ExportProgress } from "../src/bridge";
import { duration, segments, clamp } from "../src/core/timeline";
import { buildGame } from "../src/core/chess";
import { resolveAsset, synthWave } from "./files";

export async function runProcess(
  binary: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, signal }),
      parts: string[] = [];
    child.stdout.on("data", (d) => {
      parts.push(d.toString());
      if (parts.join("").length > 20000) parts.shift();
    });
    child.stderr.on("data", (d) => {
      parts.push(d.toString());
      if (parts.join("").length > 20000) parts.shift();
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(parts.join(""))
        : reject(
            new Error(`FFmpeg exited ${code}: ${parts.join("").slice(-2500)}`),
          ),
    );
  });
}
export async function chooseEncoder(
  binary: string,
  preference: "auto" | "software",
  signal?: AbortSignal,
): Promise<string> {
  const list = await runProcess(binary, ["-hide_banner", "-encoders"], signal);
  if (preference === "auto")
    for (const encoder of ["h264_amf", "h264_nvenc", "h264_qsv"]) {
      if (!list.includes(encoder)) continue;
      try {
        await runProcess(
          binary,
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=64x64:r=60",
            "-frames:v",
            "1",
            "-c:v",
            encoder,
            "-f",
            "null",
            "-",
          ],
          signal,
        );
        return encoder;
      } catch {
        if (signal?.aborted) throw new Error("Export cancelled.");
      }
    }
  if (!list.includes("libx264"))
    throw new Error(
      "This FFmpeg has no usable H.264 software encoder. Choose a build with libx264 in Settings.",
    );
  return "libx264";
}
export interface AudioPlan {
  inputs: string[];
  filter: string;
  end: number;
}
export function audioPlan(
  p: Project,
  projectPath: string | null,
  temp: string,
  start: number,
  end: number,
): AudioPlan {
  const inputs: string[] = [],
    filters: string[] = [];
  const labels: string[] = [];
  const getInput = (file: string) => {
    let i = inputs.indexOf(file);
    if (i < 0) {
      i = inputs.length;
      inputs.push(file);
    }
    return i + 1;
  };
  if (p.music && !p.music.muted) {
    const m = p.music,
      asset = p.assets.find((a) => a.id === m.assetId);
    if (!asset)
      throw new Error(
        "The music asset is missing. Relink it before exporting.",
      );
    const begin = Math.max(start, m.offset),
      finish = Math.min(
        end,
        m.offset + Math.min(m.trimEnd, m.duration) - m.trimStart,
      );
    if (finish > begin) {
      const input = getInput(resolveAsset(asset, projectPath)),
        trim = m.trimStart + begin - m.offset,
        delay = Math.round((begin - start) * 1000),
        len = finish - begin;
      const fadeIn = Math.max(0, m.fadeIn - Math.max(0, begin - m.offset));
      const fadeOutAt = Math.max(
        0,
        Math.min(end, m.offset + m.trimEnd - m.trimStart) - begin - m.fadeOut,
      );
      filters.push(
        `[${input}:a]atrim=start=${trim}:end=${trim + len},asetpts=PTS-STARTPTS,volume=${m.volume},afade=t=in:st=0:d=${Math.min(fadeIn, len)},afade=t=out:st=${fadeOutAt}:d=${m.fadeOut},adelay=${delay}|${delay}[music]`,
      );
      labels.push("[music]");
    }
  }
  type Cue = { file: string; time: number; volume: number };
  const cues: Cue[] = [];
  if (p.sound.enabled) {
    const game = buildGame(p);
    for (const s of segments(p))
      cues.push({
        file: path.join(
          temp,
          game.steps[s.index].captureId ? "capture.wav" : "move.wav",
        ),
        time: s.landing,
        volume: game.steps[s.index].captureId
          ? p.sound.dramatic
          : p.sound.chess,
      });
  }
  const segs = segments(p);
  for (const c of p.cues) {
    const asset = p.assets.find((a) => a.id === c.assetId);
    if (!asset) throw new Error("A sound cue asset is missing.");
    const s = c.moveId
      ? segs.find((s) => p.moves[s.index].id === c.moveId)
      : null;
    if (c.moveId && !s) continue;
    cues.push({
      file: resolveAsset(asset, projectPath),
      time: (s?.landing ?? 0) + c.time,
      volume: c.volume * p.sound[c.bus],
    });
  }
  const grouped = new Map<string, Cue[]>();
  for (const cue of cues) {
    if (cue.time >= end || cue.time < start - 60) continue;
    const group = grouped.get(cue.file) ?? [];
    group.push(cue);
    grouped.set(cue.file, group);
  }
  let id = 0;
  for (const [file, group] of grouped) {
    const input = getInput(file),
      sources = group.map(() => `src${id++}`);
    filters.push(
      `[${input}:a]asplit=${group.length}${sources.map((s) => `[${s}]`).join("")}`,
    );
    group.forEach((cue, i) => {
      const label = `cue${id++}`,
        delay = Math.round(Math.max(0, cue.time - start) * 1000),
        trim = Math.max(0, start - cue.time);
      filters.push(
        `[${sources[i]}]atrim=start=${trim}:duration=${end - start},asetpts=PTS-STARTPTS,volume=${cue.volume},adelay=${delay}|${delay}[${label}]`,
      );
      labels.push(`[${label}]`);
    });
  }
  filters.push(
    `anullsrc=r=48000:cl=stereo,atrim=duration=${end - start}[silence]`,
  );
  labels.push("[silence]");
  filters.push(
    `${labels.join("")}amix=inputs=${labels.length}:duration=longest:normalize=0,alimiter=limit=.95:latency=1,atrim=duration=${end - start},asetpts=PTS-STARTPTS[outa]`,
  );
  return { inputs, filter: filters.join(";\n"), end };
}
export class VideoExport {
  private process: ChildProcessWithoutNullStreams | null = null;
  private processDone: Promise<void> | null = null;
  private temp = "";
  private error = "";
  private index = 0;
  private cancelled = false;
  private finished = false;
  private abort = new AbortController();
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly start: number;
  readonly end: number;
  readonly total: number;
  encoder = "";
  constructor(
    readonly p: Project,
    readonly projectPath: string | null,
    readonly options: ExportOptions,
    readonly binary: string,
    readonly destination: string,
    private progress: (p: ExportProgress) => void,
  ) {
    [this.width, this.height] = [
      options.width ?? DIMENSIONS[options.format][0],
      options.height ?? DIMENSIONS[options.format][1],
    ];
    this.fps = options.fps ?? 60;
    if (
      this.width % 2 ||
      this.height % 2 ||
      this.width < 64 ||
      this.height < 64 ||
      this.width > 4096 ||
      this.height > 4096 ||
      ![30, 60].includes(this.fps)
    )
      throw new Error("Unsupported export dimensions or frame rate.");
    this.start = clamp(options.start ?? 0, 0, duration(p));
    const requestedEnd = clamp(options.end ?? duration(p), 0, duration(p));
    this.total = Math.ceil((requestedEnd - this.start) * this.fps);
    this.end = this.start + this.total / this.fps;
    if (this.total < 1) throw new Error("Export range is empty.");
  }
  async initialize() {
    for (const asset of this.p.assets) {
      if (
        asset.kind === "audio" ||
        asset.kind === "image" ||
        asset.kind === "badge"
      )
        await fs.access(resolveAsset(asset, this.projectPath)).catch(() => {
          throw new Error(
            `Missing asset: ${asset.name}. Relink or remove it before exporting.`,
          );
        });
    }
    this.encoder = await chooseEncoder(
      this.binary,
      this.options.encoder,
      this.abort.signal,
    );
    const stat = await fs.statfs(path.dirname(this.destination));
    if (
      Number(stat.bavail) * Number(stat.bsize) <
      Math.max(50_000_000, (this.total / this.fps) * 1_000_000)
    )
      throw new Error("Insufficient free disk space for this export.");
    this.temp = await fs.mkdtemp(
      path.join(path.dirname(this.destination), ".castudio-export-"),
    );
    await fs.writeFile(path.join(this.temp, "move.wav"), synthWave("move"));
    await fs.writeFile(
      path.join(this.temp, "capture.wav"),
      synthWave("capture"),
    );
    const settings =
      this.encoder === "libx264"
        ? ["-preset", "fast", "-crf", "18", "-threads", "4"]
        : ["-b:v", "16M"];
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      `${this.width}x${this.height}`,
      "-framerate",
      String(this.fps),
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      this.encoder,
      ...settings,
      "-pix_fmt",
      "yuv420p",
      path.join(this.temp, "video.mp4"),
    ];
    const child = spawn(this.binary, args, { windowsHide: true });
    this.process = child;
    child.stderr.on("data", (d) => {
      this.error = (this.error + d.toString()).slice(-3000);
    });
    child.stdout.resume();
    child.stdin.on("error", () => {});
    this.processDone = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(this.error || `Encoder exited ${code}.`)),
      );
    });
    this.processDone.catch(() => {});
    this.progress({
      phase: "rendering",
      done: 0,
      total: this.total,
      message: `Rendering exact frames · ${this.encoder}`,
    });
  }
  async frame(bytes: Uint8Array, index: number) {
    if (this.cancelled) throw new Error("Export cancelled.");
    if (this.finished || !this.process || index !== this.index)
      throw new Error("Unexpected export frame.");
    if (bytes.byteLength !== this.width * this.height * 4)
      throw new Error("Frame size does not match export dimensions.");
    if (this.process.exitCode !== null)
      throw new Error(this.error || "Encoder stopped.");
    await new Promise<void>((resolve, reject) => {
      this.process!.stdin.write(Buffer.from(bytes), (e) =>
        e ? reject(new Error(this.error || e.message)) : resolve(),
      );
    });
    this.index++;
    if (this.index % 15 === 0 || this.index === this.total)
      this.progress({
        phase: "rendering",
        done: this.index,
        total: this.total,
        message: `Frame ${this.index} / ${this.total}`,
      });
  }
  async finish() {
    if (this.cancelled || this.finished) return;
    try {
      if (this.index !== this.total)
        throw new Error(
          `Incomplete render (${this.index}/${this.total} frames).`,
        );
      this.process!.stdin.end();
      await this.processDone;
      if (this.cancelled) return;
      this.progress({
        phase: "encoding",
        done: this.total,
        total: this.total,
        message: "Mixing music and sound cues…",
      });
      const plan = audioPlan(
          this.p,
          this.projectPath,
          this.temp,
          this.start,
          this.end,
        ),
        graph = path.join(this.temp, "mix.txt"),
        output = path.join(this.temp, "finished.mp4");
      await fs.writeFile(graph, plan.filter);
      const args = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        path.join(this.temp, "video.mp4"),
        ...plan.inputs.flatMap((f) => ["-i", f]),
        "-filter_complex_script",
        graph,
        "-map",
        "0:v:0",
        "-map",
        "[outa]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-t",
        String(this.end - this.start),
        "-movflags",
        "+faststart",
        output,
      ];
      await runProcess(this.binary, args, this.abort.signal);
      if (this.cancelled) return;
      await fs.rename(output, this.destination);
      this.finished = true;
      this.progress({
        phase: "complete",
        done: this.total,
        total: this.total,
        message: "MP4 saved.",
        path: this.destination,
      });
    } catch (e) {
      if (!this.cancelled) {
        this.finished = true;
        this.progress({
          phase: "error",
          done: this.index,
          total: this.total,
          message: (e as Error).message,
        });
        throw e;
      }
    } finally {
      if (this.temp)
        await fs.rm(this.temp, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
    }
  }
  async cancel() {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    this.abort.abort();
    if (this.process) {
      this.process.stdin.destroy();
      this.process.kill();
      await this.processDone?.catch(() => {});
    }
    if (this.temp)
      await fs.rm(this.temp, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    this.progress({
      phase: "cancelled",
      done: this.index,
      total: this.total,
      message: "Export cancelled; temporary files removed.",
    });
  }
}
