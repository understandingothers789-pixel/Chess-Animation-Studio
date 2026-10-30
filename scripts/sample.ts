import { promises as fs } from "node:fs";
import { sampleProject } from "../src/core/chess";
import { effectPreset } from "../src/core/model";
import { segments, duration } from "../src/core/timeline";
import { analyzePcm } from "../src/core/audio";

const p = sampleProject();
p.moves[2].effect = effectPreset("spin");
p.moves[4].effect = effectPreset("dramatic");
p.moves[6].effect = effectPreset("capture");
p.moves[6].effect.badge.manual = "brilliant";
p.moves[4].effect.trail = true;
p.moves[2].effect.trail = false;
const length = Math.ceil(duration(p)),
  rate = 22050,
  samples = rate * length,
  pcm = Buffer.alloc(samples * 2);
const beats = segments(p).map((s) => s.landing);
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  let value = 0;
  for (const b of beats) {
    const dt = t - b;
    if (dt >= 0 && dt < 0.25)
      value += Math.sin(2 * Math.PI * 110 * dt) * Math.exp(-dt * 30) * 0.35;
  }
  const note = [220, 261.63, 329.63, 293.66][Math.floor(t / 4) % 4];
  value +=
    (Math.sin(t * 2 * Math.PI * note) +
      Math.sin(t * 2 * Math.PI * note * 1.5)) *
    0.035 *
    Math.min(1, t / 2, (length - t) / 2);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), i * 2);
}
const h = Buffer.alloc(44);
h.write("RIFF");
h.writeUInt32LE(36 + pcm.length, 4);
h.write("WAVEfmt ", 8);
h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20);
h.writeUInt16LE(1, 22);
h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * 2, 28);
h.writeUInt16LE(2, 32);
h.writeUInt16LE(16, 34);
h.write("data", 36);
h.writeUInt32LE(pcm.length, 40);
await fs.mkdir("samples", { recursive: true });
await fs.writeFile("samples/Opera-original.wav", Buffer.concat([h, pcm]));
p.assets.push({
  id: "sample-music",
  name: "Opera · original pulse study",
  kind: "audio",
  path: "Opera-original.wav",
  source: "Original synthesis by Chess Animation Studio · MIT",
  guidance: "Included under this repository’s MIT license.",
});
p.music = {
  assetId: "sample-music",
  offset: 0,
  trimStart: 0,
  trimEnd: length,
  duration: length,
  volume: 0.65,
  muted: false,
  fadeIn: 1,
  fadeOut: 1,
  waveform: [],
};
const samplesFloat = new Float32Array(samples);
for (let i = 0; i < samples; i++)
  samplesFloat[i] = pcm.readInt16LE(i * 2) / 32768;
p.music.waveform = analyzePcm(samplesFloat, rate).waveform;
p.beats = beats.map((time, i) => ({
  id: `demo-beat-${i}`,
  time,
  strong: i % 4 === 0,
  selected: true,
  sourceTime: time,
  assetId: "sample-music",
}));
for (let i = 0; i < p.moves.length; i++)
  p.moves[i].effect.landingBeat = p.beats[i].id;
await fs.writeFile("samples/Opera-Game.castudio", JSON.stringify(p, null, 2));
console.log(
  `Sample written: ${p.moves.length} moves, ${duration(p).toFixed(2)} seconds.`,
);
