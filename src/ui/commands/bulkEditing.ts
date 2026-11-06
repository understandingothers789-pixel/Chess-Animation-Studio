import {
  moveGroups,
  pasteSettings,
  settingsAffectTiming,
  type SettingsKind,
} from "../../core/editing";
import type { Effect, Project } from "../../core/project";
import type { Edit } from "../state";
export const settingsLabel = (kind: SettingsKind) =>
  kind === "everything"
    ? "Everything (all formats)"
    : kind[0].toUpperCase() + kind.slice(1);
export function bulkGroups(p: Project, source: string, checked: Set<string>) {
  return {
    "This move": [source],
    "Selected moves": p.moves.filter((m) => checked.has(m.id)).map((m) => m.id),
    ...moveGroups(p),
  };
}
export function applyMoveSettings(
  p: Project,
  edit: Edit,
  report: (message: string) => void,
  kind: SettingsKind,
  ids: string[],
  source: Effect,
  sourceFormat = p.format,
  group = "moves",
) {
  const targetName =
    group === "all moves" ? "moves" : group === "this move" ? "move" : group;
  const targets = p.moves.filter((m) => ids.includes(m.id)),
    locked = targets.filter((m) => m.effect.locked).length;
  if (!targets.length) return;
  edit.begin();
  try {
    edit(`Apply ${kind} to ${targets.length} ${targetName}`, (draft) => {
      if (draft.id !== p.id) return;
      for (const move of draft.moves.filter((m) => ids.includes(m.id)))
        move.effect = pasteSettings(
          move.effect,
          { kind, source, format: sourceFormat },
          p.format,
        );
    });
  } finally {
    edit.end();
  }
  report(
    `${settingsLabel(kind)} applied to ${targets.length} ${targetName}${locked && settingsAffectTiming(kind) ? `; ${locked} locked ${locked === 1 ? "move kept its" : "moves kept their"} timing` : ""}. Undo is available.`,
  );
}
