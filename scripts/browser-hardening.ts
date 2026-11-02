/** Real WebGL regression checks, invoked from render-regression's browser. */
import * as T from "three";
import { Scene } from "../src/render/Scene";
import { blank } from "../src/core/project";
export async function verifyHardening() {
  const p = blank(),
    canvas = document.createElement("canvas");
  const assert = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  let color = "#ff0000",
    calls = 0,
    invalidate = () => {},
    fail = false;
  const scene = new Scene(canvas, (services) => {
    invalidate = services.invalidate;
    const geometry = new T.PlaneGeometry(2, 2),
      material = new T.MeshBasicMaterial({ color });
    const mesh = new T.Mesh(geometry, material);
    mesh.position.z = 2;
    mesh.visible = false;
    services.root.add(mesh);
    return [
      {
        id: "world-test",
        stage: "board",
        render() {
          calls++;
          mesh.visible = true;
          material.color.set(color);
        },
        dispose() {
          geometry.dispose();
          material.dispose();
        },
      },
      {
        id: "state-failure",
        stage: "post",
        render() {
          if (fail) {
            fail = false;
            services.renderer.setViewport(1, 1, 3, 3);
            services.renderer.setScissorTest(true);
            services.renderer.setClearColor("#ffffff", 0.2);
            services.renderer.autoClear = true;
            throw Error("Injected state failure");
          }
        },
      },
    ];
  });
  await scene.ready;
  scene.render(p, 0, 270, 480);
  const red = canvas.toDataURL();
  // The object starts hidden, so red pixels prove same-frame world mutation.
  const pixels = scene.rgba();
  assert(
    pixels.some((v, i) => i % 4 === 0 && v > 240 && pixels[i + 1] < 20),
    "World extension missed its first frame",
  );
  scene.render(p, 0, 270, 480);
  assert(calls === 1, "Paused cache missed");
  color = "#00ff00";
  invalidate();
  scene.render(p, 0, 270, 480);
  assert(
    canvas.toDataURL() !== red,
    "Extension invalidation missed a paused change",
  );
  const green = canvas.toDataURL();
  fail = true;
  invalidate();
  let threw = false;
  try {
    scene.render(p, 0, 270, 480);
  } catch {
    threw = true;
  }
  assert(
    threw && !scene.renderer.autoClear && !scene.renderer.getScissorTest(),
    "Renderer state was not restored after failure",
  );
  scene.render(p, 0, 270, 480);
  assert(canvas.toDataURL() === green, "Failed frame retry changed pixels");
  scene.render({ ...p }, 0, 270, 480);
  assert(calls === 5, "Project identity did not invalidate");
  const target = new T.WebGLRenderTarget(16, 16);
  scene.renderer.setRenderTarget(target);
  scene.invalidate();
  scene.render(p, 0, 270, 480);
  assert(
    scene.renderer.getRenderTarget() === target,
    "Render target was not restored",
  );
  assert(
    scene.rgba().length === 270 * 480 * 4 &&
      scene.renderer.getRenderTarget() === target,
    "Readback changed the render target",
  );
  scene.renderer.setRenderTarget(null);
  target.dispose();
  const beforeAsset = calls;
  const assetCanvas = document.createElement("canvas");
  assetCanvas.width = assetCanvas.height = 2;
  await scene.prepareAssets({ test: assetCanvas.toDataURL() });
  scene.render(p, 0, 270, 480);
  assert(
    calls === beforeAsset + 1,
    "Asset preparation did not invalidate the frame",
  );
  let resetMs = 0,
    resets = 0;
  const reset = scene.renderer.resetState.bind(scene.renderer);
  scene.renderer.resetState = () => {
    const at = performance.now();
    reset();
    resetMs += performance.now() - at;
    resets++;
  };
  const playbackAt = performance.now();
  for (let i = 0; i < 60; i++) scene.render(p, i / 60, 270, 480);
  const playbackMs = performance.now() - playbackAt;
  const gl = scene.renderer.getContext(),
    lose = gl.getExtension("WEBGL_lose_context");
  if (!lose) throw Error("Context-loss simulation unavailable");
  const lost = new Promise<void>((resolve) =>
    canvas.addEventListener("webglcontextlost", () => resolve(), {
      once: true,
    }),
  );
  lose.loseContext();
  await lost;
  let rejectedLoss = false;
  try {
    scene.render(p, 0, 270, 480);
  } catch (error) {
    rejectedLoss = (error as Error).message.includes("Graphics context");
  }
  assert(rejectedLoss, "Lost context incorrectly returned a cached frame");
  let rejectedReadback = false;
  try {
    scene.rgba();
  } catch {
    rejectedReadback = true;
  }
  assert(rejectedReadback, "Lost context permitted export readback");
  scene.dispose();
  // Repeated leases, changing projects, and closing one renderer while another lives.
  const abandoned = new Scene(document.createElement("canvas"));
  abandoned.dispose(); // Last lease released while artwork is still preparing.
  await abandoned.ready;
  for (let i = 0; i < 3; i++) {
    const a = new Scene(document.createElement("canvas")),
      b = new Scene(document.createElement("canvas"));
    await Promise.all([a.ready, b.ready]);
    a.render(p, 0, 160, 90);
    a.render({ ...p }, 1, 160, 90);
    b.render(p, 0, 160, 90);
    const reference = b.rgba();
    a.dispose();
    b.render(p, 1, 160, 90);
    b.render(p, 0, 160, 90);
    const actual = b.rgba();
    assert(
      reference.every((v, j) => v === actual[j]),
      "Shared artwork lifetime failed",
    );
    b.dispose();
  }
  return {
    frames: 60,
    resets,
    resetMs,
    playbackMs,
    renderer: "SwiftShader",
    width: 270,
    height: 480,
  };
}
