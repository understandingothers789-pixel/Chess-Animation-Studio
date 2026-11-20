import { expect, it } from "vitest";
import { editableSamples } from "../src/core/curveSamples";
import { effect } from "../src/core/project";
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
