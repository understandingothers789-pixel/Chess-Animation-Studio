import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { introFilm as film } from "../src/core/introVideo";

const run = promisify(execFile);
export async function prepareIntroVideo(
  ffmpeg: string,
  input: string,
  output: string,
  trim = { start: 0, x: 0.5, y: 0.5 },
) {
  if (
    !Number.isFinite(trim.start) ||
    trim.start < 0 ||
    trim.start > 7200 ||
    ![trim.x, trim.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
  )
    throw Error("Choose a valid video in-point and crop.");
  const stat = await fs.stat(input);
  if (
    !stat.isFile() ||
    stat.size > 256 * 1024 * 1024 ||
    !/\.(mp4|mov|webm|mkv|m4v)$/i.test(input)
  )
    throw Error("Choose an MP4, MOV, WebM or MKV video under 256 MB.");
  const frames = film.fps * film.seconds;
  const filter = [
    `fps=${film.fps}`,
    `scale=${film.cell}:${film.cell}:force_original_aspect_ratio=increase:force_divisible_by=2`,
    `crop=${film.cell}:${film.cell}:(iw-ow)*${trim.x}:(ih-oh)*${trim.y}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${film.seconds}`,
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
        String(film.seconds),
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
