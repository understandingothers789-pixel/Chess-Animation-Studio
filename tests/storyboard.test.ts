import { it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  blank,
  parseProject,
  storyboardShotSchema,
  camera,
} from "../src/core/project";
import { importPgn, importFen, appendMove, buildGame } from "../src/core/chess";
import { segments, evaluate } from "../src/core/timeline";
import {
  compileStoryboard,
  resolveStoryboardFrame,
  sourceToStoryboard,
  shotFromMove,
  titleShot,
  duplicateShot,
  reorderShot,
  resizeShot,
  validateStoryboardExport,
} from "../src/core/storyboard";
const sample = () =>
  importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6");
it("persists a storyboard without duplicating or rearranging the source game", () => {
  const p = sample(),
    original = JSON.stringify(p.moves);
  p.storyboard.shots = [
    shotFromMove(p, p.moves[6].id),
    shotFromMove(p, p.moves[0].id),
  ];
  p.storyboard.shots[0].name = "X".repeat(120);
  const copy = duplicateShot(p.storyboard.shots[0]);
  expect(copy.name.length).toBeLessThanOrEqual(120);
  p.storyboard.shots.push(copy);
  reorderShot(p.storyboard.shots, copy.id, p.storyboard.shots[0].id);
  expect(JSON.stringify(p.moves)).toBe(original);
  expect(new Set(p.storyboard.shots.map((s) => s.id)).size).toBe(3);
  expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
});
it("rejects malformed durations, duplicate identities and impossible holds", () => {
  const p = sample(),
    shot = shotFromMove(p, p.moves[0].id);
  expect(storyboardShotSchema.safeParse({ ...shot, duration: 0 }).success).toBe(
    false,
  );
  expect(
    storyboardShotSchema.safeParse({ ...shot, preHold: shot.duration }).success,
  ).toBe(false);
  p.storyboard.shots = [shot, shot];
  expect(() => parseProject(p)).toThrow();
});
it("maps retimed disjoint ranges, holds, repeated shots and exact boundaries deterministically", () => {
  const p = sample(),
    a = shotFromMove(p, p.moves[6].id),
    b = shotFromMove(p, p.moves[0].id),
    seq = segments(p);
  a.duration = 6;
  a.preHold = 1;
  a.postHold = 1;
  b.duration = 2;
  p.storyboard.shots = [a, b, duplicateShot(a)];
  expect(resolveStoryboardFrame(p, 0)?.sourceTime).toBe(seq[6].start);
  expect(resolveStoryboardFrame(p, 3)?.sourceTime).toBeCloseTo(
    (seq[6].start + seq[6].end) / 2,
  );
  expect(resolveStoryboardFrame(p, 6)?.shot.id).toBe(b.id);
  expect(resolveStoryboardFrame(p, 7)?.sourceTime).toBeCloseTo(
    (seq[0].start + seq[0].end) / 2,
  );
  expect(
    sourceToStoryboard(p, (seq[6].start + seq[6].end) / 2).map((s) => s.time),
  ).toEqual([3, 11]);
  const x = resolveStoryboardFrame(p, 3);
  resolveStoryboardFrame(p, 13);
  resolveStoryboardFrame(p, 0);
  expect(resolveStoryboardFrame(p, 3)).toEqual(x);
  expect(resolveStoryboardFrame(p, 14)?.localTime).toBe(6);
});
it("marks missing references for repair instead of silently substituting another move", () => {
  const p = sample();
  p.storyboard.shots = [shotFromMove(p, p.moves[4].id)];
  p.moves.splice(4, 1);
  // Keep a legal source game with a removed identity, rather than an illegal SAN line.
  p.moves = sample().moves;
  p.storyboard.shots[0].source!.startMoveId = "removed";
  expect(compileStoryboard(p).issues[0].message).toMatch(/missing/);
  expect(() => validateStoryboardExport(p)).toThrow(/missing/);
});
it("isolates source intervals, preserving special moves and piece identities at cuts", () => {
  for (const [fen, move] of [
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O"],
    ["4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "a8=Q+"],
    ["4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6"],
  ]) {
    let p = importFen(blank(), fen);
    const chess = new Chess(fen);
    const m = chess.move(move);
    p = appendMove(p, -1, m.from, m.to, m.promotion ?? "q");
    p.storyboard.shots = [shotFromMove(p, p.moves[0].id)];
    const c = compileStoryboard(p).shots[0];
    expect(c.game.initial).toEqual(buildGame(p).initial);
    const e = evaluate(c.project, c.shot.duration, c.game);
    expect(e.pieces.map((v) => [v.square, v.type]).sort()).toEqual(
      c.game.steps[0].after.map((v) => [v.square, v.type]).sort(),
    );
  }
});
it("freezes a legal position without replaying animation; keeps shot settings independent", () => {
  const p = sample(),
    source = JSON.stringify(p.moves),
    s = shotFromMove(p, p.moves[6].id, "position-hold", "after");
  p.storyboard.shots = [s];
  const c = compileStoryboard(p).shots[0];
  expect(c.project.moves).toEqual([]);
  expect(c.game.initial).toEqual(buildGame(p).steps[6].after);
  expect(evaluate(c.project, 0, c.game).pieces).toEqual(
    evaluate(c.project, 2, c.game).pieces,
  );
  s.camera = { ...camera(), mode: "manual", zoom: 2 };
  expect(JSON.stringify(p.moves)).toBe(source);
});
it("handles empty, title-only and trimmed shots and clamps annotations on duration edits", () => {
  const p = sample();
  expect(resolveStoryboardFrame(p, 0)).toBeNull();
  expect(() => validateStoryboardExport(p)).toThrow(/Add/);
  const t = titleShot(p, "Find the move", 3);
  p.storyboard.shots = [t];
  expect(compileStoryboard({ ...p }).duration).toBe(3);
  resizeShot(t, 1);
  expect(t.annotations[0].end).toBe(1);
  const s = shotFromMove(p, p.moves[0].id);
  s.trimStart = 500;
  p.storyboard.shots = [s];
  expect(compileStoryboard({ ...p }).issues[0].message).toMatch(/Trims/);
});
it("returns held output intervals in the reverse source mapping", () => {
  const p = sample(),
    s = shotFromMove(p, p.moves[2].id, "position-hold", "after");
  p.storyboard.shots = [s, duplicateShot(s)];
  expect(sourceToStoryboard(p, segments(p)[2].finish)).toEqual([
    { id: s.id, time: 0, end: s.duration },
    { id: p.storyboard.shots[1].id, time: s.duration, end: 2 * s.duration },
  ]);
});
