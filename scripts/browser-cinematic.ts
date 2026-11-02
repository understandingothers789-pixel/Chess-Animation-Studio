import { Scene } from "../src/render/Scene";
import { GraphicsSession } from "../src/render/GraphicsSession";
import { cinematicPresets, parseProject } from "../src/core/project";
export async function verifyCinematic() {
  const assert = (ok: boolean, message: string) => {
    if (!ok) throw Error(message);
  };
  const p = parseProject(await (await fetch("/samples/Opera.castudio")).json());
  const host = document.createElement("div");
  document.body.append(host);
  const session = new GraphicsSession();
  const image = document.createElement("canvas");
  image.width = image.height = 8;
  const ctx = image.getContext("2d")!;
  ctx.fillStyle = "#389abc";
  ctx.fillRect(0, 0, 8, 8);
  const assets = { backdrop: image.toDataURL() };
  p.layouts.landscape.background = "image";
  p.layouts.landscape.image = "backdrop";
  p.bloom.enabled = true;
  p.bloom.threshold = 0.2;
  const first = (await session.reload(host, assets))!;
  let rendererDisposed = 0;
  const dispose = first.renderer.dispose.bind(first.renderer);
  first.renderer.dispose = () => {
    rendererDisposed++;
    dispose();
  };
  p.cinematic = { ...cinematicPresets.Cinematic };
  const { segments } = await import("../src/core/timeline");
  const capture = p.moves.findIndex((m) => m.san.includes("x"));
  const time =
    segments(p)[capture].depart +
    p.moves[capture].effect.duration * p.moves[capture].effect.capture.impact +
    0.2;
  first.render(p, time, 480, 270, "landscape");
  const expected = first.renderer.domElement.toDataURL();
  (globalThis as any).__cinematicImage = expected;
  first.render(p, 8, 480, 270, "landscape");
  first.render(p, time, 480, 270, "landscape");
  assert(
    first.renderer.domElement.toDataURL() === expected,
    "Bloom backward seek mismatch",
  );
  const memory = JSON.stringify(first.renderer.info.memory);
  for (let i = 0; i < 8; i++)
    first.render(p, time + i / 60, 480, 270, "landscape");
  assert(
    JSON.stringify(first.renderer.info.memory) === memory,
    "Bloom resources grew",
  );
  first.render(p, time, 320, 180, "landscape");
  first.render(p, time, 480, 270, "landscape");
  assert(
    first.renderer.domElement.toDataURL() === expected,
    "Bloom resize replay mismatch",
  );
  const gl = first.renderer.getContext(),
    lose = gl.getExtension("WEBGL_lose_context")!;
  const lost = new Promise<void>((resolve) =>
    first.renderer.domElement.addEventListener(
      "webglcontextlost",
      () => resolve(),
      { once: true },
    ),
  );
  lose.loseContext();
  await lost;
  let rejected = false;
  try {
    first.render(p, time, 480, 270, "landscape");
  } catch {
    rejected = true;
  }
  assert(rejected, "Context loss was ignored");
  const recovered = (await session.reload(host, assets))!;
  recovered.render(p, time, 480, 270, "landscape");
  assert(
    recovered.assetState("backdrop")?.state === "ready",
    "Recovery did not reload assets",
  );
  assert(
    recovered.renderer.domElement.toDataURL() === expected,
    "Reconstructed scene differs at preserved project/time",
  );
  assert(
    rendererDisposed === 1 && first.assetState("backdrop") === undefined,
    "Old scene renderer/assets were not disposed",
  );
  const exported = new Scene(document.createElement("canvas"));
  await exported.ready;
  await exported.prepareAssets(assets);
  exported.render(p, time, 480, 270, "landscape");
  const recoveredBytes = recovered.rgba();
  assert(
    exported.rgba().every((v, i) => v === recoveredBytes[i]),
    "Independent export/preview bloom frames differ",
  );
  const disabled = structuredClone(p);
  disabled.bloom.enabled = false;
  recovered.render(disabled, time, 480, 270, "landscape");
  assert(
    recovered.renderer.domElement.toDataURL() !== expected,
    "Enabled bloom had no visible effect",
  );
  recovered.render(disabled, time + 1 / 60, 480, 270, "landscape");
  const offMemory = JSON.stringify(recovered.renderer.info.memory);
  recovered.render(disabled, time + 2 / 60, 480, 270, "landscape");
  assert(
    JSON.stringify(recovered.renderer.info.memory) === offMemory,
    "Disabled bloom retained changing resources",
  );
  const unselected = structuredClone(p);
  unselected.bloom.pieces =
    unselected.bloom.captures =
    unselected.bloom.highlights =
      false;
  recovered.render(disabled, time, 480, 270, "landscape");
  const base = recovered.renderer.domElement.toDataURL();
  recovered.render(unselected, time, 480, 270, "landscape");
  assert(
    recovered.renderer.domElement.toDataURL() === base,
    "Unselected objects leaked into bloom",
  );
  recovered.render({ ...p }, time, 480, 270, "landscape");
  assert(
    recovered.renderer.domElement.toDataURL() === expected,
    "Bloom project transition retained stale pixels",
  );
  // GPU completion via readback; these are software-renderer frame latencies, not hardware FPS.
  const measurements = [];
  for (const [w, h] of [
    [1920, 1080],
    [3840, 2160],
  ]) {
    for (const enabled of [false, true]) {
      const project = {
        ...p,
        cinematic: { ...p.cinematic, enabled },
        bloom: { ...p.bloom, enabled },
      };
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const at = performance.now();
        recovered.render(project, time + i / 60, w, h, "landscape");
        recovered.rgba();
        samples.push(performance.now() - at);
      }
      measurements.push({
        w,
        h,
        enabled,
        samplesMs: samples,
        medianMs: [...samples].sort((a, b) => a - b)[1],
        memory: { ...recovered.renderer.info.memory },
        bloomTargetBytes: enabled
          ? w * h * 4 + Math.ceil(w / 2) * Math.ceil(h / 2) * 16
          : 0,
      });
    }
  }
  exported.dispose();
  session.dispose();
  session.dispose();
  host.remove();
  return {
    recovery: "WEBGL_lose_context plus full Scene/canvas reconstruction",
    measurements,
  };
}
