import { moveGroups } from "./editing";
import type { Project } from "./project";
export function highlightGroups(p: Project): Record<string, string[]> {
  const legal = moveGroups(p);
  return {
    ...legal,
    "Analysis labels": p.moves
      .filter(
        (m) =>
          m.analysis.engine?.state === "done" ||
          m.analysis.book?.state === "found",
      )
      .map((m) => m.id),
    "Special animations / badges": p.moves
      .filter(
        (m) =>
          !["slide", "soft", "sway", "sway-half"].includes(m.effect.preset) ||
          (m.effect.badge.manual !== null && m.effect.badge.manual !== "none"),
      )
      .map((m) => m.id),
  };
}
export function highlightMatches(p: Project, filters: string[]) {
  const groups = highlightGroups(p),
    sets = Object.fromEntries(
      Object.entries(groups).map(([name, ids]) => [name, new Set(ids)]),
    );
  return p.moves.flatMap((m, index) => {
    if (filters.length && !filters.some((name) => sets[name]?.has(m.id)))
      return [];
    const reasons = Object.keys(groups).filter(
      (name) => name !== "All moves" && sets[name].has(m.id),
    );
    if (m.analysis.engine?.state === "done")
      reasons.push(`Engine: ${m.analysis.engine.label}`);
    return [{ id: m.id, index, san: m.san, reasons }];
  });
}
