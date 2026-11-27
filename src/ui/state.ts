import { reconcileBeatPins } from "../core/beatPins";
import { updateAnnotations } from "../core/annotationEdit";
import type { Annotation } from "../core/annotations";
import { preserveLockedTiming } from "../core/editing";
import { useCallback, useRef, useState } from "react";
import { sample } from "../core/chess";
import { VERSION, type Project, type StoryboardShot } from "../core/project";
export type Edit = ((label: string, fn: (p: Project) => void) => void) & {
  annotations?: (
    label: string,
    change: (layers: Annotation[]) => void,
    shotId?: string,
  ) => void;
  moves?: (
    label: string,
    ids: ReadonlySet<string>,
    change: (move: Project["moves"][number]) => void,
  ) => void;
  shot?: (
    label: string,
    id: string,
    change: (shot: StoryboardShot) => void,
  ) => void;
  begin: () => void;
  end: () => void;
};
export function changeMoves(
  p: Project,
  ids: ReadonlySet<string>,
  change: (move: Project["moves"][number]) => void,
) {
  let changed = false;
  const moves = p.moves.map((before) => {
    if (!ids.has(before.id)) return before;
    const next = structuredClone(before);
    change(next);
    preserveLockedTiming(before.effect, next.effect);
    if (
      before.autoPreset &&
      JSON.stringify(before.effect) !== JSON.stringify(next.effect)
    )
      delete next.autoPreset;
    if (JSON.stringify(before) === JSON.stringify(next)) return before;
    changed = true;
    return next;
  });
  return changed ? { ...p, moves } : p;
}

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
  const accept = (label: string, next: Project) => {
    const h = history.current,
      now = Date.now();
    if (h.drag ? !h.recorded : h.label !== label || now - h.at > 450) record();
    h.recorded = true;
    h.label = label;
    h.at = now;
    h.future = [];
    next.appVersion = VERSION;
    commit(reconcileBeatPins(next));
  };
  const edit = useCallback(
    Object.assign(
      (label: string, fn: (p: Project) => void) => {
        const old = current.current;
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
        accept(label, next);
      },
      {
        moves: (
          label: string,
          ids: ReadonlySet<string>,
          change: (move: Project["moves"][number]) => void,
        ) => {
          const old = current.current;
          const next = changeMoves(old, ids, change);
          if (next !== old) accept(label, next);
        },
        shot: (
          label: string,
          id: string,
          change: (shot: StoryboardShot) => void,
        ) => {
          const old = current.current;
          const index = old.storyboard.shots.findIndex(
            (shot) => shot.id === id,
          );
          if (index < 0) return;
          const before = old.storyboard.shots[index];
          const after = structuredClone(before);
          change(after);
          if (JSON.stringify(after) === JSON.stringify(before)) return;
          const shots = old.storyboard.shots.slice();
          shots[index] = after;
          accept(label, { ...old, storyboard: { ...old.storyboard, shots } });
        },
        annotations: (
          label: string,
          change: (layers: Annotation[]) => void,
          shotId?: string,
        ) => {
          const old = current.current,
            next = updateAnnotations(old, change, shotId);
          if (next !== old) accept(label, next);
        },
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
