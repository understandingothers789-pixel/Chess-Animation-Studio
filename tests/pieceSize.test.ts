import { describe, expect, it } from "vitest";
import { blank, effect, effectSchema } from "../src/core/project";
import { buildGame, importPgn } from "../src/core/chess";
import { evaluate, segments } from "../src/core/timeline";

function moveFixture() {
  const project = importPgn(blank(), "1. e4");
  function measure(phase: number) {
    const game = buildGame(project);
    const segment = segments(project)[0];
    const time = segment.depart + phase * project.moves[0].effect.duration;
    return evaluate(project, time, game, project.format).pieces.find(
      (piece) => piece.id === game.steps[0].pieceId,
    )!;
  }
  return { project, measure };
}

describe("piece size while turning", () => {
  it.each(["spin", "somersault", "flip"] as const)(
    "keeps %s at normal size while rotating",
    (preset) => {
      const { project, measure } = moveFixture();
      project.moves[0].effect = effect(preset);
      const middle = measure(0.3);
      expect(Math.abs(middle.ry) + Math.abs(middle.rz)).toBeGreaterThan(0.5);
      for (const phase of [0, 0.3, 0.8, 0.9999, 1])
        expect(measure(phase).scale).toBe(1);
    },
  );

  it("smooths pre-existing turns without changing their authored peak size", () => {
    const { project, measure } = moveFixture();
    const { sizeProfile, sizeReturn, ...older } = effect("spin");
    older.scale = 1.7;
    older.peak = 0.8;
    project.moves[0].effect = effectSchema.parse(older);
    const landing = older.landing;
    expect(measure(0.5 * landing).scale).toBeCloseTo(1.7);
    expect(measure(landing - 0.0001).scale).toBeCloseTo(1, 6);
    expect(measure(landing).scale).toBe(1);
    expect(measure(0.9999).scale).toBe(measure(1).scale);
  });

  it("starts a longer return earlier and still honors explicit scale keys", () => {
    const { project, measure } = moveFixture();
    const fx = (project.moves[0].effect = effect("somersault"));
    Object.assign(fx, {
      sizeProfile: "smooth",
      scale: 1.6,
      peak: 0.2,
      sizeReturn: 0.2,
    });
    const phase = fx.landing * 0.65;
    const shorter = measure(phase).scale;
    fx.sizeReturn = 0.65;
    // The fixture project is mutable, but timeline/game compilation caches by identity.
    const long = { ...project, moves: [...project.moves] };
    const game = buildGame(long);
    const time = segments(long)[0].depart + phase * fx.duration;
    expect(
      evaluate(long, time, game, long.format).pieces.find(
        (v) => v.id === game.steps[0].pieceId,
      )!.scale,
    ).toBeLessThan(shorter);
    fx.keys.scale = [{ at: 0, value: 1.31, ease: "linear" }];
    expect(measure(phase).scale).toBeCloseTo(1.31);
  });

  it("preserves the historical size profile when explicitly selected", () => {
    const { project, measure } = moveFixture();
    const fx = (project.moves[0].effect = effect("spin"));
    fx.sizeProfile = "original";
    expect(measure(0.9999).scale).toBeGreaterThan(1);
    expect(measure(1).scale).toBe(1);
  });
});
