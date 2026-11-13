import type { Annotation } from "../annotations";
export type TextRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
/** Resize the configured wrapping area, not the measured width of its words.
 * Center-aligned text expands on both sides; right-aligned text uses its left
 * handle. Work from the effective safe width so a capped area has no dead zone. */
export function resizeTextWidth(
  a: Annotation,
  safeWidth: number,
  dx: number,
  scale = 1,
  side: "left" | "right" = a.align === "right" ? "left" : "right",
) {
  const base = Math.min(a.layout.maxWidth, safeWidth);
  const factor = (a.align === "center" ? 2 : 1) * (side === "left" ? -1 : 1);
  const next = Math.max(0.1, Math.min(safeWidth, base + (dx * factor) / scale));
  return next === base ? a.layout.maxWidth : next;
}
/** Prefer the aligned handle, but keep one reachable inside the output frame. */
export function textResizeSide(
  a: Annotation,
  area: { areaLeft: number; areaRight: number },
) {
  if (a.align === "right") return area.areaLeft >= 0 ? "left" : "right";
  return area.areaRight <= 1 ? "right" : "left";
}
/** Snap the visible rectangle, then recover the renderer's alignment anchor.
 * Inputs are fractions of the output frame, independent of preview transforms. */
export function positionText(
  b: TextRect,
  safe: TextRect,
  dx: number,
  dy: number,
  align: Annotation["align"],
  snap = true,
) {
  const w = b.right - b.left,
    h = b.bottom - b.top;
  const near = (v: number, targets: number[]) =>
    snap ? (targets.find((n) => Math.abs(n - v) < 0.012) ?? v) : v;
  const left = near(b.left + dx, [0.5 - w / 2, safe.left, safe.right - w]);
  const top = near(b.top + dy, [0.5 - h / 2, safe.top, safe.bottom - h]);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    x: clamp(left + w * (align === "left" ? 0 : align === "right" ? 1 : 0.5)),
    y: clamp(top + h / 2),
  };
}
