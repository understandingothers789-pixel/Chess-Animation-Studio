import type { Project } from "./project";
import type { ExportOptions } from "../bridge";
import { audioEvents } from "./audioEvents";
import { compileStoryboard } from "./storyboard";
import { squareVideoEnd } from "./introVideo";
import { compileTimeline, memeWindow } from "./timeline";
/** Conservative badge dependencies, exact selected-format background and output audio.
 * Unreferenced library files are never read by the export worker. */
export function requiredAssetIds(p: Project, o: ExportOptions) {
  const ids = new Set<string>(),
    bg = p.layouts[o.format];
  if (bg.background === "image" && bg.image) ids.add(bg.image);
  for (const id of Object.values(p.badgeAssets)) if (id) ids.add(id);
  const openingRanges =
    o.mode === "storyboard"
      ? compileStoryboard(p).shots.filter(
          ({ shot, start, end }) =>
            shot.kind === "opening" && start < o.end && end > o.start,
        )
      : [];
  if (
    openingRanges.some(
      ({ project, start }) => o.start < start + squareVideoEnd(project),
    ) &&
    p.squareIntro?.asset
  )
    ids.add(p.squareIntro.asset);
  if (
    o.mode !== "storyboard" &&
    p.squareIntro?.asset &&
    o.start < squareVideoEnd(p)
  )
    ids.add(p.squareIntro.asset);
  if (p.playerIntro?.asset) {
    const visible =
      o.mode === "storyboard"
        ? compileStoryboard(p).shots.some(
            ({ shot, issue, start, end }) =>
              !issue &&
              shot.kind === "position-hold" &&
              shot.showPlayerIntro &&
              start < o.end &&
              end >= o.start,
          )
        : p.playerIntro.enabled &&
          p.lead > squareVideoEnd(p) &&
          o.end > squareVideoEnd(p) &&
          o.start < p.lead;
    if (
      visible ||
      (p.playerIntro.enabled &&
        openingRanges.some(
          ({ project, start }) =>
            project.lead > squareVideoEnd(project) &&
            o.end > start + squareVideoEnd(project),
        ))
    )
      ids.add(p.playerIntro.asset);
  }
  if (p.moves.some((move) => move.effect.preMoveMeme)) {
    const source = compileTimeline(p).segments;
    const ranges =
      o.mode !== "storyboard"
        ? [{ first: 0, last: p.moves.length - 1, start: o.start, end: o.end }]
        : compileStoryboard(p).shots.flatMap((shot) =>
            shot.shot.kind === "move-range" &&
            !shot.issue &&
            shot.start <= o.end &&
            shot.end >= o.start
              ? [
                  {
                    first: shot.startIndex,
                    last: shot.endIndex,
                    start: shot.sourceStart,
                    end: shot.sourceEnd,
                  },
                ]
              : [],
          );
    for (const range of ranges)
      for (let i = range.first; i <= range.last; i++) {
        const window = memeWindow(p.moves[i].effect, source[i]);
        if (window && window.start < range.end && window.end > range.start)
          ids.add(window.asset);
      }
  }
  if (p.music.asset && !p.music.muted) ids.add(p.music.asset);
  for (const event of audioEvents(p, o.mode))
    if (
      event.at < o.end &&
      event.end > o.start &&
      event.volume * p.audio[event.bus] > 0 &&
      event.asset &&
      event.asset !== "__knightHorse"
    )
      ids.add(event.asset);
  return ids;
}
