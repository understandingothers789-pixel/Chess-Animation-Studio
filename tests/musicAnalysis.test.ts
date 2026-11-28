import { expect, it } from "vitest";
import { analyze, createMusicAnalyzer } from "../src/core/musicAnalysis";
import {
  activeBeats,
  removeMusicBeat,
  setBeatTime,
  updateMusicAnalysis,
} from "../src/core/beatMarkers";
import { align, syncMarkers } from "../src/core/audio";
import { blank, parseProject } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { compileTimeline, evaluate, segments } from "../src/core/timeline";
import {
  pulseSensitivity,
  selectBoardPulses,
  setPulseOverride,
} from "../src/core/boardPulse";

it("detects quiet stereo hits after a loud section and ranks the low drum over nearby hats", () => {
  const rate = 24000;
  const left = new Float32Array(rate * 5);
  const right = new Float32Array(rate * 5);
  for (let i = 0; i < left.length; i++)
    left[i] = 0.08 * Math.sin((i * 2 * Math.PI * 220) / rate);
  const add = (
    channel: Float32Array,
    at: number,
    hz: number,
    amplitude: number,
    length: number,
  ) => {
    for (let i = 0; i < length * rate; i++)
      channel[Math.round(at * rate) + i] +=
        amplitude *
        Math.sin((i * 2 * Math.PI * hz) / rate) *
        Math.exp((-4 * i) / (length * rate));
  };
  add(left, 0.35, 92, 0.85, 0.14);
  add(right, 1.4, 91, 0.27, 0.14);
  add(left, 1.63, 3800, 0.16, 0.035);
  add(right, 3.23, 96, 0.24, 0.14);
  const result = analyze([left, right], rate);
  const event = (t: number) =>
    result.peaks.find((p) => Math.abs(p.time - t) <= 0.024);
  expect(event(0.35)?.accent).toBe(true);
  expect(event(1.4)?.strength).toBeGreaterThan(event(1.63)?.strength ?? 0);
  expect(event(3.23)).toBeDefined();
  expect(result.peaks.filter((hit) => hit.time > 3.5)).toHaveLength(0);
  expect(result.waveformRms.every((rms, i) => rms <= result.waveform[i])).toBe(
    true,
  );
  const streamed = createMusicAnalyzer(rate, left.length, 2);
  for (let at = 0; at < left.length; at += 12345)
    streamed.push([
      left.subarray(at, at + 12345),
      right.subarray(at, at + 12345),
    ]);
  expect(streamed.finish()).toEqual(result);
});

it("does not lose phase-opposed attacks or add hits to digital silence", () => {
  const rate = 12000,
    left = new Float32Array(rate);
  expect(analyze(left, rate).peaks).toEqual([]);
  for (let i = 0; i < 250; i++) left[rate / 2 + i] = Math.sin(i * 0.4) * 0.55;
  const hit = analyze([left, left.map((x) => -x)], rate).peaks[0];
  expect(hit.time).toBeCloseTo(0.5, 2);
});

it("keeps corrected and linked markers and suppresses deleted suggestions after reanalysis", () => {
  const p = importPgn(blank(), "1. e4");
  const analysis = {
    peaks: [0.5, 1, 1.5, 2].map((time) => ({
      time,
      accent: false,
      strength: 0.7,
    })),
    waveform: [1],
    waveformRms: [0.2],
  };
  updateMusicAnalysis(p, analysis);
  const [corrected, deleted, linked, unedited] = p.beats;
  setBeatTime(p, corrected, 0.7);
  corrected.accent = true;
  p.moves[0].effect.landingBeat = linked.id;
  removeMusicBeat(p, deleted.id);
  updateMusicAnalysis(p, {
    ...analysis,
    peaks: analysis.peaks.map((b) => ({ ...b, time: b.time + 0.016 })),
  });
  expect(p.beats.map((b) => b.id)).toEqual([
    corrected.id,
    linked.id,
    unedited.id,
  ]);
  expect(p.beats[0]).toMatchObject({ time: 0.7, accent: true });
  expect(p.beats[1].time).toBe(1.5);
  expect(p.beats[2].time).toBeCloseTo(2.016);
  p.music.trimStart = 1.4;
  p.music.trimEnd = 1.8;
  p.beats = syncMarkers(p).beats;
  expect(activeBeats(parseProject(p)).map((b) => b.id)).toEqual([linked.id]);
});

it("prefers a stronger nearby hit without replacing an existing assignment", () => {
  const p = importPgn(blank(), "1. e4");
  const land = segments(p)[0].land;
  p.beats = [
    { id: "weaker", time: land, enabled: true, accent: false, strength: 0.22 },
    {
      id: "kick",
      time: land + 0.19,
      enabled: true,
      accent: true,
      strength: 0.95,
    },
  ];
  expect(align(p, "strong").project.moves[0].effect.landingBeat).toBe("kick");
  expect(align(p, "all").project.moves[0].effect.landingBeat).toBe("weaker");
  p.moves[0].effect.landingBeat = "weaker";
  expect(align(p, "strong").project.moves[0].effect.landingBeat).toBe("weaker");
});

it("filters flashes by sensitivity and keeps the strongest nearby strict accent", () => {
  const p = blank();
  p.beats = [
    { id: "hat", time: 0.1, strength: 0.25, accent: false, enabled: true },
    { id: "snare", time: 0.5, strength: 0.65, accent: false, enabled: true },
    {
      id: "quiet-accent",
      time: 1,
      strength: 0.81,
      accent: true,
      enabled: true,
    },
    {
      id: "smaller-kick",
      time: 1.5,
      strength: 0.93,
      accent: true,
      enabled: true,
    },
    { id: "kick", time: 1.7, strength: 1, accent: true, enabled: true },
    {
      id: "next-kick",
      time: 2.25,
      strength: 0.96,
      accent: true,
      enabled: true,
    },
  ];
  const pulses = () => selectBoardPulses(p, "source").map((beat) => beat.id);
  expect(pulses()).toHaveLength(6);
  p.pulse.accentsOnly = true;
  expect(pulseSensitivity(parseProject(p))).toBe("accents");
  expect(pulses()).toHaveLength(4);
  p.pulse.sensitivity = "balanced";
  expect(pulses()).toHaveLength(5);
  p.pulse.sensitivity = "strict";
  expect(pulses()).toEqual(["kick", "next-kick"]);

  setPulseOverride(p, "source", "kick", "off");
  setPulseOverride(p, "source", "hat", "on");
  expect(pulses()).toEqual(["hat", "smaller-kick", "next-kick"]);
  expect(activeBeats(p)).toHaveLength(6);
  const saved = parseProject(p);
  saved.pulse.enabled = true;
  saved.tail = 3;
  expect(evaluate(saved, 0.1).pulse).toBe(saved.pulse.intensity);
  expect(
    evaluate(saved, 1.7, undefined, undefined, compileTimeline(saved)).pulse,
  ).toBe(evaluate(saved, 1.7).pulse);
  setPulseOverride(p, "source", "kick", "auto");
  expect(pulses()).toEqual(["hat", "kick", "next-kick"]);
});

it("keeps a per-flash edit through reanalysis even if a hit briefly disappears", () => {
  const p = blank();
  const analysis = {
    peaks: [{ time: 0.5, accent: true, strength: 0.95 }],
    waveform: [1],
    waveformRms: [0.2],
  };
  updateMusicAnalysis(p, analysis);
  const { id } = p.beats[0];
  setPulseOverride(p, "source", id, "off");
  updateMusicAnalysis(p, { ...analysis, peaks: [] });
  updateMusicAnalysis(p, {
    ...analysis,
    peaks: [{ ...analysis.peaks[0], time: 0.52 }],
  });
  expect(activeBeats(parseProject(p))).toEqual([
    expect.objectContaining({
      id,
      time: 0.5,
      enabled: true,
      pulseOverride: "off",
    }),
  ]);
});
