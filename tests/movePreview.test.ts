import { describe, it, expect } from "vitest";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { movePreviewWindow } from "../src/ui/movePreview";
describe("selected-move audition timing", () => {
  it("includes the authored delay and hold without adding capture tails to ordinary moves", () => {
    const p = importPgn(blank(), "1. e4 d5 2. exd5");
    p.lead = 1;
    p.cinematic.enabled = true;
    p.cinematic.duration = 3;
    Object.assign(p.moves[0].effect, { delay: 0.2, duration: 1, hold: 0.3 });
    expect(movePreviewWindow(p, 0)).toEqual({ start: 1, end: 2.5 });
  });
  it("plays the global capture tail using the move's impact time", () => {
    const p = importPgn(blank(), "1. e4 d5 2. exd5");
    p.lead = 1;
    p.tail = 5;
    for (const m of p.moves) {
      Object.assign(m.effect, { delay: 0, duration: 1, hold: 0 });
      m.effect.jam.enabled = false;
    }
    p.moves[2].effect.capture.impact = 0.5;
    p.cinematic.enabled = true;
    p.cinematic.duration = 2;
    expect(movePreviewWindow(p, 2)).toEqual({ start: 3, end: 5.5 });
    p.tail = 0;
    expect(movePreviewWindow(p, 2)?.end).toBe(4);
  });
  it("returns no audition for a missing move and leaves project data unchanged", () => {
    const p = importPgn(blank(), "1. e4");
    const before = JSON.stringify(p);
    expect(movePreviewWindow(p, 99)).toBeNull();
    movePreviewWindow(p, 0);
    expect(JSON.stringify(p)).toBe(before);
  });
});
