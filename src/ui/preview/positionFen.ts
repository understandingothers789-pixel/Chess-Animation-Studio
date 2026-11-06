import { buildGame } from "../../core/chess";
import { segments } from "../../core/timeline";
import type { Project } from "../../core/project";
/** Game steps store their pre-move FEN. Copy the last fully landed position. */
export function positionFen(project: Project, time: number) {
  const landed = segments(project).filter((s) => s.land <= time).length;
  if (!landed) return project.fen;
  const game = buildGame(project);
  return game.steps[landed]?.fen ?? game.end;
}
