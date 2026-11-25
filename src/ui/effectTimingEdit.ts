import { activeBeats } from "../core/beatMarkers";
import { landingDuration } from "../core/audio";
import { memeTiming, type Effect, type Project } from "../core/project";
import { compileTimeline, moveLead, spotlightStart } from "../core/timeline";

export const timingFields = {
  meme: { label: "Meme length", min: memeTiming.min, max: memeTiming.max },
  move: { label: "Movement length", min: 0.2, max: 30 },
  afterDelay: { label: "After-effect delay", min: 0, max: 3 },
  afterDuration: { label: "After-effect length", min: 0.1, max: 5 },
  spotlight: { label: "Beat zoom length", min: 0.6, max: 8 },
} as const;
export type TimingField = keyof typeof timingFields;
export function timingValue(fx: Effect, field: TimingField) {
  return {
    meme: fx.preMoveMeme?.duration ?? 0,
    move: fx.duration,
    afterDelay: fx.after.delay,
    afterDuration: fx.after.duration,
    spotlight: fx.jam.duration,
  }[field];
}

export function proposeTiming(
  project: Project,
  index: number,
  field: TimingField,
  value: number,
  landing: string | null,
  zoomBeat: string | null,
) {
  const move = project.moves[index];
  const old = compileTimeline(project).segments[index];
  if (!move || !old || move.effect.locked) return null;
  const effect = structuredClone(move.effect);
  const { min, max } = timingFields[field];
  if (!Number.isFinite(value) || value < min || value > max) return null;
  if (field === "meme" && effect.preMoveMeme)
    effect.preMoveMeme.duration = value;
  if (field === "move") effect.duration = value;
  if (field === "afterDelay") effect.after.delay = value;
  if (field === "afterDuration") effect.after.duration = value;
  if (field === "spotlight") effect.jam.duration = value;
  const departure = old.start + moveLead(effect);
  const marker = activeBeats(project).find((beat) => beat.id === landing);
  effect.landingBeat = landing;
  if (
    marker &&
    (field === "move" ||
      departure !== old.depart ||
      landing !== move.effect.landingBeat)
  ) {
    if (
      field === "move" &&
      landing === move.effect.landingBeat &&
      value !== move.effect.duration
    ) {
      const phase = (marker.time - departure) / value;
      if (phase < 0.25 || phase > 0.98) return null;
      effect.landing = phase;
    } else {
      const adjusted = landingDuration(effect, departure, marker.time);
      if (adjusted === null) return null;
      effect.duration = adjusted;
    }
  }
  const land = departure + effect.duration * effect.landing;
  const start = spotlightStart(effect, {
    land,
    finish: departure + effect.duration,
  });
  const zoomMarker = activeBeats(project).find((beat) => beat.id === zoomBeat);
  if (
    zoomMarker &&
    (zoomMarker.time < start || zoomMarker.time >= start + effect.jam.duration)
  )
    return null;
  if (zoomBeat !== (move.effect.jam.beat ?? null)) {
    effect.jam.beat = zoomBeat;
    if (zoomBeat) effect.jam.clock = "auto";
  }
  const next = {
    ...project,
    moves: project.moves.map((move, i) =>
      i === index ? { ...move, effect } : move,
    ),
  };
  return {
    next,
    effect,
    shift: compileTimeline(next).segments[index].end - old.end,
  };
}
