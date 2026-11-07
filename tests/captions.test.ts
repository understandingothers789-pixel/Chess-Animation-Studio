import { describe, it, expect } from "vitest";
import { annotation, annotationSchema } from "../src/core/annotations";
import { layoutCaption, captionCache } from "../src/core/captions/layout";
import { safeDefaults } from "../src/core/captions/safeAreas";
import { sizes } from "../src/core/project";
const measure = (t: string, s: number, f: string) =>
  [...t].length * s * (f === "monospace" ? 0.65 : 0.55);
describe("caption finishing geometry", () => {
  it("wraps all text, explicit newlines and graphemes without loss", () => {
    for (const text of [
      "Short",
      "Line one\nLine two",
      "A sacrifice looks losing until the queen is trapped.",
      "Supercalifragilisticexpialidocious".repeat(4),
      "Hello 👨‍👩‍👦 café 中文!",
    ]) {
      const a = annotation("caption", 0);
      a.text = text;
      a.layout.maxWidth = 0.25;
      const l = layoutCaption(a, 1080, 1920, "vertical", measure);
      expect(l.lines.join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
      expect(l.lines.some((t) => t.endsWith("\u200d"))).toBe(false);
    }
  });
  it("fits every format/resolution/alignment, warning instead of deleting overflow", () => {
    for (const [format, size] of Object.entries(sizes))
      for (const factor of [0.25, 1, 2])
        for (const align of ["left", "center", "right"] as const) {
          const a = annotation("caption", 0);
          a.align = align;
          a.x = 1;
          a.y = 1;
          a.text =
            "This bishop sacrifice looks completely losing until you notice the queen is trapped.";
          const l = layoutCaption(
            a,
            size[0] * factor,
            size[1] * factor,
            format as keyof typeof sizes,
            measure,
          );
          expect(l.overflow).toBe(false);
          expect(l.bounds.x + l.bounds.width).toBeLessThanOrEqual(
            l.safe.x + l.safe.width + 0.01,
          );
          expect(l.bounds.y + l.bounds.height).toBeLessThanOrEqual(
            l.safe.y + l.safe.height + 0.01,
          );
        }
    const a = annotation("caption", 0);
    a.text = "Very long caption ".repeat(25);
    a.layout.maxLines = 1;
    expect(layoutCaption(a, 1080, 1920, "vertical", measure).overflow).toBe(
      true,
    );
  });
  it("respects manual breaks, font measurement, min size and caches every layout input", () => {
    const a = annotation("caption", 0);
    a.text = "A\nB";
    const cached = captionCache(measure);
    expect(cached(a, 1080, 1920, "vertical").lines).toEqual(["A", "B"]);
    expect(cached(a, 1080, 1920, "vertical")).toBe(
      cached(a, 1080, 1920, "vertical"),
    );
    const b = structuredClone(a);
    b.font = "monospace";
    b.layout.maxWidth = 0.2;
    expect(cached(b, 1080, 1920, "vertical")).not.toBe(
      cached(a, 1080, 1920, "vertical"),
    );
    expect(annotationSchema.parse(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(safeDefaults("vertical", "social-safe").bottom).toBeGreaterThan(
      safeDefaults("landscape", "standard").bottom,
    );
  });
});
