import { it, expect } from "vitest";
import {
  blank,
  parseProject,
  cinematicSchema,
  cinematicPresets,
} from "../src/core/project";
import { cinematicParticle } from "../src/render/systems/CinematicCaptureSystem";
it("keeps old projects disabled and round trips presets", () => {
  const p = blank();
  delete (p as any).cinematic;
  expect(parseProject(p).cinematic.enabled).toBe(false);
  for (const preset of Object.values(cinematicPresets))
    expect(cinematicSchema.parse(preset)).toEqual(preset);
});
it("reconstructs analytic particles on backward seeks with deceleration", () => {
  for (let kind = 0; kind < 3; kind++) {
    const a = cinematicParticle(42, 0.3, 1, kind);
    cinematicParticle(42, 2, 1, kind);
    expect(cinematicParticle(42, 0.3, 1, kind)).toEqual(a);
    const d = (t: number) =>
      Math.hypot(
        ...Object.values(cinematicParticle(42, t, 1, kind)).slice(0, 2),
      );
    expect(d(2) - d(1)).toBeLessThan(d(1) - d(0));
  }
});
it("rejects invalid cinematic parameters", () => {
  for (const patch of [
    { amount: 257 },
    { duration: 0 },
    { size: -1 },
    { spread: 5 },
  ])
    expect(
      cinematicSchema.safeParse({ ...cinematicPresets.Epic, ...patch }).success,
    ).toBe(false);
});
import * as T from "three";
import { CinematicCaptureSystem } from "../src/render/systems/CinematicCaptureSystem";
import { evaluateRenderFrame } from "../src/render/engine/frame";
import { readFileSync } from "node:fs";
import { segments } from "../src/core/timeline";
it("allocates bounded batches lazily, replays positions and disposes on disable", () => {
  const p = parseProject(
      JSON.parse(readFileSync("samples/Opera.castudio", "utf8")),
    ),
    root = new T.Group(),
    camera = new T.OrthographicCamera(-5, 5, 5, -5);
  const system = new CinematicCaptureSystem(root, camera, new Map());
  const index = p.moves.findIndex((m) => m.san.includes("x"));
  const time =
    segments(p)[index].depart +
    p.moves[index].effect.duration * p.moves[index].effect.capture.impact +
    0.2;
  system.update(evaluateRenderFrame(p, time, 320, 180));
  expect(root.children.length).toBe(0);
  p.cinematic = { ...cinematicPresets.Epic };
  system.update(evaluateRenderFrame(p, time, 320, 180));
  expect(root.children[0].children.length).toBe(4);
  const point = root.children[0].children[0] as T.Points;
  const before = Array.from(point.geometry.attributes.position.array);
  let disposed = 0;
  point.geometry.addEventListener("dispose", () => disposed++);
  system.update(evaluateRenderFrame(p, time + 1, 640, 360));
  system.update(evaluateRenderFrame(p, time, 320, 180));
  expect(Array.from(point.geometry.attributes.position.array)).toEqual(before);
  expect(point.geometry.drawRange.count).toBeLessThanOrEqual(1536);
  system.update(
    evaluateRenderFrame(
      { ...p, cinematic: { ...p.cinematic, enabled: false } },
      time,
      320,
      180,
    ),
  );
  expect(root.children.length).toBe(0);
  expect(disposed).toBe(1);
  system.dispose();
  expect(disposed).toBe(1);
});
