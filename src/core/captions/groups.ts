import type { Annotation } from "../annotations";
import type { Format } from "../project";
import { safeDefaults, safeRect } from "./safeAreas";
export type GroupBounds = {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  anchorX: number;
};
export type GroupAction =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "distribute-x"
  | "distribute-y";
export function groupMembers(
  annotations: Annotation[],
  bounds: GroupBounds[],
  ids: string[],
) {
  if (ids.length < 2 || new Set(ids).size !== ids.length) return null;
  const members = ids.map((id) => ({
    a: annotations.find((a) => a.id === id),
    b: bounds.find((b) => b.id === id),
  }));
  if (
    members.some(
      ({ a, b }) =>
        !a ||
        !b ||
        a.hidden ||
        a.canvasLocked ||
        !["text", "caption"].includes(a.kind),
    )
  )
    return null;
  return members as { a: Annotation; b: GroupBounds }[];
}
function safe(a: Annotation, format: Format) {
  const s = safeRect(
    100,
    100,
    a.layout.customMargins
      ? a.layout
      : safeDefaults(format, a.layout.placement),
  );
  return {
    left: s.x / 100,
    right: (s.x + s.width) / 100,
    top: s.y / 100,
    bottom: (s.y + s.height) / 100,
  };
}
function positions(
  members: { a: Annotation; b: GroupBounds }[],
  offsets: { x: number; y: number }[],
  format: Format,
) {
  if (
    members.some(({ a, b }, i) => {
      const s = safe(a, format),
        d = offsets[i];
      return (
        b.left + d.x < s.left - 1e-6 ||
        b.right + d.x > s.right + 1e-6 ||
        b.top + d.y < s.top - 1e-6 ||
        b.bottom + d.y > s.bottom + 1e-6
      );
    })
  )
    return null;
  return members.map(({ a, b }, i) => ({
    id: a.id,
    x: b.anchorX + offsets[i].x,
    y: (b.top + b.bottom) / 2 + offsets[i].y,
  }));
}
/** One common delta preserves spacing; safe margins constrain the whole group. */
export function moveTextGroup(
  annotations: Annotation[],
  bounds: GroupBounds[],
  ids: string[],
  dx: number,
  dy: number,
  format: Format,
) {
  const m = groupMembers(annotations, bounds, ids);
  if (!m) return null;
  const minX = Math.max(...m.map(({ a, b }) => safe(a, format).left - b.left)),
    maxX = Math.min(...m.map(({ a, b }) => safe(a, format).right - b.right));
  const minY = Math.max(...m.map(({ a, b }) => safe(a, format).top - b.top)),
    maxY = Math.min(...m.map(({ a, b }) => safe(a, format).bottom - b.bottom));
  if (minX > maxX || minY > maxY) return null;
  const x = Math.max(minX, Math.min(maxX, dx)),
    y = Math.max(minY, Math.min(maxY, dy));
  return positions(
    m,
    m.map(() => ({ x, y })),
    format,
  );
}
/** Align measured visible edges/centers within the selection, never font guesses. */
export function arrangeTextGroup(
  annotations: Annotation[],
  bounds: GroupBounds[],
  ids: string[],
  action: GroupAction,
  format: Format,
) {
  const m = groupMembers(annotations, bounds, ids);
  if (!m) return null;
  const l = Math.min(...m.map((v) => v.b.left)),
    r = Math.max(...m.map((v) => v.b.right)),
    t = Math.min(...m.map((v) => v.b.top)),
    b = Math.max(...m.map((v) => v.b.bottom));
  const offsets = m.map(() => ({ x: 0, y: 0 }));
  if (action.startsWith("distribute")) {
    if (m.length < 3) return null;
    const horizontal = action === "distribute-x";
    const ordered = m
      .map((v, i) => ({ ...v, i }))
      .sort((a, b) => (horizontal ? a.b.left - b.b.left : a.b.top - b.b.top));
    const size = (v: (typeof ordered)[number]) =>
      horizontal ? v.b.right - v.b.left : v.b.bottom - v.b.top;
    const gap =
      ((horizontal ? r - l : b - t) -
        ordered.reduce((n, v) => n + size(v), 0)) /
      (m.length - 1);
    if (gap < -1e-6) return null;
    let cursor = horizontal ? l : t;
    for (const v of ordered) {
      if (horizontal) offsets[v.i].x = cursor - v.b.left;
      else offsets[v.i].y = cursor - v.b.top;
      cursor += size(v) + gap;
    }
  } else
    m.forEach(({ b: box }, i) => {
      offsets[i] = {
        x:
          action === "left"
            ? l - box.left
            : action === "center"
              ? (l + r - box.left - box.right) / 2
              : action === "right"
                ? r - box.right
                : 0,
        y:
          action === "top"
            ? t - box.top
            : action === "middle"
              ? (t + b - box.top - box.bottom) / 2
              : action === "bottom"
                ? b - box.bottom
                : 0,
      };
    });
  return positions(m, offsets, format);
}
