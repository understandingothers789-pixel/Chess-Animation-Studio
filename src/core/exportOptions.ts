import { presentationDuration, validateStoryboardExport } from "./storyboard";
export const MAX_EXPORT_DIMENSION = 4096;
import { formats, sizes, type Project } from "./project";
import { duration } from "./timeline";
import type { ExportOptions } from "../bridge";
export function validateExport(p: Project, o: ExportOptions) {
  if (o.mode !== undefined && !["source", "storyboard"].includes(o.mode))
    throw Error("Invalid output mode.");
  if (o.mode === "storyboard") validateStoryboardExport(p);
  if (
    !formats.includes(o.format) ||
    !Number.isFinite(o.start) ||
    !Number.isFinite(o.end) ||
    o.start < 0 ||
    o.end <= o.start ||
    o.end > presentationDuration(p, o.mode) + 0.001
  )
    throw Error("Invalid export range.");
  if (![24, 30, 60].includes(o.fps ?? 60))
    throw Error("Choose 24, 30 or 60 FPS.");
  const [bw, bh] = sizes[o.format],
    w = o.width ?? bw,
    h = o.height ?? bh;
  if (
    !Number.isInteger(w) ||
    !Number.isInteger(h) ||
    w < 64 ||
    h < 64 ||
    w > MAX_EXPORT_DIMENSION ||
    h > MAX_EXPORT_DIMENSION ||
    w % 2 ||
    h % 2
  )
    throw Error("Export dimensions must be even numbers between 64 and 4096.");
  // Allow even-pixel rounding for custom output sizes.
  if (Math.abs(w / h - bw / bh) > 2 / h)
    throw Error("Export dimensions must match the composition aspect ratio.");
  return { ...o, width: w, height: h, fps: o.fps ?? 60 };
}
