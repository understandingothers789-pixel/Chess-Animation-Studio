import type { Format } from "../project";
export const placements = [
  "standard",
  "lower-third",
  "upper-caption",
  "centered-title",
  "social-safe",
] as const;
export type Placement = (typeof placements)[number];
export function safeDefaults(format: Format, preset: Placement) {
  const vertical = format === "vertical" || format === "square-in-vertical";
  return {
    top: preset === "social-safe" ? 0.12 : 0.06,
    bottom: preset === "social-safe" ? 0.22 : vertical ? 0.12 : 0.06,
    left: 0.06,
    right: preset === "social-safe" ? 0.16 : 0.06,
    maxWidth: vertical ? 0.88 : 0.8,
    y:
      preset === "lower-third"
        ? 0.82
        : preset === "centered-title"
          ? 0.5
          : 0.18,
  };
}
export function safeRect(
  w: number,
  h: number,
  margins: { top: number; bottom: number; left: number; right: number },
) {
  return {
    x: w * margins.left,
    y: h * margins.top,
    width: Math.max(1, w * (1 - margins.left - margins.right)),
    height: Math.max(1, h * (1 - margins.top - margins.bottom)),
  };
}
