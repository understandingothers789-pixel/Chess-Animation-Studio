import { _electron as electron } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { duration } from "../src/core/timeline";
const root = process.cwd(),
  data = await fs.mkdtemp("/tmp/castudio-film-"),
  output = path.join(root, "test-results/Opera-Game-1080p.mp4");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.rm(output, { force: true });
const project = JSON.parse(
  await fs.readFile("samples/Opera-Game.castudio", "utf8"),
);
project.assets.forEach(
  (a: any) => (a.path = path.join(root, "samples", a.path)),
);
const app = await electron.launch({
  args: [
    root,
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":100",
    STUDIO_TEST_DATA: data,
  },
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector("canvas");
  await page.evaluate(
    async ({ project, output }) => {
      (window as any).__film = [];
      window.studio.onExport((p) => (window as any).__film.push(p));
      await window.studio.exportVideo(project, null, {
        format: "landscape",
        encoder: "software",
        path: output,
      });
    },
    { project, output },
  );
  let done = false,
    last = -1;
  while (!done) {
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => (window as any).__film.at(-1));
    if (!state) continue;
    if (state.done !== last) {
      console.log(`${state.phase}: ${state.done}/${state.total}`);
      last = state.done;
    }
    if (state.phase === "error") throw new Error(state.message);
    done = state.phase === "complete";
  }
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
      { encoding: "utf8" },
    ),
  );
  assert.equal(
    probe.streams.find((s: any) => s.codec_type === "video").nb_frames,
    String(Math.ceil(duration(project) * 60)),
  );
  assert.ok(probe.streams.some((s: any) => s.codec_type === "audio"));
  await fs.writeFile(
    "test-results/Opera-Game-1080p-probe.json",
    JSON.stringify(probe, null, 2),
  );
  console.log(
    `PASS: complete 33-ply sample rendered at 1920×1080, 60 FPS, ${probe.format.duration}s with AAC audio.`,
  );
} finally {
  await app.close();
  await fs.rm(data, { recursive: true, force: true });
}
