import { expect, it } from "vitest";
import { blank, parseProject, bloomSchema } from "../src/core/project";
it("loads old projects with disabled bloom and preserves new settings", () => {
  const p = blank();
  const old = { ...p } as Record<string, unknown>;
  delete old.bloom;
  expect(parseProject(old).bloom.enabled).toBe(false);
  p.bloom.enabled = true;
  p.bloom.intensity = 0.65;
  p.bloom.pieces = false;
  expect(parseProject(JSON.parse(JSON.stringify(p))).bloom).toEqual(p.bloom);
});
it("rejects invalid bloom controls", () => {
  for (const patch of [
    { intensity: Infinity },
    { threshold: -1 },
    { radius: 9 },
    { softness: 0 },
  ])
    expect(bloomSchema.safeParse({ ...blank().bloom, ...patch }).success).toBe(
      false,
    );
});

import * as T from "three";
import { vi } from "vitest";
import { BloomSystem } from "../src/render/systems/BloomSystem";
import type { RenderFrame } from "../src/render/engine/frame";
it("reuses bloom targets, releases them on resize/disable, and restores selection after a failed draw", () => {
  const targets = new Set<T.WebGLRenderTarget>();
  let disposed = 0;
  let fail = false;
  const renderer = {
    setViewport: vi.fn(),
    copyFramebufferToTexture: vi.fn(),
    setClearColor: vi.fn(),
    setScissorTest: vi.fn(),
    setScissor: vi.fn(),
    clear: vi.fn(),
    setRenderTarget(target: T.WebGLRenderTarget | null) {
      if (target && !targets.has(target)) {
        targets.add(target);
        target.addEventListener("dispose", () => disposed++);
      }
    },
    render() {
      if (fail) throw Error("mask draw failed");
    },
  };
  const world = new T.Scene();
  const material = new T.MeshBasicMaterial();
  const mesh = new T.Mesh(new T.PlaneGeometry(), material);
  world.add(mesh);
  const system = new BloomSystem(
    renderer as unknown as T.WebGLRenderer,
    world,
    new T.Camera(),
  );
  const p = blank();
  const frame = { p, w: 480, h: 270, viewY: 0, viewH: 270 } as RenderFrame;
  system.render(frame);
  expect(targets.size).toBe(0);
  p.bloom.enabled = true;
  system.render(frame);
  system.render(frame);
  expect(targets.size).toBe(3);
  expect(disposed).toBe(0);
  system.render({ ...frame, w: 320, h: 180 });
  expect(disposed).toBe(3);
  expect(targets.size).toBe(6);
  system.render(frame);
  fail = true;
  expect(() => system.render(frame)).toThrow("mask draw failed");
  expect(mesh.material).toBe(material);
  expect(mesh.visible).toBe(true);
  p.bloom.enabled = false;
  system.render(frame);
  expect(disposed).toBe(9);
  system.dispose();
  system.dispose();
  expect(disposed).toBe(9);
  material.dispose();
  mesh.geometry.dispose();
});
it("retains multi-material piece occlusion and restores original materials", () => {
  const materials = [
    new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.02 }),
    new T.MeshStandardMaterial(),
  ];
  const mesh = new T.Mesh(new T.BoxGeometry(), materials);
  mesh.userData.bloom = "pieces";
  const world = new T.Scene();
  world.add(mesh);
  let masks = 0;
  const r = {
    setViewport() {},
    copyFramebufferToTexture() {},
    setRenderTarget() {},
    setScissor() {},
    setScissorTest() {},
    setClearColor() {},
    clear() {},
    render(scene: T.Scene) {
      if (scene === world) {
        expect(mesh.visible).toBe(true);
        expect(mesh.material).not.toBe(materials);
        expect(Array.isArray(mesh.material)).toBe(true);
        for (const m of mesh.material) {
          expect(m.depthWrite).toBe(true);
          expect(m.transparent).toBe(false);
        }
        masks++;
      }
    },
  };
  const bloom = new BloomSystem(r as any, world, new T.Camera());
  const p = blank();
  p.bloom.enabled = true;
  p.bloom.pieces = false;
  bloom.render({ p, w: 100, h: 100, viewY: 0, viewH: 100 } as RenderFrame);
  expect(masks).toBe(1);
  expect(mesh.material).toBe(materials);
  bloom.dispose();
  materials.forEach((m) => m.dispose());
  mesh.geometry.dispose();
});
