import { z } from "zod";
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
export const captionSettings = z.object({
  placement: z
    .enum([
      "standard",
      "lower-third",
      "upper-caption",
      "centered-title",
      "social-safe",
    ])
    .default("standard"),
  maxWidth: finite(0.1, 1).default(0.88),
  maxLines: z.number().int().min(1).max(20).default(3),
  minSize: finite(12, 160).default(28),
  autoSize: z.boolean().default(true),
  scale: finite(0.5, 2).default(1),
  lineSpacing: finite(1, 2).default(1.3),
  weight: z.number().int().min(100).max(900).default(600),
  customMargins: z.boolean().default(false),
  top: finite(0, 0.45).default(0.06),
  bottom: finite(0, 0.45).default(0.12),
  left: finite(0, 0.4).default(0.06),
  right: finite(0, 0.4).default(0.06),
});
export const annotationSchema = z
  .object({
    id: z.string().max(100),
    kind: z.enum(["arrow", "circle", "text", "caption"]),
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    text: z.string().max(500),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    background: z.string().regex(/^#[0-9a-f]{6}$/i),
    width: finite(0.02, 0.3),
    opacity: finite(0, 1),
    start: finite(0, 86400),
    end: finite(0, 86400),
    fade: finite(0, 5),
    entrance: z.enum(["fade", "pop", "none"]),
    exit: z.enum(["fade", "none"]),
    x: finite(0, 1),
    y: finite(0, 1),
    size: finite(12, 160),
    font: z.enum(["sans-serif", "serif", "monospace"]),
    align: z.enum(["left", "center", "right"]),
    outline: z.boolean(),
    shadow: z.boolean(),
    layout: captionSettings.prefault({}),
  })
  .refine((a) => a.end > a.start, {
    message: "Annotation end must follow its start",
  });
export type Annotation = z.infer<typeof annotationSchema>;
export function annotationOpacity(a: Annotation, time: number) {
  if (time < a.start || time >= a.end) return 0;
  const ramp = (n: number) =>
    a.fade === 0 ? 1 : Math.min(1, Math.max(0, n / a.fade));
  return (
    a.opacity *
    (a.entrance === "none" ? 1 : ramp(time - a.start)) *
    (a.exit === "none" ? 1 : ramp(a.end - time))
  );
}
export function annotation(
  kind: Annotation["kind"],
  start: number,
): Annotation {
  return {
    id: crypto.randomUUID(),
    kind,
    from: "e2",
    to: "e4",
    text: kind === "caption" ? "Find the winning move!" : "Watch this square",
    color: "#c8e79c",
    background: "#173322",
    width: 0.09,
    opacity: 1,
    start,
    end: start + 3,
    fade: 0.25,
    entrance: "fade",
    exit: "fade",
    x: 0.5,
    y: 0.15,
    size: 48,
    font: "sans-serif",
    align: "center",
    outline: true,
    shadow: true,
    layout: captionSettings.parse({}),
  };
}
