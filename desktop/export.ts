import { requiredAssetIds } from "../src/core/exportAssets";
import { soundtrackGainExpression } from "../src/core/audio/timing";
import { musicEnd } from "../src/core/audio";
import { audioEvents } from "../src/core/audioEvents";
import {
  presentationDuration,
  validateStoryboardExport,
} from "../src/core/storyboard";
import {
  validateExport,
  MAX_EXPORT_DIMENSION,
} from "../src/core/exportOptions";
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
  private finalizing: Promise<void> | null = null;
  private finalized = false;
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
    this.check();
    if (this.options.mode === "storyboard")
      validateStoryboardExport(this.project);
    if (!this.ffmpeg)
      throw Error("Choose FFmpeg in Settings before exporting.");
    if (
      this.options.end <= this.options.start ||
      this.options.start < 0 ||
      this.options.end >
        presentationDuration(this.project, this.options.mode) + 0.01
    )
      throw Error("Invalid export range.");
    if (
      this.width % 2 ||
      this.height % 2 ||
      this.width > MAX_EXPORT_DIMENSION ||
      this.height > MAX_EXPORT_DIMENSION
    )
      throw Error("H.264 requires even supported dimensions.");
    const needed = requiredAssetIds(this.project, this.options);
    for (const id of needed) {
      const asset = this.project.assets.find((a) => a.id === id);
      if (!asset) throw Error("Required export asset is missing: " + id);
      await validAsset(asset);
    }
    const free = await fs.statfs(path.dirname(this.destination));
    if (
      Number(free.bavail) * Number(free.bsize) <
      50e6 + this.frames * this.width * this.height * 0.006
    )
      throw Error("Insufficient disk space for export.");
    try {
      this.temp = await fs.mkdtemp(
        path.join(path.dirname(this.destination), ".chess-studio-export-"),
      );
      this.check();
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
    } catch (error) {
      try {
        await this.clean();
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          "Export startup and cleanup failed",
          { cause: error },
        );
      }
      throw error;
    }
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
    this.check();
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
      // Atomic rename is the irreversible commit point. A cancellation arriving
      // after it starts waits for that outcome rather than claiming rollback.
      this.finalizing = fs.rename(
        path.join(this.temp, "complete.mp4"),
        this.destination,
      );
      await this.finalizing;
      this.finalized = true;
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
      automation = "",
    ) => {
      if (trimEnd <= trimStart || delay >= seconds) return;
      const idx = input++;
      args.push("-i", file);
      const tag = `a${idx}`;
      const parts = [
        `atrim=start=${Math.max(0, trimStart)}${trimEnd > 0 ? `:end=${trimEnd}` : ""}`,
        "asetpts=PTS-STARTPTS",
        // WAV decoder blocks can be 4096 samples (~85ms). Evaluate the gain
        // curve on 256-sample blocks (~5ms), without padding the final block.
        ...(automation ? ["asetnsamples=n=256:p=0"] : []),
        automation ? `volume='${automation}':eval=frame` : `volume=${volume}`,
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
        end = musicEnd(
          p,
          p.music.sourceDuration || Infinity,
          presentationDuration(p, this.options.mode),
        );
      add(
        music.path,
        trim,
        end,
        Math.max(0, p.music.offset - this.options.start),
        p.music.volume,
        0,
        0,
        soundtrackGainExpression(
          p,
          this.options.start,
          end,
          trim,
          this.options.mode,
        ),
      );
    }
    const moveSound = path.join(this.temp, "move.wav"),
      captureSound = path.join(this.temp, "capture.wav");
    await fs.writeFile(moveSound, sound());
    await fs.writeFile(captureSound, sound(true));
    const cues = audioEvents(p, this.options.mode);
    for (const c of cues) {
      if (c.at >= this.options.end || c.end <= this.options.start) continue;
      const trimStart = c.offset + Math.max(0, this.options.start - c.at);
      const trimEnd = Math.min(
        c.duration ?? Infinity,
        c.offset + c.end - c.at,
        c.offset + this.options.end - c.at,
      );
      if (trimEnd <= trimStart) continue;
      const asset = c.asset ? map.get(c.asset) : null;
      add(
        c.asset === "__knightHorse"
          ? path.resolve(__dirname, "../dist/sounds/horse.oga")
          : (asset?.path ?? (c.kind === "capture" ? captureSound : moveSound)),
        trimStart,
        trimEnd,
        c.at - this.options.start,
        c.volume * p.audio[c.bus],
        0,
        0,
      );
    }
    if (labels.length) {
      filters.push(
        `${labels.join("")}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.95:level=0:latency=1,apad,atrim=duration=${seconds}[mix]`,
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
    if (this.finalizing) {
      try {
        await this.finalizing;
      } catch {}
    }
    if (this.finalized) return;
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
