import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { blankProject, parseProject, effectPreset } from "../src/core/model";
import {
  importPgn,
  importFen,
  appendMove,
  buildGame,
  sampleProject,
} from "../src/core/chess";
import {
  evaluate,
  segments,
  duration,
  particle,
  routeSquares,
  sway,
} from "../src/core/timeline";
import {
  alignLandings,
  musicTime,
  analyzePcm,
  correctBeat,
} from "../src/core/audio";

describe("legal chess and stable subjects", () => {
  it("coordinates castling and identifies an en passant capture", () => {
    const castle = importPgn(
      blankProject(),
      "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O",
    );
    const g = buildGame(castle),
      s = g.steps.at(-1)!;
    expect(s.rook?.from).toBe("h1");
    expect(s.rook?.to).toBe("f1");
    const final = evaluate(castle, duration(castle));
    expect(final.pieces.find((p) => p.id === s.pieceId)?.square).toBe("g1");
    expect(final.pieces.find((p) => p.id === s.rook!.id)?.square).toBe("f1");
    const ep = importPgn(blankProject(), "1. e4 a6 2. e5 d5 3. exd6");
    const eg = buildGame(ep),
      capture = eg.steps.at(-1)!;
    expect(capture.before.find((p) => p.id === capture.captureId)?.square).toBe(
      "d5",
    );
    expect(capture.after.some((p) => p.id === capture.captureId)).toBe(false);
    expect(
      evaluate(ep, duration(ep)).pieces.find((p) => p.id === capture.captureId)
        ?.opacity,
    ).toBe(0);
  });
  it("promotes without losing identity and handles checkmate/empty terminal projects", () => {
    let p = importFen(blankProject(), "7k/P7/8/8/8/8/8/K7 w - - 0 1");
    p = appendMove(p, "a7a8q");
    const g = buildGame(p),
      s = g.steps[0];
    expect(s.before.find((v) => v.id === s.pieceId)?.type).toBe("p");
    expect(s.after.find((v) => v.id === s.pieceId)?.type).toBe("q");
    const mate = sampleProject();
    expect(buildGame(mate).terminal).toBe(true);
    expect(evaluate(mate, duration(mate)).mate).toBe(true);
    expect(
      evaluate(importFen(blankProject(), buildGame(mate).finalFen), 0).pieces
        .length,
    ).toBeGreaterThan(0);
  });
  it("preserves variation boundaries and rejects invalid imports without mutation", () => {
    const original = blankProject(),
      p = importPgn(original, "1. e4 (1. d4 d5) e5 2. Nf3");
    expect(p.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(p.lines[1].sans).toEqual(["d4", "d5"]);
    expect(() => importPgn(original, "1. e5")).toThrow();
    expect(() => importFen(original, "invalid")).toThrow();
    expect(original.moves).toEqual([]);
    const reimport = importPgn(p, "1. e4 e5 2. Nf3 Nc6");
    expect(reimport.moves[0].id).toBe(p.moves[0].id);
  });
});
describe("deterministic animation", () => {
  it("reconstructs turns, camera, particles, and backward seeks without drift", () => {
    const p = importPgn(blankProject(), "1. e4 e5 2. Nf3");
    p.moves[0].effect = effectPreset("spin");
    const s = segments(p)[0],
      at = s.departure + p.moves[0].effect.duration * 0.38;
    const a = evaluate(p, at);
    expect(Math.abs(a.pieces.find((v) => v.moving)!.ry)).toBeGreaterThan(1);
    for (let i = 0; i < 100; i++) evaluate(p, i * 0.1);
    expect(evaluate(p, at)).toEqual(a);
    const final = evaluate(p, segments(p)[0].end - 0.001).pieces.find(
      (v) => v.id === buildGame(p).steps[0].pieceId,
    )!;
    expect(final.scale).toBe(1);
    expect(final.x).toBe(0.5);
    expect(particle(17, 2, 3, p.ambient)).toEqual(
      particle(17, 2, 3, p.ambient),
    );
    expect(particle(17, 2, 3, p.ambient)).not.toEqual(
      particle(18, 2, 3, p.ambient),
    );
  });
  it("preserves normalized curves when duration changes and shifts later moves", () => {
    const p = importPgn(blankProject(), "1. e4 e5");
    p.moves[0].effect.keys.scale = [
      { t: 0, value: 1, easing: "linear" },
      { t: 0.5, value: 2, easing: "linear" },
      { t: 1, value: 1, easing: "linear" },
    ];
    const old = segments(p),
      before = evaluate(p, old[0].departure + p.moves[0].effect.duration * 0.5);
    p.moves[0].effect.duration *= 2;
    const next = segments(p),
      after = evaluate(p, next[0].departure + p.moves[0].effect.duration * 0.5);
    expect(before.pieces.find((v) => v.moving)?.scale).toBe(
      after.pieces.find((v) => v.moving)?.scale,
    );
    expect(next[1].start).toBeGreaterThan(old[1].start);
    expect(routeSquares("a1", "a4", "r")).toEqual(["a1", "a2", "a3", "a4"]);
    expect(routeSquares("b1", "c3", "n")).toEqual(["b1", "c3"]);
  });
  it("manual badges override independent suggestions and survive round trips", () => {
    const p = importPgn(blankProject(), "1. e4");
    p.moves[0].effect.badge.manual = "brilliant";
    p.moves[0].analysis.book = {
      state: "found",
      games: 100,
      frequency: 0.1,
      source: "test",
      message: "",
    };
    const q = parseProject(JSON.parse(JSON.stringify(p))),
      s = segments(q)[0];
    expect(
      evaluate(q, s.departure + q.moves[0].effect.duration * 0.7).badge,
    ).toBe("brilliant");
    expect(q.moves[0].analysis.book?.state).toBe("found");
    expect(() => parseProject({ ...q, schemaVersion: 2 })).toThrow();
  });
});
describe("music and beat timing", () => {
  it("aligns landings, respects locked moves, and leaves music in place", () => {
    const p = importPgn(blankProject(), "1. e4 e5 2. Nf3");
    p.moves[0].effect.locked = true;
    p.beats = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      time: 1 + i,
      strong: i % 2 === 0,
      selected: true,
    }));
    const { project: q, changed } = alignLandings(p, "all");
    expect(changed).toBe(2);
    expect(q.moves[0].effect).toEqual(p.moves[0].effect);
    for (const s of segments(q).slice(1))
      expect(p.beats.some((b) => Math.abs(b.time - s.landing) < 1e-8)).toBe(
        true,
      );
    expect(p.moves[1].effect.landingBeat).toBe(null);
  });
  it("handles offsets, trims, and transient detection", () => {
    const p = blankProject();
    p.music = {
      assetId: "a",
      offset: 2,
      trimStart: 3,
      trimEnd: 8,
      duration: 10,
      volume: 1,
      muted: false,
      fadeIn: 0,
      fadeOut: 0,
      waveform: [],
    };
    expect(musicTime(p, 1)).toBe(null);
    expect(musicTime(p, 2)).toBe(3);
    expect(musicTime(p, 7)).toBe(null);
    const rate = 48000,
      pcm = new Float32Array(rate * 3);
    for (const t of [0.5, 1, 1.5, 2])
      for (let i = 0; i < 1000; i++)
        pcm[Math.round(t * rate) + i] = Math.sin(i * 0.3) * Math.exp(-i / 200);
    const detected = analyzePcm(pcm, rate);
    expect(detected.beats.length).toBeGreaterThanOrEqual(4);
    expect(detected.waveform.some((v) => v > 0.5)).toBe(true);
  });
  it("refits corrected beat anchors without reordering moves and releases impossible anchors", () => {
    const p = importPgn(blankProject(), "1. e4 e5");
    p.beats = [
      { id: "a", time: 1.8, strong: true, selected: true },
      { id: "b", time: 4, strong: false, selected: true },
    ];
    const q = alignLandings(p, "all").project;
    correctBeat(q, "a", 2);
    expect(segments(q)[0].landing).toBeCloseTo(2);
    expect(segments(q)[1].start).toBeGreaterThan(segments(q)[0].landing);
    correctBeat(q, "a", 0);
    expect(q.moves[0].effect.landingBeat).toBe(null);
  });
  it("keeps per-format camera overrides independent and preserves legal end states with free position keys", () => {
    const p = importPgn(blankProject(), "1. e4");
    p.moves[0].effect.cameras.square = {
      mode: "manual",
      x: 2,
      y: 1,
      zoom: 1.8,
      transition: 0.1,
      tilt: 4,
      rotation: 2,
      padding: 0.5,
    };
    p.moves[0].effect.keys.positionX = [
      { t: 0, value: 0, easing: "linear" },
      { t: 1, value: 3, easing: "linear" },
    ];
    const s = segments(p)[0],
      at = s.departure + 0.6;
    expect(evaluate(p, at, undefined, "square").camera.zoom).not.toBe(
      evaluate(p, at, undefined, "vertical").camera.zoom,
    );
    expect(
      evaluate(p, duration(p)).pieces.find(
        (x) => x.id === buildGame(p).steps[0].pieceId,
      )?.x,
    ).toBe(0.5);
  });
});

it("slow sway makes one broad lean each way and seeks deterministically", () => {
  const p = importPgn(blankProject(), "1. e4");
  p.moves[0].effect = effectPreset("wiggle");
  const e = p.moves[0].effect;
  expect(e.frequency).toBe(1);
  expect(e.duration).toBeGreaterThanOrEqual(2);
  const start = segments(p)[0].departure;
  const angle = (u: number) =>
    evaluate(p, start + u * e.duration).pieces.find(
      (v) => v.id === buildGame(p).steps[0].pieceId,
    )!.rz;
  expect(angle(0)).toBeCloseTo(0);
  expect(angle(0.25)).toBeCloseTo((24 * Math.PI) / 180);
  expect(angle(0.75)).toBeCloseTo((-24 * Math.PI) / 180);
  expect(angle(1)).toBeCloseTo(0);
  const earlier = angle(0.25);
  angle(0.9);
  expect(angle(0.25)).toBe(earlier);
  expect(sway(0.2499)).toBeCloseTo(sway(0.2501), 5);
});
