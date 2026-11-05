/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const port = "5187",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port],
  { stdio: "pipe" },
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors: string[] = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as any).__name = (fn: unknown) => fn;
    const w = window as any;
    w.studio = {
      settings: async () => ({
        ffmpeg: "/usr/bin/ffmpeg",
        stockfish: "",
        encoder: "auto",
        tokenPresent: false,
      }),
      export: async (project: unknown, options: unknown) => {
        w.__export = { project, options };
        return true;
      },
      recent: async () => [],
      recover: async () => null,
      onAnalysis: () => () => {},
      onExport: () => () => {},
      autosave: async (p: unknown) => {
        w.__saved = p;
      },
      present: (s: unknown) => {
        w.__state = s;
      },
      assetStatus: async () => ({}),
      assetData: async () => null,
    };
  });
  page.setDefaultTimeout(15000);
  await page.goto(origin);
  await page.waitForSelector(".app-shell", { timeout: 60000 });
  await page.waitForFunction(() => !!(window as any).__state);
  await fs.mkdir("test-results/timeline-menus", { recursive: true });
  const menu = page.getByRole("menu");
  const first = page.locator(".move-clip").first();
  await first.click({ button: "right" });
  await expect(menu).toBeVisible();
  await page
    .getByRole("menuitem", { name: "Lock timing", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.moves[0].effect.locked,
  );
  await first.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Make move 25% slower", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.locator(".camera-track button").first().click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Edit this move’s camera…", exact: true })
    .click();
  await expect(page.locator('.inspector [data-tab="camera"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".effect-track button").first().click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Enable beat spotlight", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.moves[0].effect.jam.enabled,
  );
  await page
    .getByLabel("Workspace preset", { exact: true })
    .selectOption("Timeline");
  await page.locator('.track-labels [data-track="music"]').click();
  await page.screenshot({ path: "test-results/timeline-menus/music-menu.png" });
  await page
    .getByRole("menuitem", {
      name: "Knight horse sound settings…",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-category="music"]')).toBeVisible();
  await expect(
    page.getByText("Knight horse sound", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("slider", { name: "Horse sound volume", exact: true }),
  ).toBeInViewport();
  await page.locator(".annotation-drawer > summary").click();
  await page.getByRole("button", { name: "+ text", exact: true }).click();
  await page
    .locator(".annotation-track button")
    .first()
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Duplicate annotation", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.annotations.length === 2,
  );
  await page
    .locator(".annotation-track button")
    .last()
    .click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Delete annotation", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__state.project.annotations.length === 1,
  );
  await page.locator("[data-intro]").click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Edit intro & title…", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return to selected move", exact: true }),
  ).toBeVisible();
  await page.locator('.track-labels [data-track="camera"]').click();
  await page
    .getByRole("menuitem", { name: "Hide this track", exact: true })
    .click();
  await expect(page.locator(".camera-track")).toBeHidden();
  await page.reload();
  await page.waitForSelector(".app-shell", { timeout: 60000 });
  await expect(page.locator(".camera-track")).toBeHidden();
  await page.locator('.track-labels [data-track="timeline"]').click();
  await page
    .getByRole("menuitem", { name: "Show all tracks", exact: true })
    .click();
  await expect(page.locator(".camera-track")).toBeVisible();
  await first.locator(".clip-select").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.locator('.track-labels [data-track="music"]').click();
  const rect = await menu.boundingBox();
  assert.ok(
    rect &&
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.x + rect.width <= 1024 &&
      rect.y + rect.height <= 768,
  );
  await page.screenshot({
    path: "test-results/timeline-menus/small-window.png",
  });
  assert.deepEqual(errors, []);
  console.log(
    "Timeline menus: clip targeting, edits, locks, deep links, saved visibility, keyboard and viewport checks passed.",
  );
} finally {
  await browser.close();
  server.kill();
}
