import type { Annotation } from "../annotations";
export type TextRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
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
