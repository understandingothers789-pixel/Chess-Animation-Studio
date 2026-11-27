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
  if (o.mode === "storyboard") {
    for (const entry of compileStoryboard(p).shots) {
      if (
        entry.shot.kind !== "move-range" ||
        entry.issue ||
        entry.start >= o.end ||
        entry.end <= o.start
      )
        continue;
      const active =
        entry.shot.duration - entry.shot.preHold - entry.shot.postHold;
      const toSource = (time: number) =>
        entry.sourceStart +
        Math.min(
          1,
          Math.max(0, (time - entry.start - entry.shot.preHold) / active),
        ) *
          (entry.sourceEnd - entry.sourceStart);
      const start = toSource(o.start);
      const end = toSource(o.end);
      if (end <= start) {
        // A hold can display a source frame throughout the requested export.
        for (const move of entry.project.moves)
          if (move.effect.preMoveMeme) ids.add(move.effect.preMoveMeme.asset);
        continue;
      }
      for (const [index, move] of entry.project.moves.entries()) {
        const window = memeWindow(
          move.effect,
          entry.sourceTimeline.segments[entry.startIndex + index],
        );
        if (window && window.start < end && window.end > start)
          ids.add(window.asset);
      }
    }
  } else {
    const source = compileTimeline(p).segments;
    for (const [index, move] of p.moves.entries()) {
      const window = memeWindow(move.effect, source[index]);
      if (window && window.start < o.end && window.end > o.start)
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
