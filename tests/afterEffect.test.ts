import { describe, expect, it } from "vitest";
import { buildGame, importPgn } from "../src/core/chess";
import { pasteSettings } from "../src/core/editing";
import { blank, effect, effectSchema, type Effect } from "../src/core/project";
import { afterEffectWindow, evaluate, segments } from "../src/core/timeline";
import { moveFrameStops, movePreviewWindow } from "../src/ui/movePreview";

function fixture(kind: Effect["after"]["kind"]) {
  const project = importPgn(blank(), "1. e4 d5 2. exd5 Nf6");
  const index = 2;
  const fx = project.moves[index].effect;
  Object.assign(fx, {
    duration: 1,
    hold: 0.1,
    after: { kind, delay: 0.2, duration: 0.8, strength: 0.5 },
  });
  const game = buildGame(project);
  const step = game.steps[index];
  const frames = segments(project);
  const sample = (time: number) =>
    evaluate(project, time, game, project.format);
  const mover = (time: number) =>
    sample(time).pieces.find((piece) => piece.id === step.pieceId)!;
  return { project, index, fx, step, frames, sample, mover };
}

describe("modular move follow-ups", () => {
  it("plays a rebound after a capture with a smooth return and stays in its clip", () => {
    const { project, index, fx, step, frames, sample, mover } =
      fixture("rebound");
    const segment = frames[index];
    const window = afterEffectWindow(fx, segment)!;
    const peak = (window.start + window.end) / 2;
    expect(window.start).toBeCloseTo(segment.finish + 0.2);
    expect(frames[index + 1].start).toBeCloseTo(window.end);
    expect(movePreviewWindow(project, index)?.end).toBeCloseTo(window.end);
    expect(moveFrameStops(project, index).slice(-2)).toEqual([
      { label: "After-effect peak", time: peak },
      { label: "After-effect end", time: window.end },
    ]);
    expect(
      sample(peak).pieces.some((piece) => piece.id === step.capturedId),
    ).toBe(false);
    expect(mover(peak)).toMatchObject({ square: "d5", z: 0.35, scale: 1 });
    for (const time of [window.start, window.end])
      expect(mover(time).z).toBe(0);
  });

  it.each(["size-pulse", "camera-pulse"] as const)(
    "isolates %s from movement and restores the resting frame",
    (kind) => {
      const { fx, frames, index, sample, mover } = fixture(kind);
      const { start, end } = afterEffectWindow(fx, frames[index])!;
      const mid = (start + end) / 2;
      expect(mover(mid).z).toBe(0);
      expect(mover(mid).scale).toBe(kind === "size-pulse" ? 1.5 : 1);
      expect(mover(end).scale).toBe(1);
      if (kind === "camera-pulse")
        expect(sample(mid).camera.zoom).toBeGreaterThan(
          sample(start).camera.zoom,
        );
    },
  );

  it("defaults older moves to no follow-up and copies each module independently", () => {
    const { after: _, ...older } = effect("hop");
    const target = effectSchema.parse(older);
    const source = effect("somersault");
    source.after = {
      kind: "rebound",
      delay: 0.2,
      duration: 0.7,
      strength: 0.9,
    };
    source.scale = 0.7;
    source.keys.scale = [{ at: 0.5, value: 0.8, ease: "smooth" }];
    const paste = (kind: "movement" | "size" | "after-effect", to = target) =>
      pasteSettings(to, { kind, source, format: "vertical" });
    expect(paste("movement")).toMatchObject({
      preset: "somersault",
      after: { kind: "none" },
      scale: target.scale,
      keys: {},
    });
    expect(paste("size")).toMatchObject({
      preset: "hop",
      scale: 0.7,
      after: { kind: "none" },
      keys: { scale: source.keys.scale },
    });
    expect(paste("after-effect")).toMatchObject({
      preset: "hop",
      scale: target.scale,
      after: source.after,
    });
    expect(paste("after-effect", { ...target, locked: true }).after).toEqual({
      ...target.after,
      strength: source.after.strength,
    });
  });
});
