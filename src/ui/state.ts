import { useCallback, useRef, useState } from "react";
import { sample } from "../core/chess";
import { VERSION, type Project } from "../core/project";
export type Edit = (label: string, fn: (p: Project) => void) => void;
export function useProject() {
  const [project, set] = useState<Project>(sample),
    history = useRef<{
      past: Project[];
      future: Project[];
      label: string;
      at: number;
    }>({ past: [], future: [], label: "", at: 0 });
  const [, revision] = useState(0);
  const replace = useCallback((p: Project, record = true) => {
    set((old) => {
      if (record) {
        history.current.past.push(old);
        history.current.past = history.current.past.slice(-80);
      }
      history.current.future = [];
      return p;
    });
    revision((v) => v + 1);
  }, []);
  const edit: Edit = useCallback((label, fn) => {
    set((old) => {
      const h = history.current,
        now = Date.now();
      if (h.label !== label || now - h.at > 450) {
        h.past.push(old);
        h.past = h.past.slice(-80);
      }
      h.label = label;
      h.at = now;
      h.future = [];
      const next = structuredClone(old);
      fn(next);
      next.appVersion = VERSION;
      return next;
    });
    revision((v) => v + 1);
  }, []);
  const undo = () => {
    const h = history.current;
    if (!h.past.length) return;
    set((old) => {
      h.future.push(old);
      return h.past.pop()!;
    });
    h.label = "";
    revision((v) => v + 1);
  };
  const redo = () => {
    const h = history.current;
    if (!h.future.length) return;
    set((old) => {
      h.past.push(old);
      return h.future.pop()!;
    });
    h.label = "";
    revision((v) => v + 1);
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
