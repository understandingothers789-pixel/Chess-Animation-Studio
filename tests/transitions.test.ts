import { it, expect } from "vitest";
import { blank, parseProject, storyboardShotSchema } from "../src/core/project";
import { titleShot, resizeShot, duplicateShot } from "../src/core/storyboard";
import { transitionAt } from "../src/core/transitions";
import { storyboardDuckEnvelope } from "../src/core/audio/ducking";
import { audioEvents } from "../src/core/audioEvents";
function fixture() {
  const p = blank();
  p.storyboard.shots = [
    titleShot(p, "A", 1),
    titleShot(p, "B", 1),
    titleShot(p, "C", 0.1),
  ];
  return p;
}
it("cuts by default and ignores a first-shot transition", () => {
  const p = fixture();
  p.storyboard.shots[0].transition = {
    type: "cross-dissolve",
    duration: 0.5,
    easing: "linear",
  };
  expect(transitionAt(p, 0.2)).toBeNull();
  expect(transitionAt(p, 1)).toBeNull();
});
it("evaluates exact boundary, midpoint, end and out-of-order seeks without history", () => {
  const p = fixture();
  p.storyboard.shots[1].transition = {
    type: "cross-dissolve",
    duration: 0.4,
    easing: "linear",
  };
  for (const t of [1.2, 1, 1.3, 1.2]) {
    const e = transitionAt(p, t)!;
    expect(e.progress).toBeCloseTo((t - 1) / 0.4);
    expect(e.outgoing + e.incoming).toBeCloseTo(1);
    expect(e.previousTime).toBeLessThan(1);
  }
  expect(transitionAt(p, 1.4)).toBeNull();
});
it("fades through actual black and smooth easing preserves endpoints", () => {
  const p = fixture();
  p.storyboard.shots[1].transition = {
    type: "fade-through-black",
    duration: 0.4,
    easing: "smooth",
  };
  const mid = transitionAt(p, 1.2)!;
  expect(mid.incoming).toBeCloseTo(0);
  expect(mid.outgoing).toBeCloseTo(0);
  expect(transitionAt(p, 1)!.outgoing).toBe(1);
  expect(transitionAt(p, 1.3)!.incoming).toBeGreaterThan(0.5);
});
it("handles zero duration, short shots, resizing and persistence with validation", () => {
  const p = fixture(),
    s = p.storyboard.shots[2];
  s.transition = { type: "cross-dissolve", duration: 0, easing: "linear" };
  expect(transitionAt(p, 2)).toBeNull();
  s.transition.duration = 0.1;
  expect(transitionAt(p, 2.05)!.progress).toBeCloseTo(0.5);
  const bad = { ...s, transition: { ...s.transition, duration: 2 } };
  expect(storyboardShotSchema.safeParse(bad).success).toBe(false);
  s.transition.duration = -1;
  expect(storyboardShotSchema.safeParse(s).success).toBe(false);
  s.transition.duration = 0.1;
  resizeShot(p.storyboard.shots[1], 0.2);
  const copy = duplicateShot(s);
  copy.transition.duration = 0.05;
  expect(s.transition.duration).toBe(0.1);
  expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
});
it("does not alter music ducking or event timing", () => {
  const p = fixture();
  p.storyboard.shots[1].musicDucking.enabled = true;
  const before = storyboardDuckEnvelope(p),
    events = audioEvents(p, "storyboard");
  const next = structuredClone(p);
  next.storyboard.shots[1].transition = {
    type: "cross-dissolve",
    duration: 0.5,
    easing: "linear",
  };
  expect(storyboardDuckEnvelope(next)).toEqual(before);
  expect(audioEvents(next, "storyboard")).toEqual(events);
});
