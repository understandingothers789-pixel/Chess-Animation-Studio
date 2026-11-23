import type { Project } from "../core/project";
import { buildGame } from "../core/chess";
import { afterEffectWindow, duration, segments } from "../core/timeline";

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
  const after = afterEffectWindow(project.moves[index].effect, segment);
  if (after)
    stops.push(
      { label: "After-effect peak", time: (after.start + after.end) / 2 },
      { label: "After-effect end", time: after.end },
    );
  return stops;
}
