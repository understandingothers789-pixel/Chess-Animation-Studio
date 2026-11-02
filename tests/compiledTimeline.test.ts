import { expect, it } from "vitest";
import {
  compileTimeline,
  segments,
  duration,
  evaluate,
} from "../src/core/timeline";
import { blank } from "../src/core/project";
import { buildGame, importPgn } from "../src/core/chess";
it.each([
  ["capture", "1. e4 d5 2. exd5 Qxd5"],
  ["castle", "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O"],
  ["en-passant", "1. e4 a6 2. e5 d5 3. exd6"],
  [
    "long",
    Array.from(
      { length: 75 },
      (_, i) => `${i * 2 + 1}. Nf3 Nf6 ${i * 2 + 2}. Ng1 Ng8`,
    ).join(" "),
  ],
])("preserves timing and backward-seek frames for %s", (_, pgn) => {
  const p = importPgn(blank(), pgn),
    g = buildGame(p),
    compiled = compileTimeline(p);
  expect(compileTimeline(p)).toBe(compiled);
  expect(compiled.segments).toEqual(segments(p));
  expect(compiled.duration).toBe(duration(p));
  for (const t of [0, 5, 2, 8, 5, 1, 8, duration(p) - 0.1])
    expect(evaluate(p, t, g, p.format, compiled)).toEqual(evaluate(p, t, g));
  const next = { ...p, lead: p.lead + 1 };
  expect(compileTimeline(next)).not.toBe(compiled);
  expect(compileTimeline(next).segments[0].start).toBe(
    compiled.segments[0].start + 1,
  );
  expect(compileTimeline(p)).toBe(compiled);
});
