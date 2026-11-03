import { formats, sizes, type Project } from "./project";
import { duration } from "./timeline";
import type { ExportOptions } from "../bridge";
export function validateExport(p: Project, o: ExportOptions) {
  if (
    !formats.includes(o.format) ||
    !Number.isFinite(o.start) ||
    !Number.isFinite(o.end) ||
    o.start < 0 ||
    o.end <= o.start ||
    o.end > duration(p) + 0.001
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
    w > 4096 ||
    h > 4096 ||
    w % 2 ||
    h % 2
  )
    throw Error("Export dimensions must be even numbers between 64 and 4096.");
  // Allow even-pixel rounding for custom output sizes.
  if (Math.abs(w / h - bw / bh) > 2 / h)
    throw Error("Export dimensions must match the composition aspect ratio.");
  return { ...o, width: w, height: h, fps: o.fps ?? 60 };
}
