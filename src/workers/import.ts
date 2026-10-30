import { importFen, importPgn } from "../core/chess";
import type { Project } from "../core/project";
self.onmessage = (
  e: MessageEvent<{
    project: Project;
    text: string;
    kind: string;
    preserve: boolean;
  }>,
) => {
  try {
    self.postMessage({
      project:
        e.data.kind === "fen"
          ? importFen(e.data.project, e.data.text)
          : importPgn(e.data.project, e.data.text, e.data.preserve),
    });
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
