import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { introFilm, type FilmLayout } from "../src/core/introVideo";

const run = promisify(execFile);
export async function validIntroSource(input: string) {
  const stat = await fs.stat(input);
  if (
    !stat.isFile() ||
    stat.size > 256 * 1024 * 1024 ||
    !/\.(mp4|mov|webm|mkv|m4v|gif|webp)$/i.test(input)
  )
    throw Error("Choose a supported video or animated image under 256 MB.");
}

export async function introDuration(ffmpeg: string, input: string) {
  const probe = path.join(
    path.dirname(ffmpeg),
    process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
  );
  try {
    const { stdout } = await run(
      probe,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        input,
      ],
      { timeout: 8000, windowsHide: true },
    );
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) && duration > 0
      ? Math.min(7200, duration)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function introSourceFrame(
  ffmpeg: string,
  input: string,
  start: number,
) {
  if (!Number.isFinite(start) || start < 0 || start > 7200)
    throw Error("Choose a valid source time.");
  await validIntroSource(input);
  const { stdout } = await run(
    ffmpeg,
    [
      "-nostdin",
      "-v",
      "error",
      "-protocol_whitelist",
      "file",
      "-ss",
      String(start),
      "-i",
      input,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-filter_threads",
      "1",
      "-threads",
      "1",
      "-vf",
      "scale=480:480:force_original_aspect_ratio=decrease,setsar=1",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 1024 * 1024,
      timeout: 12000,
      windowsHide: true,
    },
  );
  if (!stdout.length) throw Error("No source frame at this time.");
  return "data:image/jpeg;base64," + stdout.toString("base64");
}

export async function prepareIntroVideo(
  ffmpeg: string,
  input: string,
  output: string,
  trim = { start: 0, x: 0.5, y: 0.5 },
  film: FilmLayout = {
    ...introFilm,
    frames: introFilm.fps * introFilm.seconds,
  },
) {
  if (
    !Number.isFinite(trim.start) ||
    trim.start < 0 ||
    trim.start > 7200 ||
    ![trim.x, trim.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
  )
    throw Error("Choose a valid video in-point and crop.");
  await validIntroSource(input);
  const frames = film.frames,
    seconds = frames / film.fps;
  const filter = [
    `fps=${film.fps}`,
    `scale=${film.cell}:${film.cell}:force_original_aspect_ratio=increase:force_divisible_by=2`,
    `crop=${film.cell}:${film.cell}:(iw-ow)*${trim.x}:(ih-oh)*${trim.y}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${seconds}`,
    `trim=end_frame=${frames}`,
    `tile=${film.columns}x${film.rows}:nb_frames=${frames}`,
  ].join(",");
  await fs.mkdir(path.dirname(output), { recursive: true });
  try {
    await run(
      ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file",
        "-threads",
        "2",
        "-filter_threads",
        "2",
        "-ss",
        String(trim.start),
        "-t",
        String(seconds),
        "-i",
        input,
        "-map",
        "0:v:0",
        "-an",
        "-vf",
        filter,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        "-update",
        "1",
        "-y",
        output,
      ],
      { timeout: 45000, windowsHide: true },
    );
    if (!(await fs.stat(output)).size) throw Error("Empty filmstrip");
  } catch {
    await fs.rm(output, { force: true });
    throw Error(
      "Could not prepare this video. Check that FFmpeg opens it, or try another MP4.",
    );
  }
}
