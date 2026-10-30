import { importFen, importPgn } from "../core/chess";
import type { Project } from "../core/model";
self.onmessage = (
  event: MessageEvent<{
    project: Project;
    text: string;
    fen: boolean;
    policy: string;
  }>,
) => {
  try {
    const { project: old, text, fen, policy } = event.data;
    const project = fen ? importFen(old, text) : importPgn(old, text);
    if (policy === "reset")
      project.moves.forEach((m) => {
        m.effect = structuredClone(old.defaults);
        m.analysis = {};
      });
    if (policy === "ply")
      project.moves.forEach((m, i) => {
        if (old.moves[i]) m.effect = structuredClone(old.moves[i].effect);
      });
    const matched = project.moves.filter((m) =>
      old.moves.some((o) => o.id === m.id),
    ).length;
    self.postMessage({ project, matched });
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
