import {
  Group,
  type Mesh,
  type MeshBasicMaterial,
  type PlaneGeometry,
} from "three";
import { MotionSystem } from "../src/render/systems/MotionSystem";
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

it("continues releasing owned resources after a disposer fails", () => {
  const r = new Resources(),
    calls: number[] = [];
  r.own({
    dispose() {
      calls.push(1);
    },
  });
  r.own({
    dispose() {
      calls.push(2);
      throw Error("release");
    },
  });
  expect(() => r.dispose()).toThrow(/cleanup/);
  r.dispose();
  expect(calls).toEqual([2, 1]);
});

it("matches both highlight endpoints to the notation palette with project and move overrides", () => {
  const project = importPgn(blank(), "1. e4 e5");
  const [move] = project.moves;
  const { highlight } = move.effect;
  Object.assign(highlight, {
    glow: 0,
    byMover: false,
    source: "#665533",
    destination: "#223355",
  });
  const root = new Group();
  const motion = new MotionSystem(root);
  const colors = (p: typeof project) => {
    const snapshot = structuredClone(p);
    const time = segments(snapshot)[0].land - 0.05;
    motion.update(evaluateRenderFrame(snapshot, time, 320, 180));
    return [12, 28].map((square) => {
      const mesh = root.children[square] as Mesh<
        PlaneGeometry,
        MeshBasicMaterial
      >;
      return mesh.visible
        ? "#" + mesh.material.color.getHexString().toUpperCase()
        : null;
    });
  };

  for (const rating of ["brilliant", "blunder", "good", "book"] as const) {
    move.effect.badge.manual = rating;
    expect(colors(project)).toEqual([
      project.reviewColors[rating],
      project.reviewColors[rating],
    ]);
  }
  project.reviewColors.book = "#FF8901";
  move.effect.badge.manual = null;
  move.analysis.book = {
    state: "found",
    games: 100,
    frequency: 0.5,
    message: "Book",
  };
  expect(colors(project)).toEqual(["#FF8901", "#FF8901"]);

  Object.assign(move.effect.light, {
    enabled: true,
    strength: 0.4,
    color: "#FF0000",
  });
  expect(colors(project)).toEqual(["#FF8901", "#FF8901"]);
  highlight.byNotation = false;
  expect(colors(project)).toEqual(["#665533", "#223355"]);
  highlight.byNotation = true;
  move.effect.light.enabled = false;
  project.reviewColors.enabled = false;
  expect(colors(project)).toEqual(["#665533", "#223355"]);
  project.reviewColors.enabled = true;
  move.effect.badge.manual = "none";
  expect(colors(project)).toEqual(["#665533", "#223355"]);
  highlight.showSource = false;
  expect(colors(project)[0]).toBeNull();
  motion.dispose();
});
