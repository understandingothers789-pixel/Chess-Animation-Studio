import { it, expect } from "vitest";
import { blank, camera } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { annotation } from "../src/core/annotations";
import { segments, evaluate } from "../src/core/timeline";
import {
  shotFromMove,
  titleShot,
  resolveStoryboardFrame,
} from "../src/core/storyboard";
import { evaluatePresentationFrame } from "../src/render/engine/presentation";
const make = () =>
  importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6");
it("reuses source animation frames at mapped timestamps and never plays excluded intermediate moves", () => {
  const p = make(),
    s = shotFromMove(p, p.moves[6].id);
  s.duration = 4;
  p.storyboard.shots = [s, shotFromMove(p, p.moves[0].id)];
  for (const t of [0, 0.1, 1.5, 3.99, 4, 4.2, 0, 3]) {
    const mapped = resolveStoryboardFrame(p, t)!,
      actual = evaluatePresentationFrame(
        p,
        t,
        640,
        360,
        undefined,
        "storyboard",
      );
    const expected = evaluate(p, mapped.sourceTime);
    expect(actual.e.pieces).toEqual(expected.pieces);
    expect(actual.e.camera).toEqual(expected.camera);
    expect(actual.p.moves.map((m) => m.id)).toEqual([
      mapped.shot.source!.startMoveId,
    ]);
  }
});
it("keeps stable legal holds, independent camera settings and local captions across out-of-order requests", () => {
  const p = make(),
    s = shotFromMove(p, p.moves[6].id, "position-hold", "after");
  s.duration = 5;
  s.camera = { ...camera(), mode: "manual", zoom: 1.8 };
  const ann = { ...annotation("caption", 1), end: 4, text: "Look at the file" };
  s.annotations = [ann];
  p.annotations = [annotation("text", 0)];
  p.storyboard.shots = [s];
  const a = evaluatePresentationFrame(p, 1, 640, 360, undefined, "storyboard"),
    b = evaluatePresentationFrame(p, 4.9, 640, 360, undefined, "storyboard");
  expect(a.e.pieces).toEqual(b.e.pieces);
  expect(a.e.pieces.every((piece) => !piece.moving)).toBe(true);
  expect(a.p.annotations).toEqual([ann]);
  expect(a.annotationTime).toBe(1);
  expect(b.annotationTime).toBe(4.9);
  expect(a.e.camera.zoom).toBe(1.8);
  expect(p.moves[6].effect.cameras.landscape).toBeUndefined();
});
it("uses output-domain soundtrack beats and distinct title/repair frames", () => {
  const p = make(),
    s = shotFromMove(p, p.moves[6].id);
  p.pulse.enabled = true;
  p.storyboard.shots = [s];
  p.storyboard.beats = [{ id: "out", time: 0.4, enabled: true, accent: false }];
  p.beats = [
    { id: "source", time: segments(p)[6].start, enabled: true, accent: false },
  ];
  expect(
    evaluatePresentationFrame(p, 0.4, 640, 360, undefined, "storyboard").e
      .pulse,
  ).toBe(p.pulse.intensity);
  const title = {
    ...p,
    storyboard: { ...p.storyboard, shots: [titleShot(p, "Find the move", 3)] },
  };
  expect(
    evaluatePresentationFrame(title, 1, 360, 640, "vertical", "storyboard")
      .titleCard,
  ).toBe(true);
  const invalid = {
    ...p,
    storyboard: {
      ...p.storyboard,
      shots: [{ ...s, source: { ...s.source!, startMoveId: "missing" } }],
    },
  };
  const c = evaluatePresentationFrame(
    invalid,
    0,
    640,
    360,
    undefined,
    "storyboard",
  );
  expect(c.titleCard).toBe(true);
  expect(c.e.pieces).toEqual([]);
  expect(c.p.annotations[0].text).toMatch(/missing/);
});
