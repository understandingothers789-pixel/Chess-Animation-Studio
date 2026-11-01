/** Pixel fixtures use a fresh browser and the same software GPU for both revisions. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
const label = process.argv[2] ?? "current";
const port = process.env.RENDER_PORT ?? "5176";
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port],
  {
    stdio: "pipe",
  },
);
const root = `test-results/render-${label}`;
await fs.mkdir(root, { recursive: true });
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage();
  // tsx preserves callback names using this helper; Playwright serializes the callback body.
  await page.addInitScript("globalThis.__name = (fn) => fn;");
  await page.route("**/render-fixture.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    }),
  );
  await page.goto(origin + "/render-fixture.html");
  const output = await page.evaluate(async (legacy) => {
    const { Scene } = await import(
      (legacy ? "/src/render/LegacyScene.ts" : "/src/render/Scene.ts") as string
    );
    const { blank, parseProject } = await import(
      "/src/core/project.ts" as string
    );
    const { importPgn } = await import("/src/core/chess.ts" as string);
    const canvas = document.createElement("canvas");
    document.body.replaceChildren(canvas);
    let frameCalls = 0;
    let failNext = false;
    const scene = new Scene(canvas, [
      {
        id: "test-counter",
        stage: "overlay",
        render: () => {
          frameCalls++;
          if (failNext) {
            failNext = false;
            throw Error("Expected test failure");
          }
        },
      },
    ]);
    await scene.ready;
    const sample = parseProject(
      await (await fetch("/samples/Opera.castudio")).json(),
    );
    const promoted = blank();
    promoted.fen = "7k/P7/8/8/8/8/8/7K w - - 0 1";
    const visual = structuredClone(sample);
    visual.evalBar = true;
    visual.introTitle.enabled = true;
    visual.ambient.enabled = true;
    visual.boardFX.enabled = true;
    for (const move of visual.moves) {
      move.effect.jam.enabled = true;
      move.effect.highlight.trail = true;
    }
    const image = blank();
    image.layouts.landscape.background = "image";
    image.layouts.landscape.image = "background";
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = 160;
    imageCanvas.height = 90;
    const ctx = imageCanvas.getContext("2d")!;
    ctx.fillStyle = "#345678";
    ctx.fillRect(0, 0, 160, 90);
    await scene.setAsset("background", imageCanvas.toDataURL());
    const fixtures = [
      ["image", image],
      ["visual", visual],
      [
        "promotion",
        importPgn(promoted, '[FEN "7k/P7/8/8/8/8/8/7K w - - 0 1"] 1. a8=Q+'),
      ],
      ["sample", sample],
      ["castling", importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O")],
      ["en-passant", importPgn(blank(), "1. e4 a6 2. e5 d5 3. exd6")],
    ] as const;
    const frames: { key: string; png: string }[] = [];
    for (const [name, p] of fixtures)
      for (const format of [
        "landscape",
        "vertical",
        "square",
        "square-in-vertical",
      ]) {
        for (const t of [0, 5, 2, 8, 5, 1, 8, 14, 24]) {
          scene.render(
            p,
            t,
            format === "landscape" ? 480 : 270,
            format === "square" ? 270 : format === "landscape" ? 270 : 480,
            format,
          );
          frames.push({
            key: `${name}-${format}-${t}`,
            png: canvas.toDataURL().split(",")[1],
          });
        }
      }
    if (!legacy) {
      // Both preview and export instantiate this same facade, at the same output size.
      const secondCanvas = document.createElement("canvas");
      const second = new Scene(
        secondCanvas,
        ({
          renderer,
          camera,
        }: {
          renderer: { domElement: HTMLCanvasElement };
          camera: { isOrthographicCamera: boolean };
        }) => {
          if (
            renderer.domElement !== secondCanvas ||
            !camera.isOrthographicCamera
          )
            throw Error("Invalid extension services");
          return [];
        },
      );
      await second.ready;
      scene.render(visual, 5, 480, 270, "landscape");
      second.render(visual, 5, 480, 270, "landscape");
      if (canvas.toDataURL() !== secondCanvas.toDataURL())
        throw Error("Independent renderer parity failed");
      const calls = frameCalls;
      scene.render(visual, 5, 480, 270, "landscape");
      if (frameCalls !== calls)
        throw Error("An unchanged frame unnecessarily executed the graph");
      const readback = scene.rgba(),
        other = second.rgba();
      if (
        readback.length !== other.length ||
        readback.some((value: number, index: number) => value !== other[index])
      )
        throw Error("Export readback differs between independent renderers");
      failNext = true;
      try {
        scene.render(visual, 6, 480, 270, "landscape");
      } catch {}
      const failedCalls = frameCalls;
      scene.render(visual, 6, 480, 270, "landscape");
      if (frameCalls !== failedCalls + 1)
        throw Error("Failed render was cached");

      let failedDisposals = 0;
      let constructorFailed = false;
      try {
        new Scene(document.createElement("canvas"), [
          {
            id: "failing-extension",
            stage: "overlay",
            initialize: () => {
              throw Error("Expected initialize failure");
            },
            render: () => {},
            dispose: () => {
              failedDisposals++;
            },
          },
        ]);
      } catch {
        constructorFailed = true;
      }
      if (!constructorFailed || failedDisposals !== 1)
        throw Error("Failed initialization did not clean up");
      const reference = secondCanvas.toDataURL();
      scene.dispose();
      second.render(visual, 6, 480, 270, "landscape");
      second.render(visual, 5, 480, 270, "landscape");
      if (reference !== secondCanvas.toDataURL())
        throw Error("Shared artwork was disposed while still in use");
      for (let i = 0; i < 30; i++)
        second.render(visual, 2 + (i % 20) * 0.1, 480, 270, "landscape");
      const memory = JSON.stringify(second.renderer.info.memory);
      for (let i = 0; i < 60; i++)
        second.render(visual, 2 + (i % 20) * 0.1, 480, 270, "landscape");
      if (memory !== JSON.stringify(second.renderer.info.memory))
        throw Error("GPU resources grew during repeated scrubbing");
      second.dispose();
      second.dispose();
      let rejected = false;
      try {
        second.render(visual, 1, 480, 270, "landscape");
      } catch {
        rejected = true;
      }
      if (!rejected) throw Error("Rendering after disposal was accepted");
    }
    scene.dispose();
    return frames;
  }, process.env.RENDER_LEGACY === "1");
  const hashes: Record<string, string> = {};
  for (const frame of output) {
    const bytes = Buffer.from(frame.png, "base64");
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hashes[frame.key] && hashes[frame.key] !== hash)
      throw Error("Nondeterministic " + frame.key);
    hashes[frame.key] = hash;
    await fs.writeFile(`${root}/${frame.key}.png`, bytes);
  }
  await fs.writeFile(`${root}/hashes.json`, JSON.stringify(hashes, null, 2));
  console.log(
    `PASS: ${output.length} render requests, ${Object.keys(hashes).length} unique fixtures (${label})`,
  );
} finally {
  await browser?.close();
  server.kill();
}
