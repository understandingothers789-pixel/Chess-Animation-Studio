import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { Project } from "../src/core/project";

const port = "5189";
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
  });
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const w = window as any;
    w.__name = (fn: unknown) => fn;
    w.studio = {
      settings: async () => ({
        ffmpeg: "",
        stockfish: "",
        encoder: "auto",
        tokenPresent: false,
      }),
      recent: async () => [],
      recover: async () => null,
      onAnalysis: () => () => {},
      onExport: () => () => {},
      autosave: async () => {},
      present: (state: any) => {
        w.__state = state;
      },
      assetStatus: async () => ({}),
      assetData: async () =>
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="purple"/></svg>',
        ),
      importAsset: async () => ({
        id: "reaction",
        path: "reaction.svg",
        kind: "image",
        name: "Reaction.svg",
        source: "Test",
        guidance: "",
      }),
    };
  });
  await page.goto(origin);
  const canvas = page.getByLabel("Chess composition preview", { exact: true });
  await expect(canvas).toBeVisible();
  const state = () =>
    page.evaluate(() => (window as any).__state.project as Project);
  const original = await state();
  const third = page.locator('.move-clip[data-move-index="2"] .clip-select');
  await third.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Starting-square meme…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Starting-square meme · Nf3",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Import meme image", exact: true })
    .click();
  await expect(dialog.getByLabel("Meme image", { exact: true })).toHaveValue(
    "reaction",
  );
  await expect(dialog.getByRole("img")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Preview meme on board", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(canvas).toHaveCSS("cursor", "default");
  assert.equal((await state()).moves[2].effect.preMoveMeme?.asset, "reaction");
  assert.equal((await state()).moves[0].effect.preMoveMeme, null);

  await page.evaluate(async () => {
    const { Scene } = await import("/src/render/Scene.ts" as string);
    const render = Scene.prototype.render;
    Scene.prototype.render = function (...args: Parameters<typeof render>) {
      if (
        this.renderer.domElement.getAttribute("aria-label") ===
        "Chess composition preview"
      )
        (window as any).__scene = this;
      return render.apply(this, args);
    };
  });
  await third.click();
  await page.waitForFunction(
    () => (window as any).__scene?.current?.e?.index === 2,
  );
  async function clickSquare(square: string) {
    const point = await page.evaluate(async (square) => {
      const scene = (window as any).__scene;
      const index = (Number(square[1]) - 1) * 8 + square.charCodeAt(0) - 97;
      const camera = scene.cameras.camera;
      camera.updateMatrixWorld(true);
      const squareMesh = scene.board.squares[index];
      const point = squareMesh
        .getWorldPosition(squareMesh.position.clone())
        .project(camera);
      const r = scene.renderer.domElement.getBoundingClientRect();
      const f = scene.current;
      const x = r.left + ((point.x + 1) * r.width) / 2;
      const y =
        r.top +
        (1 - (f.viewY + ((point.y + 1) * f.viewH) / 2) / f.h) * r.height;
      if (scene.pick(x, y) !== square)
        throw Error("Could not locate " + square);
      return { x, y };
    }, square);
    await page.mouse.click(point.x, point.y);
  }
  await clickSquare("g1");
  await clickSquare("e2");
  const lines = page.getByLabel("Game line", { exact: true });
  await expect(lines).toHaveValue("1");
  await expect(lines.locator("option:checked")).toHaveText(/Nf3 → Ne2/);
  await expect
    .poll(async () => (await state()).moves.map((m) => m.san))
    .toEqual(["e4", "e5", "Ne2"]);
  await canvas.focus();
  await page.keyboard.press("Control+z");
  await expect
    .poll(async () => (await state()).moves.length)
    .toBe(original.moves.length);
  await page.keyboard.press("Control+Shift+z");
  await expect(lines).toHaveValue("1");

  await lines.selectOption("0");
  await expect.poll(async () => (await state()).moves.at(-1)?.san).toBe("Rd8#");
  assert.equal((await state()).moves[2].effect.preMoveMeme?.asset, "reaction");
  await lines.selectOption("1");
  await expect.poll(async () => (await state()).moves.at(-1)?.san).toBe("Ne2");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: move context meme dialog, upload, board branch, Undo/Redo, and original Opera Game restoration.",
  );
} finally {
  await browser?.close();
  server.kill();
}
