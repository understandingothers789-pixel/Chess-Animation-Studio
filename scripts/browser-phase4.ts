import * as T from "three";
import { BloomSystem } from "../src/render/systems/BloomSystem";
import { blank } from "../src/core/project";
import type { RenderFrame } from "../src/render/engine/frame";
import { Scene } from "../src/render/Scene";
import { parseProject, cinematicPresets, formats } from "../src/core/project";
import { segments } from "../src/core/timeline";
export async function phase4Frames() {
  const renderer = new T.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(64, 64);
  renderer.autoClear = false;
  const world = new T.Scene(),
    camera = new T.OrthographicCamera(-2, 2, 2, -2, 0.1, 20);
  camera.position.z = 10;
  const back = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({ color: 0xffffff }),
  );
  back.userData.bloom = "captures";
  world.add(back);
  const geometry = new T.PlaneGeometry(1.5, 1.5);
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  const front = new T.Mesh(geometry, [
    new T.MeshBasicMaterial({ transparent: true }),
    new T.MeshBasicMaterial(),
  ]);
  front.userData.bloom = "pieces";
  front.position.z = 1;
  world.add(front);
  const bloom = new BloomSystem(renderer, world, camera),
    settings = blank();
  settings.bloom.enabled = true;
  settings.bloom.pieces = false;
  settings.bloom.threshold = 0.1;
  const maskFrame = {
    p: settings,
    w: 64,
    h: 64,
    viewY: 0,
    viewH: 64,
  } as RenderFrame;
  const brightness = () => {
    const bytes = new Uint8Array(64 * 64 * 4);
    const gl = renderer.getContext();
    gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return bytes.reduce((sum, v, i) => sum + (i % 4 === 3 ? 0 : v), 0);
  };
  renderer.setClearColor(0);
  renderer.clear();
  bloom.render(maskFrame);
  if (brightness() !== 0) throw Error("Multi-material foreground leaked glow");
  front.visible = false;
  renderer.clear();
  bloom.render(maskFrame);
  if (brightness() === 0) throw Error("Unoccluded glow missing");
  bloom.dispose();
  geometry.dispose();
  (front.material as T.Material[]).forEach((m) => m.dispose());
  back.geometry.dispose();
  (back.material as T.Material).dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  const p = parseProject(await (await fetch("/samples/Opera.castudio")).json());
  const index = p.moves.findIndex((m) => m.san.includes("x"));
  const impact =
    segments(p)[index].depart +
    p.moves[index].effect.duration * p.moves[index].effect.capture.impact;
  const a = new Scene(document.createElement("canvas")),
    b = new Scene(document.createElement("canvas"));
  await Promise.all([a.ready, b.ready]);
  const frames = [];
  const assert = (ok: boolean, msg: string) => {
    if (!ok) throw Error(msg);
  };
  for (const preset of ["Subtle", "Cinematic", "Epic", "Bloom"] as const)
    for (const format of formats) {
      const q = structuredClone(p);
      q.cinematic =
        preset === "Bloom"
          ? { ...cinematicPresets.Subtle, enabled: false }
          : { ...cinematicPresets[preset] };
      q.bloom.enabled = true;
      if (preset === "Bloom") q.bloom.pieces = false;
      const [w, h] =
        format === "landscape"
          ? [320, 180]
          : format === "square"
            ? [240, 240]
            : [180, 320];
      for (const age of preset === "Bloom" ? [0.2] : [0.05, 0.3, 0.7]) {
        const time = impact + age;
        a.render(q, time, w, h, format);
        const png = a.renderer.domElement.toDataURL();
        const bytes = a.rgba();
        a.render(q, time + 1, w, h, format);
        a.render(q, time, w, h, format);
        assert(
          a.renderer.domElement.toDataURL() === png,
          "Capture seek mismatch",
        );
        a.render(q, time, 128, 128, format);
        a.render(q, time, w, h, format);
        assert(
          a.renderer.domElement.toDataURL() === png,
          "Capture resize mismatch",
        );
        b.render(q, time, w, h, format);
        assert(
          b.rgba().every((v, i) => v === bytes[i]),
          "Capture preview/export mismatch",
        );
        frames.push({
          key: `${preset}-${format}-${age}`,
          png: png.split(",")[1],
        });
      }
    }
  const memory = JSON.stringify(a.renderer.info.memory);
  for (let i = 0; i < 20; i++)
    a.render(p, impact + i / 60, 320, 180, "landscape");
  a.dispose();
  b.dispose();
  return frames;
}
