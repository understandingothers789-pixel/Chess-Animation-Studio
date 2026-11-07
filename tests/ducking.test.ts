import { it, expect } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { titleShot, duplicateShot, reorderShot } from "../src/core/storyboard";
import {
  storyboardDuckGain as gain,
  storyboardDuckEnvelope,
} from "../src/core/audio/ducking";
import { soundtrackGain } from "../src/core/audio/timing";
import { audioEvents } from "../src/core/audioEvents";
function fixture() {
  const p = blank();
  p.storyboard.shots = ["A", "B", "C", "D"].map((n) => titleShot(p, n, 1));
  p.storyboard.shots[1].musicDucking = {
    enabled: true,
    volume: 0.25,
    fadeDown: 0.2,
    fadeUp: 0.4,
  };
  p.storyboard.shots[2].musicDucking = {
    enabled: true,
    volume: 0.5,
    fadeDown: 0.2,
    fadeUp: 0.4,
  };
  return p;
}
it("is continuous at boundaries and transitions directly between adjacent duck levels", () => {
  const p = fixture();
  expect(gain(p, 0.5)).toBe(1);
  expect(gain(p, 1.1)).toBeCloseTo(0.625);
  expect(gain(p, 1.5)).toBe(0.25);
  expect(gain(p, 2)).toBe(0.25);
  expect(gain(p, 2.2)).toBeCloseTo(0.375);
  expect(gain(p, 2.5)).toBe(0.5);
  expect(gain(p, 3.2)).toBeCloseTo(0.75);
  expect(gain(p, 3.5)).toBe(1);
  for (const t of [1, 1.2, 2, 2.4, 3, 3.4])
    expect(Math.abs(gain(p, t - 1e-7) - gain(p, t + 1e-7))).toBeLessThan(
      0.00001,
    );
});
it("handles beginning, final and very short shots with interrupted ramps", () => {
  const p = fixture();
  p.storyboard.shots = p.storyboard.shots.slice(1, 3);
  p.storyboard.shots[0].duration = 0.1;
  p.storyboard.shots[1].duration = 0.1;
  expect(gain(p, 0)).toBe(1);
  expect(gain(p, 0.1)).toBeCloseTo(0.625);
  expect(gain(p, 0.2)).toBeLessThan(0.625);
  expect(gain(p, 0.6)).toBeCloseTo(1);
  expect(
    storyboardDuckEnvelope(p).every((v, i, a) => !i || v.time > a[i - 1].time),
  ).toBe(true);
});
it("persists independent duplicates and evaluates reordered output rather than source time", () => {
  const p = fixture(),
    copy = duplicateShot(p.storyboard.shots[1]);
  copy.musicDucking.volume = 0.1;
  p.storyboard.shots.push(copy);
  reorderShot(p.storyboard.shots, copy.id, p.storyboard.shots[0].id);
  const reopened = parseProject(JSON.parse(JSON.stringify(p)));
  expect(reopened.storyboard.shots[0].musicDucking.volume).toBe(0.1);
  expect(gain(reopened, 0.5)).toBeCloseTo(0.1);
  expect(reopened.storyboard.shots[2].musicDucking.volume).toBe(0.25);
});
it("multiplies existing automation/fades only in storyboard mode and leaves chess cues unchanged", () => {
  const p = fixture();
  p.music.sourceDuration = 8;
  p.music.volumePoints = [
    { time: 0, value: 0.8 },
    { time: 4, value: 0.4 },
  ];
  p.music.fadeIn = 3;
  p.music.fadeOut = 2;
  expect(soundtrackGain(p, 1.5, 4, "storyboard")).toBeCloseTo(
    soundtrackGain(p, 1.5, 4) * 0.25,
  );
  const before = audioEvents(p, "storyboard");
  const off = structuredClone(p);
  off.storyboard.shots.forEach((s) => (s.musicDucking.enabled = false));
  expect(audioEvents(off, "storyboard")).toEqual(before);
  expect(gain(off, 1.5)).toBe(1);
  p.music.muted = true;
  expect(soundtrackGain(p, 1.5, 4, "storyboard")).toBe(0);
});
