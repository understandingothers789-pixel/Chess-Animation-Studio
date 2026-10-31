import { describe, it, expect } from "vitest";
import { blank, effect, parseProject } from "../src/core/project";
import {
  importPgn,
  importFen,
  buildGame,
  selectLine,
  appendMove,
  sample,
} from "../src/core/chess";
import {
  evaluate,
  segments,
  duration,
  sway,
  particle,
  shortsFraming,
} from "../src/core/timeline";
import { align, analyze, syncMarkers, musicAt } from "../src/core/audio";
describe("legal state and stable identities", () => {
  it("coordinates castling, en passant and promotion", () => {
    const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O");
    const s = buildGame(p).steps.at(-1)!;
    expect(s.rook?.to).toBe("f1");
    const ep = buildGame(
      importPgn(blank(), "1. e4 a6 2. e5 d5 3. exd6"),
    ).steps.at(-1)!;
    expect(ep.before.find((p) => p.id === ep.capturedId)?.square).toBe("d5");
    const promo = importFen(blank(), "7k/P7/8/8/8/8/8/7K w - - 0 1");
    const next = appendMove(promo, -1, "a7", "a8", "n");
    const g = buildGame(next);
    expect(
      g.steps[0].after.find((p) => p.id === g.steps[0].pieceId)?.type,
    ).toBe("n");
  });
  it("keeps variations separate and preserves effects only for common legal prefixes", () => {
    const p = importPgn(blank(), "1. e4 (1. d4 d5) e5 2. Nf3");
    p.moves[0].effect = effect("spin");
    expect(p.moves.map((m) => m.san)).toEqual(["e4", "e5", "Nf3"]);
    expect(selectLine(p, 1).moves.map((m) => m.san)).toEqual(["d4", "d5"]);
    expect(importPgn(p, "1. e4 e5 2. Nf3 Nc6").moves[0].effect.preset).toBe(
      "spin",
    );
    expect(() => importPgn(p, "1. e5")).toThrow();
    expect(p.moves[0].san).toBe("e4");
  });
  it("handles a terminal game", () => {
    const p = sample();
    expect(buildGame(p).steps).toHaveLength(33);
    expect(evaluate(p, duration(p)).pieces.length).toBeGreaterThan(0);
    expect(() => parseProject({ ...p, scenes: [{}] })).toThrow();
  });
});
describe("deterministic evaluation", () => {
  it("sways slowly once each way and settles, independent of travel easing", () => {
    const p = importPgn(blank(), "1. e4");
    p.moves[0].effect = effect("sway");
    const e = p.moves[0].effect,
      start = segments(p)[0].depart;
    const at = (u: number) =>
      evaluate(p, start + u * e.duration).pieces.find(
        (v) => v.id === buildGame(p).steps[0].pieceId,
      )!;
    expect(at(0.25).rz).toBeCloseTo((24 * Math.PI) / 180);
    expect(at(0.75).rz).toBeCloseTo((-24 * Math.PI) / 180);
    e.easing = "accelerate";
    expect(at(0.25).rz).toBeCloseTo((24 * Math.PI) / 180);
    expect(at(1).rz).toBe(0);
    expect(sway(0)).toBe(0);
    expect(sway(1)).toBe(0);
  });
  it("reconstructs backward seeks, normalized keys, particles and per-format cameras", () => {
    const p = sample();
    p.moves[0].effect.keys.rz = [
      { at: 0, value: 0, ease: "smooth" },
      { at: 0.5, value: 120, ease: "smooth" },
      { at: 1, value: 0, ease: "smooth" },
    ];
    p.moves[0].effect.cameras.vertical = {
      mode: "manual",
      x: 2,
      y: 1,
      zoom: 2,
      tilt: 8,
      rotation: 7,
      padding: 0,
      transition: 0.1,
    };
    const s = segments(p)[0],
      a = evaluate(p, s.depart + p.moves[0].effect.duration * 0.5);
    for (let i = 0; i < 50; i++) evaluate(p, i);
    expect(evaluate(p, s.depart + p.moves[0].effect.duration * 0.5)).toEqual(a);
    expect(evaluate(p, s.finish + 0.1).pieces.every((v) => v.rz === 0)).toBe(
      true,
    );
    expect(
      evaluate(p, s.depart + 0.5, buildGame(p), "vertical").camera.zoom,
    ).toBeCloseTo(2);
    expect(particle(4, 2, p.ambient)).toEqual(particle(4, 2, p.ambient));
    const old = p.moves[0].effect.duration;
    p.moves[0].effect.duration *= 2;
    expect(
      evaluate(p, segments(p)[0].depart + old).pieces.find((v) => v.moving)?.rz,
    ).toBeCloseTo((120 * Math.PI) / 180);
  });
});
describe("audio markers and alignment", () => {
  it("aligns landings without breaking locks or order", () => {
    const p = importPgn(blank(), "1. e4 e5 2. Nf3");
    p.moves[1].effect.locked = true;
    p.beats = Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      time: 1 + i * 0.7,
      accent: i % 4 === 0,
      enabled: true,
    }));
    const result = align(p);
    expect(result.aligned).toBeGreaterThan(0);
    expect(result.project.moves[1].effect.duration).toBe(
      p.moves[1].effect.duration,
    );
    for (const s of segments(result.project))
      if (result.project.moves[s.i].effect.landingBeat)
        expect(s.land).toBeCloseTo(
          p.beats.find(
            (b) => b.id === result.project.moves[s.i].effect.landingBeat,
          )!.time,
        );
  });
  it("keeps source marker corrections during trim and offset edits", () => {
    const p = blank();
    p.music.trimStart = 0.2;
    p.music.offset = 0.4;
    p.beats = [
      { id: "a", time: 0.7, sourceTime: 0.5, accent: true, enabled: true },
    ];
    expect(syncMarkers(p).beats[0].time).toBeCloseTo(0.7);
    expect(musicAt(p, 0.7)).toBeCloseTo(0.5);
  });
  it("detects transients without inventing an exact tempo", () => {
    const pcm = new Float32Array(48000 * 2);
    for (const t of [0.5, 1, 1.5])
      for (let i = 0; i < 180; i++)
        pcm[Math.round(t * 48000) + i] = Math.sin(i * 0.2) * 0.9;
    const result = analyze(pcm, 48000);
    expect(result.peaks.length).toBeGreaterThanOrEqual(3);
    expect(result.waveform.length).toBeLessThanOrEqual(1600);
  });
});

it("half sway leans once without reversing and settles smoothly", () => {
  const p = importPgn(blank(), "1. e4");
  p.moves[0].effect = effect("sway-half");
  expect(p.moves[0].effect.cycles).toBe(0.5);
  expect(sway(0.5, 0.5)).toBeCloseTo(1);
  for (let i = 0; i <= 100; i++)
    expect(sway(i / 100, 0.5)).toBeGreaterThanOrEqual(0);
  expect(sway(1, 0.5)).toBe(0);
  expect(parseProject(p).moves[0].effect.cycles).toBe(0.5);
});

it("board effects have bounded non-blackout defaults and a first-move sway", () => {
  const p = importPgn(blank(), "1. e4 e5");
  expect(p.moves[0].effect.preset).toBe("sway");
  expect(p.lead).toBeGreaterThanOrEqual(p.boardFX.introDuration);
  expect(p.boardFX.shimmer).toBeLessThan(0.2);
  expect(p.boardFX.introTurn).toBe(45);
  const old = JSON.parse(JSON.stringify(p));
  delete old.boardFX;
  expect(parseProject(old).boardFX.intro).toBe(true);
});

it("defaults legacy projects to board-only snow and a selectable zoom-turn opener", () => {
  const old: any = blank();
  delete old.ambient.insideBoard;
  delete old.boardFX.introPreset;
  const p = parseProject(old);
  expect(p.ambient.insideBoard).toBe(true);
  expect(p.boardFX.introPreset).toBe("zoom-turn");
  for (const preset of ["zoom-turn", "zoom", "turn", "still"] as const) {
    p.boardFX.introPreset = preset;
    expect(parseProject(p).boardFX.introPreset).toBe(preset);
  }
});

describe("Shorts close-up framing", () => {
  it("loads older projects with Shorts off and computes a cropped portrait window", () => {
    const old: any = blank();
    delete old.shorts;
    const p = parseProject(old);
    expect(p.shorts.enabled).toBe(false);
    const frame = evaluate(p, 0).camera;
    const c = shortsFraming(p, { ...frame, zoom: 1, x: 0, y: 0 }, 1080, 1920);
    expect(c.halfX * 2).toBeCloseTo(6);
    expect(c.halfY * 2).toBeLessThan(8);
    expect(c.viewH).toBe(1382);
    expect(c.viewY).toBe(269);
  });
  it("bounds tracking to the board and reconstructs identical framing after seeking", () => {
    const p = sample();
    p.shorts.enabled = true;
    p.format = "vertical";
    const first = shortsFraming(p, evaluate(p, 6).camera, 1080, 1920);
    shortsFraming(p, evaluate(p, 30).camera, 1080, 1920);
    expect(shortsFraming(p, evaluate(p, 6).camera, 1080, 1920)).toEqual(first);
    const c = shortsFraming(
      p,
      { ...evaluate(p, 6).camera, x: 100, y: -100, zoom: 1 },
      1080,
      1920,
    );
    expect(c.x + c.halfX).toBeLessThanOrEqual(4);
    expect(c.y - c.halfY).toBeGreaterThanOrEqual(-4);
    p.shorts.follow = false;
    expect(
      shortsFraming(p, { ...evaluate(p, 6).camera, x: 100 }, 1080, 1920).x,
    ).toBe(0);
  });
});
