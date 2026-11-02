import type { Project } from "../core/project";
import { buildGame } from "../core/chess";
import { duration, segments } from "../core/timeline";

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
