/** Run after npm run test:finishing: node --import tsx docs/finishing-031/audio-check.mjs */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { blank } from "../../src/core/project.ts";
import { titleShot, compileStoryboard } from "../../src/core/storyboard.ts";
import { soundtrackGain } from "../../src/core/audio/timing.ts";
import { VideoJob } from "../../desktop/export.ts";
const dir = path.resolve("test-results/finishing-render"),
  ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const decode = (file) =>
  execFileSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      file,
      "-vn",
      "-f",
      "f32le",
      "-ac",
      "1",
      "-ar",
      "48000",
      "pipe:1",
    ],
    { maxBuffer: 5e6 },
  );
const rms = (pcm, t) => {
  let e = 0;
  for (let i = 0; i < 800; i++)
    e += pcm.readFloatLE((Math.round(t * 48000) + i) * 4) ** 2;
  return Math.sqrt(e / 800);
};
const encode = async (project, name, start = 0, end = 4) => {
  const file = path.join(dir, name + ".mp4"),
    job = new VideoJob(
      project,
      {
        mode: "storyboard",
        format: "square",
        start,
        end,
        width: 64,
        height: 64,
        fps: 30,
      },
      file,
      ffmpeg,
      false,
      () => {},
    );
  await job.start();
  try {
    for (let i = 0; i < job.frames; i++)
      await job.frame(Buffer.alloc(64 * 64 * 4), i);
    await job.finish();
  } catch (e) {
    await job.cancel();
    throw e;
  }
  return decode(file);
};
const project = JSON.parse(
  await fs.readFile(path.join(dir, "audio-synchronization.castudio"), "utf8"),
);
const actual = await encode(project, "audio-synchronization-envelope", 0, 1.2);
const baselineProject = JSON.parse(
  await fs.readFile(path.join(dir, "format-comparison.castudio"), "utf8"),
);
const baseline =
  rms(await encode(baselineProject, "automation-baseline", 0, 1.2), 0.4) /
  baselineProject.music.volume;
const errors = [];
for (const t of [0.04, 0.14, 0.31, 0.46, 0.61, 0.76, 0.91, 1.06])
  errors.push(
    Math.abs(
      rms(actual, t) - baseline * soundtrackGain(project, t + 0.008, 1.2),
    ),
  );
assert(Math.max(...errors) < 0.012, JSON.stringify(errors));
for (const shot of compileStoryboard(project).shots)
  assert(
    project.storyboard.beats.some((b) => Math.abs(b.time - shot.start) < 1e-9),
  );
const music = path.join(dir, "source-sections.wav");
execFileSync(ffmpeg, [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "aevalsrc=0.125*sin(2*PI*if(lt(t\\,10)\\,220\\,660)*t):s=48000:d=16",
  music,
]);
const p = blank();
p.assets = [
  {
    id: "tone",
    kind: "audio",
    path: music,
    name: "source-sections.wav",
    source: "test",
    guidance: "generated",
  },
];
p.music = {
  ...p.music,
  asset: "tone",
  sourceDuration: 16,
  trimStart: 10,
  trimEnd: 14,
  offset: 2,
  volume: 0.8,
  fadeIn: 0.3,
  fadeOut: 0.4,
  volumePoints: [
    { time: 2, value: 0.8 },
    { time: 3, value: 0.3 },
    { time: 4, value: 1 },
  ],
};
p.audio.automatic = false;
p.storyboard.shots = Array.from({ length: 4 }, (_, i) =>
  titleShot(p, "Audio validation " + i, 1),
);
const full = await encode(p, "trim10-offset2-automation");
assert(rms(full, 1) < 0.0001);
const gainErrors = [];
for (const t of [2.1, 2.5, 2.9, 3.4, 3.8])
  gainErrors.push(
    Math.abs(
      rms(full, t) - (0.125 / Math.sqrt(2)) * soundtrackGain(p, t + 0.008, 4),
    ),
  );
assert(Math.max(...gainErrors) < 0.012, JSON.stringify(gainErrors));
const frequencyPower = (f) => {
  let re = 0,
    im = 0;
  for (let i = 0; i < 4800; i++) {
    const v = full.readFloatLE((120000 + i) * 4),
      phase = (2 * Math.PI * f * i) / 48000;
    re += v * Math.cos(phase);
    im += v * Math.sin(phase);
  }
  return Math.hypot(re, im);
};
assert(
  frequencyPower(660) > frequencyPower(220) * 10,
  "The source trim must select the 660Hz section after 10s",
);
const seek = await encode(p, "trim-seek", 2.75, 4);
assert(Math.abs(rms(seek, 0.08) - rms(full, 2.83)) < 0.009);
const muted = structuredClone(p);
muted.music.muted = true;
assert(rms(await encode(muted, "muted"), 2.5) < 0.0001);
const result = {
  automationMaxAbsoluteRmsError: Math.max(...errors),
  trim10Offset2MaxAbsoluteRmsError: Math.max(...gainErrors),
  seekTolerance: 0.009,
  sourceTrimFrequency660Verified: true,
  muteVerified: true,
  beatAlignedCutsVerified: true,
};
await fs.writeFile(
  "docs/finishing-031/audio-validation.json",
  JSON.stringify(result, null, 2),
);
console.log(
  "PASS: decoded rhythmic automation, 10-second source trim, 2-second offset, fades, seek, mute, beat-aligned cuts",
  result,
);
