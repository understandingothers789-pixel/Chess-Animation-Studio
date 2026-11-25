import type { Project } from "../core/project";
import { buildGame } from "../core/chess";
import {
  afterEffectWindow,
  duration,
  memeWindow,
  pieceSizeProfile,
  spotlightStart,
  segments,
} from "../core/timeline";

/** Audition a clip without changing its authored timing or the composition. */
export function movePreviewWindow(project: Project, index: number) {
  const segment = segments(project)[index];
  if (!segment) return null;
  let end = segment.end;
  if (buildGame(project).steps[index]?.capturedId) {
    const effect = project.moves[index].effect;
    const impact = segment.depart + effect.duration * effect.capture.impact;
    end = Math.max(
      end,
      effect.capture.exit === "dust" ? impact + effect.capture.dustDuration : 0,
      project.cinematic.enabled ? impact + project.cinematic.duration : 0,
    );
  }
  return { start: segment.start, end: Math.min(duration(project), end) };
}

/** Each stop is on the authored timeline. The midpoint uses travel time, not the hold. */
export function moveFrameStops(project: Project, index: number) {
  const segment = segments(project)[index];
  if (!segment) return [];
  const stops = [
    { label: "Departure", time: segment.depart },
    { label: "Mid-move", time: (segment.depart + segment.land) / 2 },
    { label: "Landing", time: segment.land },
    { label: "Settled", time: segment.finish },
  ];
  const meme = memeWindow(project.moves[index].effect, segment);
  if (meme)
    stops.unshift({
      label: "Meme",
      time: project.moves[index].effect.preMoveMeme?.fade
        ? (meme.start + meme.end) / 2
        : meme.start,
    });
  const after = afterEffectWindow(project.moves[index].effect, segment);
  if (after)
    stops.push(
      { label: "After-effect peak", time: (after.start + after.end) / 2 },
      { label: "After-effect end", time: after.end },
    );
  return stops;
}

/** Authored effect windows on the same clock as the move preview. */
export function moveEffectTiming(project: Project, index: number) {
  const segment = segments(project)[index];
  if (!segment) return null;
  const { effect } = project.moves[index];
  const rows: {
    label: string;
    section: string;
    window: { start: number; end: number } | null;
  }[] = [
    {
      label: "Starting-square meme",
      section: "meme",
      window: memeWindow(effect, segment),
    },
    {
      label: "Main movement",
      section: "move",
      window: { start: segment.depart, end: segment.finish },
    },
    {
      label: "Piece size",
      section: "size",
      window:
        effect.keys.scale?.length || pieceSizeProfile(effect) !== "constant"
          ? {
              start: segment.depart,
              end:
                pieceSizeProfile(effect) === "smooth" &&
                !effect.keys.scale?.length
                  ? segment.land
                  : segment.finish,
            }
          : null,
    },
    {
      label: "After effect",
      section: "after-effect",
      window: afterEffectWindow(effect, segment),
    },
  ];
  if (effect.jam.enabled) {
    const start = spotlightStart(effect, segment);
    rows.push({
      label: "Beat zoom",
      section: "spotlight",
      window: { start, end: start + effect.jam.duration },
    });
  }
  return { segment, rows };
}
