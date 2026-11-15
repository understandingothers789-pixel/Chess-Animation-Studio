import { expect, it } from "vitest";
import { annotation } from "../src/core/annotations";
import {
  arrangeTextGroup,
  moveTextGroup,
  type GroupBounds,
} from "../src/core/captions/groups";
import { updateAnnotations } from "../src/core/annotationEdit";
import { blank, parseProject } from "../src/core/project";
import { titleShot } from "../src/core/storyboard";
const bounds: GroupBounds[] = [
  { id: "a", left: 0.1, right: 0.3, top: 0.1, bottom: 0.2, anchorX: 0.2 },
  { id: "b", left: 0.4, right: 0.5, top: 0.4, bottom: 0.5, anchorX: 0.45 },
  { id: "c", left: 0.7, right: 0.9, top: 0.7, bottom: 0.8, anchorX: 0.8 },
];
const layers = () =>
  bounds.map((b) => ({
    ...annotation("text", 0),
    id: b.id,
    x: b.anchorX,
    y: (b.top + b.bottom) / 2,
  }));
const ids = bounds.map((b) => b.id);
it("aligns measured edges and centers across mixed text alignments", () => {
  const a = layers();
  a[0].align = "left";
  a[2].align = "right";
  for (const action of [
    "left",
    "center",
    "right",
    "top",
    "middle",
    "bottom",
  ] as const) {
    const p = arrangeTextGroup(a, bounds, ids, action, "vertical")!;
    expect(p).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const dx = p[i].x - bounds[i].anchorX,
        dy = p[i].y - (bounds[i].top + bounds[i].bottom) / 2;
      const value =
        action === "left"
          ? bounds[i].left + dx
          : action === "right"
            ? bounds[i].right + dx
            : action === "center"
              ? (bounds[i].left + bounds[i].right) / 2 + dx
              : action === "top"
                ? bounds[i].top + dy
                : action === "bottom"
                  ? bounds[i].bottom + dy
                  : (bounds[i].top + bounds[i].bottom) / 2 + dy;
      if (i === 0) continue;
      const b = bounds[0],
        d = p[0];
      const x = d.x - b.anchorX,
        y = d.y - (b.top + b.bottom) / 2;
      const first =
        action === "left"
          ? b.left + x
          : action === "right"
            ? b.right + x
            : action === "center"
              ? (b.left + b.right) / 2 + x
              : action === "top"
                ? b.top + y
                : action === "bottom"
                  ? b.bottom + y
                  : (b.top + b.bottom) / 2 + y;
      expect(value).toBeCloseTo(first);
    }
  }
});
it("distributes equal gaps and fixes the outer bounds", () => {
  for (const action of ["distribute-x", "distribute-y"] as const) {
    const p = arrangeTextGroup(layers(), bounds, ids, action, "vertical")!;
    const horizontal = action === "distribute-x";
    const starts = bounds.map((b, i) =>
      horizontal
        ? b.left + p[i].x - b.anchorX
        : b.top + p[i].y - (b.top + b.bottom) / 2,
    );
    const sizes = bounds.map((b) =>
      horizontal ? b.right - b.left : b.bottom - b.top,
    );
    expect(starts[1] - starts[0] - sizes[0]).toBeCloseTo(
      starts[2] - starts[1] - sizes[1],
    );
    expect(starts[0]).toBeCloseTo(horizontal ? 0.1 : 0.1);
    expect(starts[2] + sizes[2]).toBeCloseTo(horizontal ? 0.9 : 0.8);
  }
});
it("moves groups with one bounded delta and rejects missing, locked or hidden members", () => {
  const a = layers(),
    before = structuredClone(a);
  const p = moveTextGroup(a, bounds, ids, 1, 1, "vertical")!;
  expect(p[0].x - a[0].x).toBeCloseTo(p[2].x - a[2].x);
  expect(p[2].x).toBeCloseTo(0.84);
  expect(a).toEqual(before);
  a[1].canvasLocked = true;
  expect(moveTextGroup(a, bounds, ids, 0.1, 0.1, "vertical")).toBeNull();
  a[1].canvasLocked = false;
  a[1].hidden = true;
  expect(arrangeTextGroup(a, bounds, ids, "left", "vertical")).toBeNull();
  expect(
    moveTextGroup(
      layers(),
      bounds,
      [...ids, "source-missing"],
      0,
      0,
      "vertical",
    ),
  ).toBeNull();
});
it("respects differing custom safe margins and insufficient distribution space", () => {
  const a = layers();
  a[2].layout = { ...a[2].layout, customMargins: true, left: 0.4 };
  expect(arrangeTextGroup(a, bounds, ids, "left", "vertical")).toBeNull();
  const overlap = bounds.map((b) => ({ ...b, left: 0.4, right: 0.6 }));
  expect(
    arrangeTextGroup(layers(), overlap, ids, "distribute-x", "vertical"),
  ).toBeNull();
});
it("annotation edits borrow unrelated immutable branches and isolate history snapshots", () => {
  const p = blank();
  p.storyboard.shots = [titleShot(p, "A", 2), titleShot(p, "B", 2)];
  p.storyboard.shots[0].annotations = layers();
  const before = structuredClone(p);
  const next = updateAnnotations(
    p,
    (a) => {
      a[0].x = 0.55;
    },
    p.storyboard.shots[0].id,
  );
  expect(p).toEqual(before);
  expect(next.moves).toBe(p.moves);
  expect(next.music).toBe(p.music);
  expect(next.storyboard.shots[1]).toBe(p.storyboard.shots[1]);
  expect(next.storyboard.shots[0].annotations).not.toBe(
    p.storyboard.shots[0].annotations,
  );
  expect(next.storyboard.shots[0].annotations[0].x).toBe(0.55);
  expect(updateAnnotations(p, () => {}, "missing")).toBe(p);
  expect(updateAnnotations(p, () => {})).toBe(p);
  expect(parseProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
});
