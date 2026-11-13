import { expect, it } from "vitest";
import {
  positionText,
  resizeTextWidth,
  textResizeSide,
} from "../src/core/captions/manipulation";
import { annotation } from "../src/core/annotations";
import { layoutCaption } from "../src/core/captions/layout";
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
it("keeps a resize handle reachable when the wrapping area extends outside the frame", () => {
  for (const align of ["left", "center", "right"] as const) {
    const a = annotation("caption", 0);
    a.align = align;
    a.layout.maxWidth = 0.5;
    const right = textResizeSide(a, { areaLeft: -0.2, areaRight: 0.3 });
    expect(right).toBe("right");
    expect(resizeTextWidth(a, 0.88, 0.01, 1, right)).toBeGreaterThan(0.5);
    const left = textResizeSide(a, { areaLeft: 0.7, areaRight: 1.2 });
    expect(left).toBe("left");
    expect(resizeTextWidth(a, 0.88, -0.01, 1, left)).toBeGreaterThan(0.5);
  }
});
it("resizes the wrapping area without collapsing short text or changing font settings", () => {
  const measure = (text: string, size: number) => text.length * size * 0.5;
  for (const align of ["left", "center", "right"] as const) {
    const a = annotation("caption", 0);
    a.text = "Hi";
    a.align = align;
    a.layout.maxWidth = 0.6;
    const before = structuredClone(a);
    const layout = layoutCaption(a, 1080, 1920, "vertical", measure);
    expect(layout.area.right - layout.area.left).toBeCloseTo(648);
    expect(layout.bounds.width).toBeLessThan(100);
    expect(resizeTextWidth(a, 0.88, 0)).toBe(0.6);
    const dx = align === "right" ? -0.01 : 0.01;
    expect(resizeTextWidth(a, 0.88, dx)).toBeCloseTo(
      align === "center" ? 0.62 : 0.61,
    );
    // Entrance scaling changes pointer-space deltas, not stored dimensions.
    expect(resizeTextWidth(a, 0.88, dx / 2, 0.5)).toBeCloseTo(
      resizeTextWidth(a, 0.88, dx),
    );
    expect(a).toEqual(before);
  }
});
it("respects safe-width caps and minimums while widening rewraps all content", () => {
  const a = annotation("caption", 0);
  a.layout.autoSize = false;
  a.layout.maxWidth = 1;
  expect(resizeTextWidth(a, 0.7, 0.01)).toBe(1);
  expect(resizeTextWidth(a, 0.7, -0.01)).toBeCloseTo(0.68);
  expect(resizeTextWidth(a, 0.7, -10)).toBe(0.1);
  a.layout.maxWidth = 0.2;
  a.text = "This sacrifice wins the queen!";
  const measure = (text: string, size: number) => text.length * size * 0.5;
  const narrow = layoutCaption(a, 1080, 1920, "vertical", measure);
  a.layout.maxWidth = resizeTextWidth(a, 0.88, 0.2);
  const wide = layoutCaption(a, 1080, 1920, "vertical", measure);
  expect(wide.lines.length).toBeLessThan(narrow.lines.length);
  expect(wide.lines.join(" ")).toBe(a.text);
  expect(wide.fontSize).toBe(narrow.fontSize);
});
