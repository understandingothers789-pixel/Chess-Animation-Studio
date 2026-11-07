import { it, expect } from "vitest";
import { blank } from "../src/core/project";
import { analyze, musicAt } from "../src/core/audio";
import {
  snapTime,
  soundtrackWindow,
  soundtrackGain,
  waveformBins,
} from "../src/core/audio/timing";
import { titleShot } from "../src/core/storyboard";
import { productionChecks } from "../src/core/productionChecks";
it("aggregates a real envelope, including silence and exact output offset/trim", () => {
  const rate = 1000,
    samples = Float32Array.from({ length: 3000 }, (_, i) =>
      i < 1000 ? 0 : Math.sin(i * 0.3) * (i < 2000 ? 0.2 : 1),
    );
  const { waveform } = analyze(samples, rate);
  expect(waveform[0]).toBe(0);
  expect(Math.max(...waveform)).toBe(1);
  const bins = waveformBins(waveform, 3, 0, 3, 3);
  expect(waveformBins(waveform, 3, 0, 0.9, 3)).toEqual([0, 0, 0]);
  expect(waveformBins([0, 0.2, 1], 3, 0, 3, 3)).toEqual([0, 0.2, 1]);
  expect(bins[2]).toBeGreaterThan(bins[1]);
  expect(waveformBins([], 0, 0, 1, 100)).toEqual([]);
  const p = blank();
  p.music.sourceDuration = 30;
  p.music.offset = 2;
  p.music.trimStart = 10;
  p.music.trimEnd = 18;
  expect(musicAt(p, 2)).toBe(10);
  expect(soundtrackWindow(p, 20)).toEqual({ start: 2, end: 10 });
  p.music.fadeIn = 2;
  p.music.fadeOut = 2;
  p.music.volume = 1;
  expect(soundtrackGain(p, 1, 20)).toBe(0);
  expect(soundtrackGain(p, 3, 20)).toBeCloseTo(0.5);
  expect(soundtrackGain(p, 9, 20)).toBeCloseTo(0.5);
  p.music.volumePoints = [
    { time: 2, value: 0.2 },
    { time: 4, value: 0.8 },
  ];
  expect(soundtrackGain(p, 3, 20)).toBeCloseTo(0.25);
  p.music.muted = true;
  expect(soundtrackGain(p, 5, 20)).toBe(0);
});
it("snaps only within threshold and supports bypass and empty targets", () => {
  expect(snapTime(1.96, [1, 2, 3], 0.1)).toBe(2);
  expect(snapTime(1.96, [2], 0.1, true)).toBe(1.96);
  expect(snapTime(1.8, [2], 0.1)).toBe(1.8);
  expect(snapTime(1, [], 0.1)).toBe(1);
});
it("production warnings never become export blockers; bad audio and dimensions are errors", () => {
  const p = blank();
  p.storyboard.shots = [titleShot(p, "A long caption ".repeat(20), 2)];
  const o = {
    mode: "storyboard" as const,
    format: "vertical" as const,
    start: 0,
    end: 2,
    width: 1080,
    height: 1920,
    fps: 30,
  };
  const checks = productionChecks(p, o, (t, s) => t.length * s);
  expect(checks.some((i) => i.severity === "warning")).toBe(true);
  expect(checks.some((i) => i.severity === "error")).toBe(false);
  expect(
    productionChecks(p, { ...o, width: 5 }).some((i) => i.severity === "error"),
  ).toBe(true);
  p.music.asset = "missing";
  p.music.trimStart = 10;
  p.music.sourceDuration = 3;
  expect(
    productionChecks(p, o).filter((i) => i.severity === "error"),
  ).toHaveLength(2);
});
it("export dependencies exclude unused library files but retain required paths", async () => {
  const { requiredAssetIds } = await import("../src/core/exportAssets");
  const p = blank();
  p.music.asset = "song";
  p.assets = [
    {
      id: "unused",
      kind: "image",
      name: "missing.png",
      path: "/missing.png",
      source: "test",
      guidance: "",
    },
  ];
  const o = { format: "landscape" as const, start: 0, end: 1, fps: 30 };
  expect([...requiredAssetIds(p, o)]).toEqual(["song"]);
  p.music.muted = true;
  expect(requiredAssetIds(p, o).size).toBe(0);
  p.layouts.landscape.background = "image";
  p.layouts.landscape.image = "bg";
  expect(requiredAssetIds(p, o).has("bg")).toBe(true);
});
it("duplicate automation timestamps use the latest value consistently", async () => {
  const { musicVolumeAt } = await import("../src/core/audio");
  const p = blank();
  p.music.volumePoints = [
    { time: 0, value: 1 },
    { time: 0, value: 0.3 },
    { time: 2, value: 0.7 },
  ];
  expect(musicVolumeAt(p, 0)).toBe(0.3);
  expect(musicVolumeAt(p, 1)).toBeCloseTo(0.5);
});
it("detects generated rhythmic peaks near their exact sample timestamps", () => {
  const rate = 8000,
    samples = new Float32Array(rate * 4);
  for (const t of [0.5, 1, 1.5, 2, 2.5, 3])
    for (let i = 0; i < rate * 0.05; i++)
      samples[Math.floor(t * rate) + i] =
        Math.sin(i * 0.37) * Math.exp(-i / 90);
  const peaks = analyze(samples, rate).peaks;
  for (const t of [0.5, 1, 1.5, 2, 2.5, 3])
    expect(peaks.some((p) => Math.abs(p.time - t) < 0.025)).toBe(true);
});
it("warns when music is outside output; unused muted source settings do not block export", () => {
  const p = blank();
  p.storyboard.shots = [titleShot(p, "Title", 1)];
  p.music.asset = "tone";
  p.music.sourceDuration = 3;
  p.music.offset = 4;
  p.assets = [
    {
      id: "tone",
      path: "/test.wav",
      kind: "audio",
      name: "tone",
      source: "test",
      guidance: "",
    },
  ];
  const o = {
    mode: "storyboard" as const,
    format: "square" as const,
    start: 0,
    end: 1,
    width: 1080,
    height: 1080,
    fps: 30,
  };
  expect(
    productionChecks(p, o).some(
      (i) => i.severity === "warning" && i.message.includes("outside"),
    ),
  ).toBe(true);
  p.music.muted = true;
  p.music.trimStart = 10;
  p.assets = [];
  expect(productionChecks(p, o).some((i) => i.severity === "error")).toBe(
    false,
  );
});
