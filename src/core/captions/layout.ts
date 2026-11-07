import type { Annotation } from "../annotations";
import type { Format } from "../project";
import { safeDefaults, safeRect } from "./safeAreas";
export type CaptionLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  bounds: { x: number; y: number; width: number; height: number };
  safe: { x: number; y: number; width: number; height: number };
  overflow: boolean;
  x: number;
  y: number;
};
export type Measure = (
  text: string,
  size: number,
  font: string,
  weight: number,
) => number;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function wrap(text: string, width: number, measure: (s: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const token of paragraph.match(/\S+\s*/gu) ?? [""]) {
      const word = token.trimEnd();
      if (line && measure(line + " " + word) > width) {
        lines.push(line);
        line = "";
      }
      if (measure(word) > width) {
        for (const { segment } of segmenter.segment(word)) {
          if (line && measure(line + segment) > width) {
            lines.push(line);
            line = "";
          }
          line += segment;
        }
      } else line += (line ? " " : "") + word;
    }
    lines.push(line);
  }
  return lines;
}
/** Geometry is shared by rendering, guides, hit testing and production checks.
 * Sizes are reference pixels on the 1080px short side, so aspect changes retain readability.
 * Overflow retains every word and is reported, never truncated. */
export function layoutCaption(
  a: Annotation,
  w: number,
  h: number,
  format: Format,
  measure: Measure,
): CaptionLayout {
  const opts = a.layout,
    defaults = safeDefaults(format, opts.placement),
    safe = safeRect(w, h, opts.customMargins ? opts : defaults),
    scale = Math.min(w, h) / 1080,
    padding = 8 * scale,
    available = Math.max(
      1,
      Math.min(safe.width, w * opts.maxWidth) - 2 * padding,
    );
  let size = a.size * opts.scale * scale,
    min = Math.min(size, opts.minSize * scale),
    lines: string[] = [];
  for (;;) {
    lines = wrap(a.text, available, (t) =>
      measure(t, size, a.font, opts.weight),
    );
    if (
      !opts.autoSize ||
      (lines.length <= opts.maxLines &&
        lines.length * size * opts.lineSpacing + 2 * padding <= safe.height) ||
      size <= min
    )
      break;
    size = Math.max(min, size - scale);
  }
  const width =
      Math.max(0, ...lines.map((t) => measure(t, size, a.font, opts.weight))) +
      2 * padding,
    height = lines.length * size * opts.lineSpacing + 2 * padding,
    anchor = a.align === "left" ? 0 : a.align === "right" ? 1 : 0.5,
    left = Math.max(
      safe.x,
      Math.min(safe.x + safe.width - width, a.x * w - width * anchor),
    ),
    top = Math.max(
      safe.y,
      Math.min(safe.y + safe.height - height, a.y * h - height / 2),
    );
  return {
    lines,
    fontSize: size,
    lineHeight: size * opts.lineSpacing,
    safe,
    bounds: { x: left, y: top, width, height },
    x: left + padding + (width - 2 * padding) * anchor,
    y: top + height / 2,
    overflow:
      lines.length > opts.maxLines ||
      width > safe.width + 0.01 ||
      height > safe.height + 0.01,
  };
}
/** Bounded cache owned by its caller; fonts must be ready before measuring. */
export function captionCache(measure: Measure, limit = 256) {
  const cache = new Map<string, CaptionLayout>();
  return (a: Annotation, w: number, h: number, format: Format) => {
    const key = JSON.stringify([
      a.text,
      a.size,
      a.font,
      a.align,
      a.x,
      a.y,
      a.layout,
      w,
      h,
      format,
    ]);
    let value = cache.get(key);
    if (!value) {
      value = layoutCaption(a, w, h, format, measure);
      if (cache.size >= limit) cache.delete(cache.keys().next().value!);
      cache.set(key, value);
    }
    return value;
  };
}
