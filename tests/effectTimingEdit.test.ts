import { expect, it } from "vitest";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { segments, spotlightPeaks, spotlightStart } from "../src/core/timeline";
import { proposeTiming } from "../src/ui/effectTimingEdit";

it("proposes a shorter meme without moving its assigned landing beat", () => {
  const p = importPgn(blank(), "1. e4 e5");
  const fx = p.moves[0].effect;
  fx.preMoveMeme = { asset: "meme", duration: 0.8 };
  fx.delay = 0;
  fx.landingBeat = "hit";
  const previous = segments(p)[0];
  p.beats = [{ id: "hit", enabled: true, accent: false, time: previous.land }];
  const choice = proposeTiming(p, 0, "meme", 0.3, "hit", null)!;
  expect(p.moves[0].effect.preMoveMeme?.duration).toBe(0.8);
  expect(choice.effect.preMoveMeme?.duration).toBe(0.3);
  expect(segments(choice.next)[0].land).toBeCloseTo(previous.land, 8);
  expect(segments(choice.next)[1].start - segments(p)[1].start).toBeCloseTo(
    choice.shift,
    8,
  );
});

it("pins a beat zoom pulse to the selected marker even with one marker", () => {
  const p = importPgn(blank(), "1. e4");
  const fx = p.moves[0].effect;
  fx.jam.enabled = true;
  const start = spotlightStart(fx, segments(p)[0]);
  p.beats = [
    { id: "earlier", enabled: true, accent: false, time: start + 0.12 },
    { id: "chosen", enabled: true, accent: true, time: start + 0.24 },
  ];
  const choice = proposeTiming(p, 0, "spotlight", 1.2, null, "chosen")!;
  expect(spotlightPeaks(choice.next, choice.effect, start)).toEqual([
    { time: start + 0.24, clock: "Music marker" },
  ]);
});
