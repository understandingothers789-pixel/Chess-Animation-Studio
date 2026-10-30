import { useState, useRef, useCallback } from "react";
import type { Project } from "../core/model";
export type Edit = (label: string, update: (project: Project) => void) => void;
export function useProject(initial: Project) {
  const [project, setProject] = useState(initial),
    current = useRef(initial),
    past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    last = useRef({ label: "", at: 0 });
  const [revision, setRevision] = useState(0);
  const publish = (p: Project) => {
    current.current = p;
    setProject(p);
    setRevision((x) => x + 1);
  };
  const edit: Edit = useCallback((label, update) => {
    const next = structuredClone(current.current);
    update(next);
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (label !== last.current.label || Date.now() - last.current.at > 400) {
      past.current.push(current.current);
      if (past.current.length > 80) past.current.shift();
    }
    last.current = { label, at: Date.now() };
    future.current = [];
    publish(next);
  }, []);
  const replace = useCallback((p: Project) => {
    past.current = [];
    future.current = [];
    last.current = { label: "", at: 0 };
    publish(p);
  }, []);
  const undo = useCallback(() => {
    const p = past.current.pop();
    if (p) {
      future.current.push(current.current);
      last.current = { label: "", at: 0 };
      publish(p);
    }
  }, []);
  const redo = useCallback(() => {
    const p = future.current.pop();
    if (p) {
      past.current.push(current.current);
      last.current = { label: "", at: 0 };
      publish(p);
    }
  }, []);
  return {
    project,
    edit,
    replace,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    revision,
  };
}
