import fs from "node:fs/promises";
import { sample, buildGame } from "../src/core/chess";
import { segments, duration } from "../src/core/timeline";
import { analyze } from "../src/core/audio";
const p = sample(),
  seq = segments(p),
  rate = 22050,
  length = duration(p) + 1,
  samples = new Float32Array(Math.ceil(length * rate)),
  landings = seq.map((s) => s.land);
for (let i = 0; i < samples.length; i++) {
  const t = i / rate,
    chord = [130.8128, 164.8138, 195.9977][Math.floor(t / 6) % 3];
  let v =
    Math.sin(t * 2 * Math.PI * chord) * 0.055 +
    Math.sin(t * 2 * Math.PI * chord * 2) * 0.025;
  for (const at of landings) {
    const d = t - at;
    if (d >= 0 && d < 0.14)
      v += Math.sin(2 * Math.PI * 740 * d) * Math.exp(-d * 45) * 0.27;
  }
  samples[i] = v;
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++)
  wav.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767),
    44 + i * 2,
  );
p.assets = [
  {
    id: "opera-music",
    name: "Opera — original synthesized study",
    kind: "audio",
    path: "Opera-original.wav",
    source: "Original synthesized composition for Chess Animation Studio",
    guidance:
      "GPL-3.0-or-later; editable synthesis source in scripts/sample.ts.",
  },
];
p.music.asset = "opera-music";
p.music.sourceDuration = length;
p.music.trimEnd = duration(p);
p.beats = seq.map((s, i) => ({
  id: "opera-beat-" + i,
  time: s.land,
  sourceTime: s.land,
  accent: i % 4 === 0,
  enabled: true,
}));
p.waveform = analyze(samples, rate).waveform;
p.pulse.enabled = true;
await fs.mkdir("samples", { recursive: true });
await fs.writeFile("samples/Opera-original.wav", wav);
await fs.writeFile("samples/Opera.castudio", JSON.stringify(p, null, 2));
console.log(
  "Generated original sample:",
  p.moves.length,
  "plies,",
  duration(p).toFixed(2),
  "seconds.",
);
