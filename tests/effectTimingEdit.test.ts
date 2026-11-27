import { audioEvents } from "../src/core/audioEvents";
import { expect, it } from "vitest";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { segments, spotlightPeaks, spotlightStart } from "../src/core/timeline";
import {
  alignMoveEvent,
  moveBeatEvents,
  type MoveBeatEvent,
} from "../src/ui/movePreview";
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

it("syncs eligible landing, capture, zoom and after-effect events to exact hit times", () => {
  const p = importPgn(blank(), "1. e4 d5 2. exd5");
  p.audio.automatic = true;
  const effect = p.moves[2].effect;
  effect.after.kind = "rebound";
  effect.jam.enabled = true;
  effect.jam.rhythm = "alternate";
  const seek = (id: MoveBeatEvent) =>
    moveBeatEvents(p, 2).find((event) => event.id === id)!;
  for (const id of ["landing", "capture", "zoom", "after"] as const) {
    const original = seek(id);
    const time =
      original.min + Math.min(0.2, (original.max - original.min) / 2);
    p.beats.push({ id, time, enabled: true, accent: true });
    const moved = alignMoveEvent(p, 2, id, id, time);
    expect(moved).not.toBeNull();
    p.moves[2].effect = moved!;
    expect(seek(id)).toMatchObject({ beat: id });
    expect(seek(id).time).toBeCloseTo(time, 9);
  }
  const cue = audioEvents(p).find((event) => event.kind === "capture");
  expect(cue?.at).toBeCloseTo(seek("capture").time, 9);
  expect(alignMoveEvent(p, 2, "capture", "off", 0)).toBeNull();
  p.moves[2].effect.locked = true;
  expect(alignMoveEvent(p, 2, "after", "after", seek("after").time)).toBeNull();
});
