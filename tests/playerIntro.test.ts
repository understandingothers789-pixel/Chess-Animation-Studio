import { expect, it } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { requiredAssetIds } from "../src/core/exportAssets";
import { shotFromMove } from "../src/core/storyboard";
import { evaluatePresentationFrame } from "../src/render/engine/presentation";
import { playerIntroFrame } from "../src/render/engine/playerIntro";

it("defaults older files to thinner edges, and keeps their square colors", () => {
  const p = blank();
  const {
    playerIntro: _,
    style: { pieceEdgeDepth: _depth, ...style },
    ...older
  } = p;
  const restored = parseProject({
    ...older,
    style: { ...style, dark: "#556677" },
  });
  expect(restored.style.pieceEdgeDepth).toBe(0.4);
  expect(restored.style.dark).toBe("#556677");
  expect(restored.playerIntro.enabled).toBe(false);
});

it("includes the photo only in exports that use it", () => {
  const p = blank();
  p.playerIntro = { ...p.playerIntro, enabled: true, asset: "photo" };
  const options = { format: "vertical" as const, start: 0, end: p.lead + 1 };
  expect(requiredAssetIds(p, options).has("photo")).toBe(true);
  expect(requiredAssetIds(p, { ...options, start: p.lead }).has("photo")).toBe(
    false,
  );
  p.playerIntro.enabled = false;
  const shot = shotFromMove(p, "@start", "position-hold");
  p.storyboard.shots = [{ ...shot, showPlayerIntro: true }];
  expect(
    requiredAssetIds(p, {
      ...options,
      mode: "storyboard",
      end: shot.duration,
    }).has("photo"),
  ).toBe(true);
  const evaluate = (time: number) =>
    playerIntroFrame(
      evaluatePresentationFrame(p, time, 320, 568, "vertical", "storyboard"),
    );
  expect(evaluate(0)?.opacity).toBe(0);
  expect(evaluate(1)?.opacity).toBe(1);
  expect(evaluate(shot.duration)).toBeNull();
});
