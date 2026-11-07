import { writeProject, readProject } from "../desktop/files";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { blank, parseProject } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { shotFromMove } from "../src/core/storyboard";
import { audioEvents } from "../src/core/audioEvents";
import { soundtrackGain } from "../src/core/audio/timing";
import { VideoJob } from "../desktop/export";
const dir = path.resolve("test-results/ducking");
await fs.mkdir(dir, { recursive: true });
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
for (const [name, hz] of [
  ["music", 440],
  ["capture", 880],
] as const)
  execFileSync(ffmpeg, [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${hz}:duration=6`,
    "-ar",
    "48000",
    path.join(dir, name + ".wav"),
  ]);
const p = importPgn(blank(), "1. e4 d5 2. exd5");
p.audio.automatic = false;
p.audio.knightHorse = false;
p.audio.chess = 0.5;
p.assets = ["music", "capture"].map((id) => ({
  id,
  name: id + ".wav",
  kind: "audio" as const,
  path: path.join(dir, id + ".wav"),
  source: "generated",
  guidance: "synthetic tone",
}));
p.music = {
  ...p.music,
  asset: "music",
  sourceDuration: 6,
  fadeIn: 0.15,
  fadeOut: 0.2,
  volumePoints: [
    { time: 0, value: 0.8 },
    { time: 4, value: 0.6 },
  ],
};
p.storyboard.shots = [0, 2, 2, 0].map((i) => shotFromMove(p, p.moves[i].id));
p.storyboard.shots.forEach((s) => {
  s.duration = 1;
  s.preHold = 0;
  s.postHold = 0;
});
p.storyboard.shots[1].musicDucking = {
  enabled: true,
  volume: 0.25,
  fadeDown: 0.2,
  fadeUp: 0.3,
};
p.storyboard.shots[2].musicDucking = {
  enabled: true,
  volume: 0.5,
  fadeDown: 0.2,
  fadeUp: 0.3,
};
p.cues = [
  {
    id: "capture-test",
    time: 0,
    kind: "capture",
    asset: "capture",
    volume: 0.5,
    move: p.moves[2].id,
    bus: "chess",
  },
];
assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))), p);
const decode = (file: string) =>
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
async function encode(project: typeof p, name: string, fps = 30, start = 0) {
  const file = path.join(dir, name + ".mp4"),
    job = new VideoJob(
      project,
      {
        mode: "storyboard",
        format: "square",
        width: 64,
        height: 64,
        fps,
        start,
        end: 4,
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
}
function amplitude(pcm: Buffer, t: number, hz: number) {
  let re = 0,
    im = 0;
  const count = 2400;
  for (let i = 0; i < count; i++) {
    const v = pcm.readFloatLE((Math.round(t * 48000) + i) * 4),
      a = (2 * Math.PI * hz * i) / 48000;
    re += v * Math.cos(a);
    im += v * Math.sin(a);
  }
  return (2 * Math.hypot(re, im)) / count;
}
let maxError = 0;
const samples = [0.35, 1.05, 1.35, 1.7, 2.05, 2.4, 2.7, 3.1, 3.5, 3.85];
for (const fps of [24, 30, 60]) {
  const pcm = await encode(p, "duck-" + fps, fps);
  for (const t of samples) {
    const error = Math.abs(
      amplitude(pcm, t, 440) -
        0.125 * soundtrackGain(p, t + 0.025, 4, "storyboard"),
    );
    maxError = Math.max(maxError, error);
    assert(error < 0.012, `${fps}fps at ${t}s: ${error}`);
  }
  console.log("PASS: decoded ducking/automation/fades at", fps, "FPS");
}
const full = decode(path.join(dir, "duck-30.mp4")),
  seek = await encode(p, "seek", 30, 1.5);
assert(Math.abs(amplitude(full, 1.6, 440) - amplitude(seek, 0.1, 440)) < 0.008);
const dry = structuredClone(p);
dry.music.muted = true;
const effectsOnly = await encode(dry, "effects-only");
const events = audioEvents(p, "storyboard").filter(
  (e) => e.asset === "capture",
);
assert.equal(events.length, 2);
for (const cue of events) {
  const t = cue.at + 0.03;
  const expected = amplitude(effectsOnly, t, 880);
  assert(expected > 0.015);
  assert(
    Math.abs(amplitude(full, t, 880) - expected) < 0.008,
    "Capture effects must bypass music ducking",
  );
}
assert(amplitude(effectsOnly, 0.5, 440) < 0.0001);
await fs.writeFile(
  "docs/ducking-032/audio-validation.json",
  JSON.stringify(
    {
      fps: [24, 30, 60],
      maxAmplitudeError: maxError,
      seeking: true,
      independentCaptureOccurrences: events.length,
      persistence: true,
    },
    null,
    2,
  ),
);
await writeProject(path.join(dir, "fixture.castudio"), p);
assert.deepEqual(await readProject(path.join(dir, "fixture.castudio")), p);
console.log(
  "PASS: seek, mute, independent repeated capture cues, persisted shot settings",
  maxError,
);
