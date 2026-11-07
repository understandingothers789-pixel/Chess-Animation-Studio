// Run from the repository root: node --import tsx docs/storyboard-030/camera-check.mjs
import assert from "node:assert/strict";
import * as THREE from "three";
import { blank, camera, formats } from "../../src/core/project.ts";
import { importPgn } from "../../src/core/chess.ts";
import { segments } from "../../src/core/timeline.ts";
import { shotFromMove } from "../../src/core/storyboard.ts";
import { evaluateRenderFrame } from "../../src/render/engine/frame.ts";
import { evaluatePresentationFrame } from "../../src/render/engine/presentation.ts";
import { CameraSystem } from "../../src/render/systems/CameraSystem.ts";
const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
for (const f of formats)
  p.moves[2].effect.cameras[f] = { ...camera(), mode: "game" };
p.storyboard.shots = [shotFromMove(p, p.moves[2].id, "position-hold", "after")];
const close = (a, b) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${v} != ${b[i]}`));
};
for (const manual of [false, true]) {
  const q = structuredClone(p);
  q.shorts.enabled = manual;
  if (manual)
    q.storyboard.shots[0].camera = {
      ...camera(),
      mode: "manual",
      zoom: 1.8,
      x: 1,
      y: 1,
    };
  const source = structuredClone(q);
  if (manual)
    for (const f of formats)
      source.moves[2].effect.cameras[f] = { ...q.storyboard.shots[0].camera };
  for (const f of formats) {
    const [width, height] =
      f === "landscape" ? [640, 360] : f === "square" ? [480, 480] : [360, 640];
    const a = evaluateRenderFrame(
        source,
        segments(source)[2].finish,
        width,
        height,
        f,
      ),
      b = evaluatePresentationFrame(q, 1, width, height, f, "storyboard");
    const ca = new CameraSystem(new THREE.Group()),
      cb = new CameraSystem(new THREE.Group());
    ca.update(a);
    cb.update(b);
    close(
      ca.camera.projectionMatrix.elements,
      cb.camera.projectionMatrix.elements,
    );
    close(ca.camera.position.toArray(), cb.camera.position.toArray());
    ca.dispose();
    cb.dispose();
    console.log(
      `PASS: ${f}, ${manual ? "manual hold camera with Shorts enabled" : "inherited game framing"} matches source projection matrix and camera position`,
    );
  }
}
