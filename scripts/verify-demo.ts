import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { parseProject } from "../src/core/model";
import { duration } from "../src/core/timeline";
const p = parseProject(
    JSON.parse(await fs.readFile("samples/Opera-Game.castudio", "utf8")),
  ),
  file = "test-results/Opera-Game-1080p.mp4";
const probe = JSON.parse(
  execFileSync(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8" },
  ),
);
const v = probe.streams.find((s: any) => s.codec_type === "video"),
  a = probe.streams.find((s: any) => s.codec_type === "audio");
assert.equal(v.width, 1920);
assert.equal(v.height, 1080);
assert.equal(v.codec_name, "h264");
assert.equal(v.avg_frame_rate, "60/1");
assert.equal(Number(v.nb_frames), Math.ceil(duration(p) * 60));
assert.equal(a.codec_name, "aac");
assert.ok(
  Math.abs(Number(probe.format.duration) - duration(p)) <= 1 / 60 + 1e-6,
);
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  file,
  "-f",
  "null",
  "-",
]);
await fs.writeFile(
  "test-results/Opera-Game-1080p-probe.json",
  JSON.stringify(probe, null, 2),
);
console.log(
  `PASS: full sample MP4 decodes completely: ${v.nb_frames} frames, 1920×1080, 60 FPS, ${probe.format.duration}s, AAC audio. Duration rounds up to the next video frame.`,
);
