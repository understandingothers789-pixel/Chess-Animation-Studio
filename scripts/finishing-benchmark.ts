import fs from "node:fs/promises";
import { analyze } from "../src/core/audio";
import { waveformBins } from "../src/core/audio/timing";
const samples = Float32Array.from(
  { length: 600 * 8000 },
  (_, i) => Math.sin(i * 0.4) * (i % 4000 < 100 ? 1 : 0.15),
);
const start = performance.now(),
  analysis = analyze(samples, 8000),
  analysisMs = performance.now() - start;
const t = performance.now();
for (let i = 0; i < 1000; i++)
  waveformBins(analysis.waveform, 600, i / 10, i / 10 + 10, 1000);
const report = {
  seconds: 600,
  sampleRate: 8000,
  inputBytes: samples.byteLength,
  envelopeBytes: analysis.waveform.length * 8,
  analysisMs,
  viewportAggregation1000Ms: performance.now() - t,
  processRSS: process.memoryUsage().rss,
  notes:
    "CPU measurements; normalized analysis envelope reused, no audio decoding on scroll/zoom.",
};
await fs.writeFile(
  "docs/finishing-031/waveform-performance.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
