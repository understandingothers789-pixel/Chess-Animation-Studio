import type { Project } from "./project";
import { ease } from "./timeline";

export const introFilm = {
  fps: 24,
  seconds: 3,
  columns: 8,
  rows: 9,
  cell: 384,
};

export function squareVideoEnd(p: Project) {
  const clip = p.squareIntro;
  return clip?.asset ? Math.min(p.lead, clip.hold + clip.pullback) : 0;
}

export function squareVideoFrame(p: Project, time: number) {
  const end = squareVideoEnd(p);
  const clip = p.squareIntro;
  if (!clip?.asset || time >= end) return null;
  const pullback = Math.min(clip.pullback, end);
  const progress = ease((time - (end - pullback)) / pullback);
  const frame = Math.min(
    introFilm.fps * introFilm.seconds - 1,
    Math.floor(time * introFilm.fps),
  );
  return {
    asset: clip.asset,
    square: clip.square,
    progress,
    opacity: 1 - ease((progress - 0.28) / 0.72),
    column: frame % introFilm.columns,
    row: Math.floor(frame / introFilm.columns),
  };
}
