import { expect, it } from "vitest";
import { editableSamples } from "../src/core/curveSamples";
import { importPgn } from "../src/core/chess";
import { changeMoves } from "../src/ui/state";
import { blank, effect } from "../src/core/project";
import { applyPresetEffect } from "../src/core/editing";
import { curve } from "../src/core/timeline";
it("reduces a straight preset curve to two points and bounds sampled error", () => {
  expect(
    editableSamples(
      Array.from({ length: 33 }, (_, i) => i / 32),
      0.002,
    ),
  ).toHaveLength(2);
  const values = Array.from(
    { length: 33 },
    (_, i) => Math.sin((i / 32) * Math.PI) * 360,
  );
  const keys = editableSamples(values, 0.25);
  values.forEach((v, i) =>
    expect(Math.abs(curve(keys, i / 32, 0) - v)).toBeLessThanOrEqual(0.250001),
  );
});
it("preset categories and curve replacement preserve locked timing", () => {
  const target = effect("hop");
  target.locked = true;
  target.duration = 2;
  target.keys.rz = [{ at: 0, value: 25, ease: "linear" }];
  const source = effect("somersault");
  source.light.enabled = true;
  const effects = applyPresetEffect(
    target,
    source,
    "landscape",
    false,
    "effects",
    false,
  );
  expect(effects.preset).toBe("hop");
  expect(effects.light.enabled).toBe(true);
  expect(effects.duration).toBe(2);
  expect(effects.keys.rz).toEqual(target.keys.rz);
  const movement = applyPresetEffect(
    target,
    source,
    "landscape",
    false,
    "movement",
    false,
  );
  expect(movement.preset).toBe("somersault");
  expect(movement.keys.rz).toBeUndefined();
  expect(movement.duration).toBe(2);
});

it("edits a selected move with shared history data and preserves timing locks", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
  const original = p.moves[1];
  const targets = new Set([original.id]);
  original.effect.locked = true;
  expect(changeMoves(p, targets, () => {})).toBe(p);
  const next = changeMoves(p, targets, (move) => {
    move.effect.rotation = 180;
    move.effect.duration = 24;
  });
  expect(next.moves[1].effect.rotation).toBe(180);
  expect(next.moves[1].effect.duration).toBe(original.effect.duration);
  expect(p.moves[1].effect.rotation).not.toBe(180);
  expect(next.moves[0]).toBe(p.moves[0]);
  expect(next.lines).toBe(p.lines);
  expect(next.storyboard).toBe(p.storyboard);
});
