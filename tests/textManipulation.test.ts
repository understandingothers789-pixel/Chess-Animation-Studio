import { expect, it } from "vitest";
import { positionText } from "../src/core/captions/manipulation";
const rect = { left: 0.3, right: 0.5, top: 0.25, bottom: 0.35 },
  safe = { left: 0.06, right: 0.94, top: 0.06, bottom: 0.88 };
it("centers the visible rectangle for every text alignment", () => {
  for (const [align, x] of [
    ["left", 0.4],
    ["center", 0.5],
    ["right", 0.6],
  ] as const) {
    const p = positionText(rect, safe, 0.105, 0.2, align);
    expect(p.x).toBeCloseTo(x);
    expect(p.y).toBeCloseTo(0.5);
  }
});
it("snaps actual edges to safe margins and Alt bypass preserves exact movement", () => {
  const snap = positionText(rect, safe, -0.23, 0.2, "left");
  expect(snap.x).toBeCloseTo(0.06);
  const free = positionText(rect, safe, -0.23, 0.2, "left", false);
  expect(free.x).toBeCloseTo(0.07);
  const right = positionText(rect, safe, 0.431, 0, "right");
  expect(right.x).toBeCloseTo(0.94);
});
it("keeps output anchors valid at extreme pointer deltas", () => {
  expect(positionText(rect, safe, -9, -9, "center", false)).toEqual({
    x: 0,
    y: 0,
  });
  expect(positionText(rect, safe, 9, 9, "right", false)).toEqual({
    x: 1,
    y: 1,
  });
});
