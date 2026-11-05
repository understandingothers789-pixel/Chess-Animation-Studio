import { preserveLockedTiming } from "../core/editing";
import { useCallback, useRef, useState } from "react";
import { sample } from "../core/chess";
import { VERSION, type Project } from "../core/project";
export type Edit = ((label: string, fn: (p: Project) => void) => void) & {
  begin: () => void;
  end: () => void;
};
export function useProject() {
  const [project, set] = useState<Project>(sample),
    current = useRef(project);
  const history = useRef({
    past: [] as Project[],
    future: [] as Project[],
    label: "",
    at: 0,
    drag: false,
    recorded: false,
  });
  const commit = useCallback((p: Project) => {
    current.current = p;
    set(p);
  }, []);
  const record = () => {
    const h = history.current;
    h.past.push(current.current);
    h.past = h.past.slice(-80);
    h.future = [];
  };
  const edit = useCallback(
    Object.assign(
      (label: string, fn: (p: Project) => void) => {
        const old = current.current,
          h = history.current,
          now = Date.now();
        const next = structuredClone(old);
        fn(next);
        const previous = new Map(old.moves.map((m) => [m.id, m]));
        for (const m of next.moves) {
          const before = previous.get(m.id);
          if (before) preserveLockedTiming(before.effect, m.effect);
          if (
            before?.autoPreset &&
            JSON.stringify(m.effect) !== JSON.stringify(before.effect)
          )
            delete m.autoPreset;
        }
        if (JSON.stringify(next) === JSON.stringify(old)) return;
        if (h.drag ? !h.recorded : h.label !== label || now - h.at > 450)
          record();
        h.recorded = true;
        h.label = label;
        h.at = now;
        h.future = [];
        next.appVersion = VERSION;
        commit(next);
      },
      {
        begin: () => {
          history.current.drag = true;
          history.current.recorded = false;
          history.current.label = "";
        },
        end: () => {
          history.current.drag = false;
          history.current.label = "";
        },
      },
    ),
    [commit],
  );
  const replace = useCallback(
    (p: Project, recordHistory = true) => {
      if (recordHistory) record();
      else history.current.past = [];
      history.current.future = [];
      history.current.label = "";
      commit(p);
    },
    [commit],
  );
  const undo = () => {
    const h = history.current;
    if (!h.past.length) return;
    h.future.push(current.current);
    h.label = "";
    commit(h.past.pop()!);
  };
  const redo = () => {
    const h = history.current;
    if (!h.future.length) return;
    h.past.push(current.current);
    h.label = "";
    commit(h.future.pop()!);
  };
  return {
    project,
    edit,
    replace,
    undo,
    redo,
    canUndo: !!history.current.past.length,
    canRedo: !!history.current.future.length,
  };
}
