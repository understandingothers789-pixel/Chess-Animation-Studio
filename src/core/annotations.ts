import { z } from "zod";
const finite = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
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
  };
}
