import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
const baselinePath = "src/render/systems/OverlayBenchmarkBaseline.ts";
const port = "5177",
  origin = `http://127.0.0.1:${port}`;
await fs.writeFile(
  baselinePath,
  execFileSync("git", ["show", "2b62498:src/render/systems/OverlaySystem.ts"]),
  { flag: "wx" },
);
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port],
  { stdio: "ignore" },
);
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
  await page.addInitScript("globalThis.__name = fn => fn;");
  await page.route("**/overlay-benchmark.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body></body></html>",
    }),
  );
  await page.goto(origin + "/overlay-benchmark.html");
  const results = await page.evaluate(async () => {
    const T = await import("/node_modules/.vite/deps/three.js" as string);
    const { blank } = await import("/src/core/project.ts" as string);
    const { evaluateRenderFrame } = await import(
      "/src/render/engine/frame.ts" as string
    );
    const p = blank();
    p.lead = 4;
    p.introTitle.enabled = true;
    p.evalBar = true;
    const results = [];
    for (const name of ["OverlayBenchmarkBaseline", "OverlaySystem"]) {
      const { OverlaySystem } = await import(`/src/render/systems/${name}.ts`);
      const r = new T.WebGLRenderer({
        canvas: document.createElement("canvas"),
      });
      r.setSize(1920, 1080, false);
      r.autoClear = false;
      const overlay = new OverlaySystem(new T.Group(), r, new Map());
      const version = overlay.overlayTexture.version;
      const start = performance.now();
      for (let i = 0; i < 40; i++)
        overlay.post(evaluateRenderFrame(p, i / 10, 1920, 1080));
      results.push({
        name,
        frames: 40,
        repaintRequests: overlay.overlayTexture.version - version,
        wallMs: performance.now() - start,
      });
      overlay.dispose();
      r.dispose();
      r.forceContextLoss();
    }
    return results;
  });
  console.log(
    JSON.stringify(
      { renderer: "Chromium SwiftShader", width: 1920, height: 1080, results },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
  await fs.unlink(baselinePath);
}
