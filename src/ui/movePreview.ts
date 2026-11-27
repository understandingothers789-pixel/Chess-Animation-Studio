import type { Effect, Project } from "../core/project";
import { buildGame } from "../core/chess";
import {
  afterEffectWindow,
  duration,
  memeWindow,
  pieceSizeProfile,
  spotlightStart,
  spotlightPeaks,
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
  const effect = project.moves[index].effect;
  const keys = effect.keys.scale ?? [];
  const keyPeak = keys
    .slice()
    .sort((a, b) => Math.abs(b.value - 1) - Math.abs(a.value - 1))[0];
  const profile = pieceSizeProfile(effect);
  const captureSize = effect.preset === "capture" || effect.preset === "finale";
  const size = captureSize ? effect.capture.grow : effect.scale;
  if (
    keyPeak ||
    (profile !== "constant" && size !== 1 && effect.intensity > 0)
  ) {
    const phase =
      keyPeak?.at ??
      (profile === "smooth"
        ? effect.landing * Math.min(effect.peak, 1 - (effect.sizeReturn ?? 0.5))
        : captureSize
          ? effect.capture.impact
          : effect.peak);
    stops.push({
      label: "Size peak",
      time: segment.depart + effect.duration * phase,
    });
  }
  const after = afterEffectWindow(effect, segment);
  if (after)
    stops.push(
      { label: "After-effect peak", time: (after.start + after.end) / 2 },
      { label: "After-effect end", time: after.end },
    );
  return stops.sort((a, b) => a.time - b.time);
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

export type MoveBeatEvent = "landing" | "capture" | "zoom" | "after";

export function moveBeatEvents(p: Project, index: number) {
  const s = segments(p)[index];
  const e = p.moves[index].effect;
  const after = afterEffectWindow(e, s);
  const zoomStart = spotlightStart(e, s);
  const events: {
    id: MoveBeatEvent;
    name: string;
    time: number;
    beat?: string | null;
    min: number;
    max: number;
  }[] = [
    {
      id: "landing",
      name: "Piece landing",
      time: s.land,
      beat: e.landingBeat,
      min: s.depart + 0.2 * e.landing,
      max: s.depart + 30 * e.landing,
    },
  ];
  if (buildGame(p).steps[index]?.capturedId)
    events.push({
      id: "capture",
      name: "Capture impact",
      time: s.depart + e.duration * e.capture.impact,
      beat: e.capture.beat,
      min: s.depart + e.duration * 0.2,
      max: s.depart + e.duration * 0.95,
    });
  if (e.jam.enabled)
    events.push({
      id: "zoom",
      name: "First beat zoom peak",
      time: spotlightPeaks(p, e, zoomStart)[0]?.time ?? zoomStart,
      beat: e.jam.beat,
      min: zoomStart + 0.12,
      max: zoomStart + e.jam.duration - 0.2,
    });
  if (after)
    events.push({
      id: "after",
      name: "After-effect start",
      time: after.start,
      beat: e.after.beat,
      min: s.finish,
      max: s.finish + 3,
    });
  return events;
}

export function alignMoveEvent(
  p: Project,
  index: number,
  id: MoveBeatEvent,
  beat: string,
  time: number,
): Effect | null {
  const event = moveBeatEvents(p, index).find((item) => item.id === id);
  const old = p.moves[index].effect;
  if (
    !event ||
    old.locked ||
    time < event.min - 1e-8 ||
    time > event.max + 1e-8
  )
    return null;
  const next = structuredClone(old);
  const s = segments(p)[index];
  switch (id) {
    case "landing":
      next.duration = Math.max(
        0.2,
        Math.min(30, (time - s.depart) / old.landing),
      );
      next.landingBeat = beat;
      break;
    case "capture":
      next.capture.impact = Math.max(
        0.2,
        Math.min(0.95, (time - s.depart) / old.duration),
      );
      next.capture.exitAt = next.capture.impact;
      next.capture.beat = beat;
      break;
    case "zoom":
      next.jam.clock = "auto";
      next.jam.beat = beat;
      if (next.jam.rhythm === "alternate") next.jam.rhythm = "punch";
      break;
    case "after":
      next.after.delay = Math.max(0, Math.min(3, time - s.finish));
      next.after.beat = beat;
      break;
  }
  return next;
}
