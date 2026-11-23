import { expect, it } from "vitest";
import { appendMove, buildGame, importFen } from "../src/core/chess";
import { pasteSettings } from "../src/core/editing";
import { requiredAssetIds } from "../src/core/exportAssets";
import { blank, effect, effectSchema } from "../src/core/project";
import { shotFromMove } from "../src/core/storyboard";
import { duration, evaluate, memeWindow, segments } from "../src/core/timeline";
import { evaluatePresentationFrame } from "../src/render/engine/presentation";
import { moveFrameStops } from "../src/ui/movePreview";

function capture() {
  const project = appendMove(
    importFen(blank(), "7k/8/8/1q6/8/8/8/4KB2 w - - 0 1"),
    -1,
    "f1",
    "b5",
  );
  project.lead = 1;
  project.moves[0].effect.preMoveMeme = { asset: "reaction", duration: 0.6 };
  return project;
}

it("fills the bishop origin before departure and preserves the legal capture", () => {
  const p = capture();
  const game = buildGame(p);
  const move = game.steps[0];
  const segment = segments(p)[0];
  expect(move.move.san).toBe("Bxb5");
  expect(segment.depart).toBe(1.6);
  expect(evaluate(p, 0.99, game).preMoveMeme).toBeNull();
  expect(evaluate(p, 1.2, game).preMoveMeme).toEqual({
    asset: "reaction",
    square: "f1",
    pieceId: move.pieceId,
  });
  expect(evaluate(p, 1.6, game).preMoveMeme).toBeNull();
  const landed = evaluate(p, segment.finish + 0.01, game);
  expect(landed.pieces.find((v) => v.id === move.pieceId)?.square).toBe("b5");
  expect(landed.pieces.some((v) => v.id === move.capturedId)).toBe(false);
  expect(moveFrameStops(p, 0)[0]).toEqual({ label: "Meme", time: 1 });
});

it("uses the end of an existing delay and respects timing locks", () => {
  const p = capture();
  const fx = p.moves[0].effect;
  fx.delay = 1;
  expect(memeWindow(fx, segments(p)[0])).toEqual({
    start: 1.4,
    end: 2,
    asset: "reaction",
  });

  const target = { ...fx, delay: 0, locked: true };
  const source = effect("hop");
  const paste = () =>
    pasteSettings(target, {
      kind: "everything",
      source,
      format: "vertical",
    });
  expect(paste()).toMatchObject({ preMoveMeme: null, delay: 0.6 });
  source.preMoveMeme = { asset: "different", duration: 0.7 };
  expect(paste().preMoveMeme).toEqual(target.preMoveMeme);

  const { preMoveMeme: _, ...older } = effect("slide");
  expect(effectSchema.parse(older).preMoveMeme).toBeNull();
});

it("includes the image in applicable exports and honors storyboard source trims", () => {
  const p = capture();
  const segment = segments(p)[0];
  const options = { format: p.format, start: 0, end: duration(p) };
  expect(requiredAssetIds(p, options).has("reaction")).toBe(true);
  expect(
    requiredAssetIds(p, { ...options, start: segment.depart }).has("reaction"),
  ).toBe(false);

  const shot = shotFromMove(p, p.moves[0].id);
  p.storyboard.shots = [shot];
  const story = { ...options, mode: "storyboard" as const, end: shot.duration };
  expect(requiredAssetIds(p, story).has("reaction")).toBe(true);
  expect(
    evaluatePresentationFrame(p, 0.2, 360, 640, p.format, "storyboard").e
      .preMoveMeme?.square,
  ).toBe("f1");

  const trimmed = {
    ...p,
    storyboard: { ...p.storyboard, shots: [{ ...shot, trimStart: 0.64 }] },
  };
  expect(requiredAssetIds(trimmed, story).has("reaction")).toBe(false);
  expect(
    evaluatePresentationFrame(trimmed, 0.2, 360, 640, p.format, "storyboard").e
      .preMoveMeme,
  ).toBeNull();
});
