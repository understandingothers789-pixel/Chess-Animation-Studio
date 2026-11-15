import { expect, it } from "vitest";
import { annotation, annotationOpacity } from "../src/core/annotations";
import { blank, parseProject } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import {
  compileStoryboard,
  localizeInheritedText,
  shotFromMove,
} from "../src/core/storyboard";
function fixture(hold = false) {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
  p.annotations = [
    {
      ...annotation("caption", 0),
      id: "source",
      end: 30,
      entrance: "none",
      exit: "none",
    },
  ];
  const shot = shotFromMove(
    p,
    p.moves[0].id,
    hold ? "position-hold" : "move-range",
  );
  shot.inheritAnnotations = true;
  p.storyboard.shots = [shot];
  return p;
}
it.each([false, true])(
  "localizes mapped inherited text without changing source or drawing it twice (hold=%s)",
  (hold) => {
    const p = fixture(hold),
      before = structuredClone(p.annotations);
    const mapped = compileStoryboard(p).shots[0].project.annotations[0];
    const id = localizeInheritedText(p, p.storyboard.shots[0].id, mapped.id)!;
    const local = p.storyboard.shots[0].annotations.find((a) => a.id === id)!;
    expect(local.start).toBe(mapped.start);
    expect(local.end).toBe(mapped.end);
    expect(local.opacity).toBe(mapped.opacity);
    expect(local.sourceAnnotationId).toBe("source");
    expect(p.annotations).toEqual(before);
    expect(
      compileStoryboard(p).shots[0].project.annotations.map((a) => a.id),
    ).toEqual([id]);
    local.text = "Independent wording";
    local.hidden = true;
    local.canvasLocked = true;
    const reopened = parseProject(JSON.parse(JSON.stringify(p)));
    expect(reopened.storyboard.shots[0].annotations[0]).toEqual(local);
    expect(
      compileStoryboard(reopened).shots[0].project.annotations,
    ).toHaveLength(1);
    reopened.storyboard.shots[0].annotations = [];
    // State edits produce a new immutable project, as Undo/Redo does.
    expect(
      compileStoryboard(structuredClone(reopened)).shots[0].project
        .annotations[0].id,
    ).toBe("source-source");
  },
);
it("rejects unavailable sources and full shots without mutations", () => {
  const p = fixture();
  expect(localizeInheritedText(p, "missing", "source-source")).toBeNull();
  expect(
    localizeInheritedText(p, p.storyboard.shots[0].id, "missing"),
  ).toBeNull();
  p.storyboard.shots[0].annotations = Array.from({ length: 50 }, () =>
    annotation("text", 0),
  );
  expect(
    localizeInheritedText(
      structuredClone(p),
      p.storyboard.shots[0].id,
      "source-source",
    ),
  ).toBeNull();
  expect(p.storyboard.shots[0].annotations).toHaveLength(50);
});
it("hides layers without losing opacity, timing or styling; canvas locks do not change output", () => {
  const a = annotation("caption", 0);
  a.entrance = "none";
  a.opacity = 0.65;
  expect(annotationOpacity(a, 1)).toBe(0.65);
  a.canvasLocked = true;
  expect(annotationOpacity(a, 1)).toBe(0.65);
  a.hidden = true;
  expect(annotationOpacity(a, 1)).toBe(0);
  a.hidden = false;
  expect(annotationOpacity(a, 1)).toBe(0.65);
});
