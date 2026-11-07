import type { Annotation } from "../annotations";
import type { Format } from "../project";
import { safeDefaults, type Placement } from "./safeAreas";
export const captionPresets = [
  "Clean Tutorial",
  "Tactical Highlight",
  "Bold Short",
  "Minimal Subtitle",
  "Cinematic Title",
] as const;
export function applyCaptionPreset(
  a: Annotation,
  name: (typeof captionPresets)[number],
  format: Format,
): Annotation {
  const placement: Placement =
    name === "Cinematic Title"
      ? "centered-title"
      : name === "Minimal Subtitle"
        ? "lower-third"
        : name === "Bold Short"
          ? "social-safe"
          : "upper-caption";
  return {
    ...a,
    x: 0.5,
    y: safeDefaults(format, placement).y,
    size: name === "Bold Short" ? 64 : name === "Minimal Subtitle" ? 36 : 48,
    font: name === "Cinematic Title" ? "serif" : "sans-serif",
    align: "center",
    color: "#f3f7ed",
    background: "#173322",
    outline: true,
    shadow: true,
    layout: {
      ...a.layout,
      placement,
      maxWidth: safeDefaults(format, placement).maxWidth,
      maxLines: 3,
      autoSize: true,
      customMargins: false,
    },
  };
}
