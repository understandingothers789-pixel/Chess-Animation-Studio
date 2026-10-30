import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { type Project, sizes } from "../src/core/project";
import { segments, duration } from "../src/core/timeline";
import { buildGame } from "../src/core/chess";
import { validAsset, sound } from "./files";
import type { ExportOptions, ExportProgress } from "../src/bridge";
export class VideoJob {
  private child: ChildProcessWithoutNullStreams | null = null;
  private temp = "";
  private cancelled = false;
  private encoder = "libx264";
  private errors = "";
  private completion: Promise<void> | null = null;
  private renderError: Error | null = null;
  private count = 0;
  constructor(
    readonly project: Project,
    readonly options: ExportOptions,
    readonly destination: string,
    readonly ffmpeg: string,
    readonly hardware: boolean,
    readonly progress: (p: ExportProgress) => void,
  ) {}
  get frames() {
    return Math.ceil(
      (this.options.end - this.options.start) * (this.options.fps ?? 60),
    );
  }
  get width() {
    return this.options.width ?? sizes[this.options.format][0];
  }
  get height() {
    return this.options.height ?? sizes[this.options.format][1];
  }
  private launch(args: string[]) {
    const c = spawn(this.ffmpeg, args, { windowsHide: true, stdio: "pipe" });
    c.stdout.resume();
    c.stderr.on("data", (d) => {
      this.errors = (this.errors + d.toString()).slice(-12000);
    });
    c.stdin.on("error", () => {});
    c.on("error", () => {});
    this.child = c;
    return c;
  }
  private async run(args: string[]) {
    this.errors = "";
    const c = this.launch(args);
    await new Promise<void>((resolve, reject) => {
      c.once("error", reject);
      c.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              Error(
                this.cancelled
                  ? "Export cancelled."
                  : this.errors || "FFmpeg failed.",
              ),
            ),
      );
    });
  }
  async start() {
    if (!this.ffmpeg)
      throw Error("Choose FFmpeg in Settings before exporting.");
    if (
      this.options.end <= this.options.start ||
      this.options.start < 0 ||
      this.options.end > duration(this.project) + 0.01
    )
      throw Error("Invalid export range.");
    if (
      this.width % 2 ||
      this.height % 2 ||
      this.width > 3840 ||
      this.height > 3840
    )
      throw Error("H.264 requires even supported dimensions.");
    for (const a of this.project.assets) await validAsset(a);
    const free = await fs.statfs(path.dirname(this.destination));
    if (
      Number(free.bavail) * Number(free.bsize) <
      50e6 + this.frames * this.width * this.height * 0.006
    )
      throw Error("Insufficient disk space for export.");
    this.temp = await fs.mkdtemp(
      path.join(path.dirname(this.destination), ".chess-studio-export-"),
    );
    if (this.hardware) {
      for (const name of ["h264_amf", "h264_nvenc", "h264_qsv"]) {
        try {
          await this.run([
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=size=64x64:rate=60",
            "-frames:v",
            "1",
            "-c:v",
            name,
            "-f",
            "null",
            "-",
          ]);
          this.encoder = name;
          break;
        } catch {
          this.check();
        }
      }
    }
    this.check();
    this.errors = "";
    const c = this.launch([
      "-v",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgba",
      "-video_size",
      `${this.width}x${this.height}`,
      "-framerate",
      String(this.options.fps ?? 60),
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      this.encoder,
      ...(this.encoder === "libx264"
        ? ["-preset", "medium", "-crf", "19"]
        : ["-b:v", "14M"]),
      "-pix_fmt",
      "yuv420p",
      path.join(this.temp, "video.mp4"),
    ]);
    this.completion = new Promise<void>((resolve, reject) => {
      c.once("error", reject);
      c.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(Error(this.errors || "Video encoding failed.")),
      );
    });
    this.completion.catch((e) => {
      this.renderError = e;
    });
    this.progress({
      phase: `Rendering · ${this.encoder}`,
      done: 0,
      total: this.frames,
    });
  }
  private check() {
    if (this.cancelled) throw Error("Export cancelled.");
    if (this.renderError) throw this.renderError;
  }
  async frame(bytes: Uint8Array, index: number) {
    this.check();
    if (
      index !== this.count ||
      bytes.byteLength !== this.width * this.height * 4
    )
      throw Error("Unexpected export frame.");
    if (!this.child) throw Error("Encoder is not running.");
    await new Promise<void>((resolve, reject) => {
      this.child!.stdin.write(
        Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        (e) => (e ? reject(e) : resolve()),
      );
    });
    this.count++;
    this.progress({
      phase: `Rendering · ${this.encoder}`,
      done: this.count,
      total: this.frames,
    });
  }
  async finish(error?: string) {
    try {
      this.check();
      if (error) throw Error(error);
      if (this.count !== this.frames)
        throw Error("Export ended before all frames were rendered.");
      this.child!.stdin.end();
      await this.completion;
      this.check();
      await this.mixAudio();
      this.check();
      await fs.rename(path.join(this.temp, "complete.mp4"), this.destination);
      this.progress({
        phase: "Complete",
        done: this.frames,
        total: this.frames,
        path: this.destination,
      });
    } finally {
      await this.clean();
    }
  }
  private async mixAudio() {
    this.progress({
      phase: "Mixing audio",
      done: this.frames,
      total: this.frames,
    });
    const p = this.project,
      args = ["-v", "error", "-y", "-i", path.join(this.temp, "video.mp4")],
      filters: string[] = [],
      labels: string[] = [];
    let input = 1;
    const seconds = this.frames / (this.options.fps ?? 60),
      map = new Map(p.assets.map((a) => [a.id, a]));
    const add = (
      file: string,
      trimStart: number,
      trimEnd: number,
      delay: number,
      volume: number,
      fadeIn = 0,
      fadeOut = 0,
    ) => {
      const idx = input++;
      args.push("-i", file);
      const tag = `a${idx}`;
      const parts = [
        `atrim=start=${Math.max(0, trimStart)}${trimEnd > 0 ? `:end=${trimEnd}` : ""}`,
        "asetpts=PTS-STARTPTS",
        `volume=${volume}`,
      ];
      if (fadeIn) parts.push(`afade=t=in:d=${fadeIn}`);
      if (fadeOut && trimEnd > trimStart)
        parts.push(
          `afade=t=out:st=${Math.max(0, trimEnd - trimStart - fadeOut)}:d=${fadeOut}`,
        );
      parts.push(`adelay=${Math.round(Math.max(0, delay) * 1000)}:all=1`);
      filters.push(`[${idx}:a]${parts.join(",")}[${tag}]`);
      labels.push(`[${tag}]`);
    };
    const music = map.get(p.music.asset ?? "");
    if (music && !p.music.muted) {
      const trim =
          p.music.trimStart + Math.max(0, this.options.start - p.music.offset),
        end =
          p.music.trimEnd || p.music.trimStart + duration(p) - p.music.offset;
      add(
        music.path,
        trim,
        end,
        Math.max(0, p.music.offset - this.options.start),
        p.music.volume,
        Math.max(
          0,
          p.music.fadeIn - Math.max(0, this.options.start - p.music.offset),
        ),
        p.music.fadeOut,
      );
    }
    const moveSound = path.join(this.temp, "move.wav"),
      captureSound = path.join(this.temp, "capture.wav");
    await fs.writeFile(moveSound, sound());
    await fs.writeFile(captureSound, sound(true));
    const seq = segments(p),
      game = buildGame(p);
    const cues = p.cues.map((c) => {
      const i = c.move ? p.moves.findIndex((m) => m.id === c.move) : -1;
      return { ...c, absolute: (i >= 0 ? seq[i].land : 0) + c.time };
    });
    if (p.audio.automatic)
      for (let i = 0; i < seq.length; i++)
        cues.push({
          id: "auto" + i,
          asset: null,
          move: null,
          time: 0,
          volume: 0.7,
          kind: game.steps[i].capturedId ? "capture" : "move",
          bus: "chess",
          absolute: seq[i].land,
        });
    for (const c of cues) {
      if (
        c.absolute < this.options.start - 0.3 ||
        c.absolute >= this.options.end
      )
        continue;
      const asset = c.asset ? map.get(c.asset) : null;
      add(
        asset?.path ?? (c.kind === "capture" ? captureSound : moveSound),
        Math.max(0, this.options.start - c.absolute),
        0,
        c.absolute - this.options.start,
        c.volume * p.audio[c.bus],
      );
    }
    if (labels.length) {
      filters.push(
        `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95:latency=1,apad,atrim=duration=${seconds}[mix]`,
      );
      args.push(
        "-filter_complex",
        filters.join(";"),
        "-map",
        "0:v",
        "-map",
        "[mix]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
      );
    } else {
      args.push(
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=48000:cl=stereo",
        "-map",
        "0:v",
        "-map",
        `${input}:a`,
        "-c:a",
        "aac",
        "-b:a",
        "192k",
      );
    }
    args.push(
      "-c:v",
      "copy",
      "-t",
      String(seconds),
      "-movflags",
      "+faststart",
      path.join(this.temp, "complete.mp4"),
    );
    await this.run(args);
  }
  async cancel() {
    this.cancelled = true;
    this.child?.kill();
    await this.clean();
    this.progress({ phase: "Cancelled", done: this.count, total: this.frames });
  }
  async clean() {
    this.child?.kill();
    this.child = null;
    if (this.temp)
      await fs.rm(this.temp, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 100,
      });
  }
}
