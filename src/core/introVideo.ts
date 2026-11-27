import type { Asset, Project } from "./project";
import { ease } from "./timeline";

export const introFilm = {
  fps: 24,
  seconds: 3,
  columns: 8,
  rows: 9,
  cell: 384,
};

export type FilmLayout = NonNullable<Asset["film"]>;
export function filmLayout(seconds: number, detail = false): FilmLayout {
  const fps = detail ? 30 : 24;
  const frames = Math.max(
    1,
    Math.round(Math.min(6, Math.max(0, seconds)) * fps),
  );
  const columns = Math.ceil(Math.sqrt(frames));
  const rows = Math.ceil(frames / columns);
  const cell = Math.min(
    detail ? 512 : 384,
    Math.floor(4096 / Math.max(columns, rows) / 16) * 16,
  );
  return { fps, frames, columns, rows, cell };
}
export function assetFilm(asset?: Asset): FilmLayout {
  return (
    asset?.film ?? { ...introFilm, frames: introFilm.fps * introFilm.seconds }
  );
}
export function filmPosition(film: FilmLayout, time: number, loop: boolean) {
  const i = Math.max(0, Math.floor(time * film.fps));
  const frame = loop ? i % film.frames : Math.min(i, film.frames - 1);
  return {
    column: frame % film.columns,
    row: Math.floor(frame / film.columns),
  };
}

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
  const film = assetFilm(p.assets.find((asset) => asset.id === clip.asset));
  const footage = film.frames / film.fps;
  const mediaOpacity =
    clip.endMode === "fade" ? ease((footage - time) / 0.2) : 1;
  return {
    asset: clip.asset,
    square: clip.square,
    progress,
    opacity: mediaOpacity * (1 - ease((progress - 0.28) / 0.72)),
    ...filmPosition(film, time, clip.endMode === "loop"),
  };
}
