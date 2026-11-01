import { it, expect } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { importPgn, buildGame } from "../src/core/chess";
import { evaluateRenderFrame } from "../src/render/engine/frame";
import { captureImpact } from "../src/render/engine/impact";
import { segments } from "../src/core/timeline";
import { squareToWorld, worldToSquare } from "../src/render/engine/coordinates";
import { Resources } from "../src/render/engine/resources";
it("reconstructs frames independently without modifying persistent projects", () => {
  const p = importPgn(blank(), "1. e4 d5 2. exd5 Qxd5");
  const before = JSON.stringify(p),
    g = buildGame(p);
  const frames = new Map<number, string>();
  for (const time of [0, 5, 2, 8, 5, 1, 8]) {
    const frame = evaluateRenderFrame(p, time, 360, 640, "vertical", g);
    const state = JSON.stringify({ ...frame, game: undefined });
    if (frames.has(time)) expect(state).toBe(frames.get(time));
    frames.set(time, state);
  }
  expect(JSON.stringify(p)).toBe(before);
});
it("preserves legacy neutral capture behavior and rejects invalid settings", () => {
  const p = blank(),
    legacy = JSON.parse(JSON.stringify(p));
  const project = parseProject(legacy);
  expect(() => evaluateRenderFrame(project, Infinity, 10, 10)).toThrow(/time/);
  expect(() => evaluateRenderFrame(project, 1, -10, 10)).toThrow(/dimensions/);
  const game = importPgn(p, "1. e4 d5 2. exd5");
  const without = JSON.parse(JSON.stringify(game));
  delete without.moves[2].effect.capture.cameraShake;
  delete without.moves[2].effect.capture.impactLight;
  expect(parseProject(without).moves[2].effect.capture.cameraShake).toBe(0);
  without.moves[2].effect.capture.cameraShake = 10;
  expect(() => parseProject(without)).toThrow();
});
it("coordinates capture accents at absolute contact time and restores neutral state", () => {
  const p = importPgn(blank(), "1. e4 d5 2. exd5");
  const effect = p.moves[2].effect;
  effect.capture.cameraShake = 0.5;
  effect.capture.impactLight = 0.8;
  const contact =
      segments(p)[2].depart + effect.duration * effect.capture.impact,
    g = buildGame(p);
  expect(captureImpact(p, g, contact - 0.001).light).toBe(0);
  const first = captureImpact(p, g, contact + 0.02);
  expect(first.light).toBeGreaterThan(0);
  captureImpact(p, g, contact + 1);
  expect(captureImpact(p, g, contact + 0.02)).toEqual(first);
  expect(captureImpact(p, g, contact + 1)).toEqual({
    x: 0,
    y: 0,
    light: 0,
    color: "#ffffff",
  });
});
it("round trips board coordinates and disposes each owned resource once", () => {
  for (const square of ["a1", "h8", "e4"])
    expect(worldToSquare(...squareToWorld(square))).toBe(square);
  expect(worldToSquare(4, 0)).toBeNull();
  const resources = new Resources();
  let count = 0;
  const item = {
    dispose() {
      count++;
    },
  };
  resources.own(item);
  resources.own(item);
  resources.dispose();
  resources.dispose();
  expect(count).toBe(1);
});
