/** Browser UI regression checks. Native services are exercised by test:desktop. */
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const port = "5182",
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
        ffmpeg: "",
        stockfish: "",
        encoder: "auto",
        tokenPresent: false,
      }),
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
  await page.goto(origin);
  await page.waitForSelector(".app-shell", { timeout: 90000 });
  await fs.mkdir("docs/redesign", { recursive: true });
  const nav = page.locator(".library-tabs");
  const categories = [
    "game",
    "board",
    "framing",
    "atmosphere",
    "effects",
    "presets",
    "music",
    "analysis",
    "files",
  ];
  assert.equal(await nav.getByRole("button").count(), 9);
  const boxes = await nav.getByRole("button").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, h: r.height };
    }),
  );
  assert.equal(new Set(boxes.map((r) => r.x)).size, 3);
  assert.equal(new Set(boxes.map((r) => r.y)).size, 3);
  assert.ok(boxes.every((r) => r.h >= 65 && r.h <= 75));
  const original = await page.evaluate(() =>
    JSON.stringify((window as any).__state.project),
  );
  for (const category of categories) {
    await nav.getByRole("button", { name: category, exact: true }).click();
    assert.equal(
      await page.locator(`[data-category="${category}"]`).isVisible(),
      true,
    );
    await page.screenshot({ path: `docs/redesign/${category}.png` });
  }
  assert.equal(
    await page.evaluate(() => JSON.stringify((window as any).__state.project)),
    original,
    "Navigation must not alter project settings",
  );
  await nav.getByRole("button", { name: "board", exact: true }).click();
  await page.getByLabel("Dark squares", { exact: true }).fill("#123456");
  await nav.getByRole("button", { name: "music", exact: true }).click();
  await nav.getByRole("button", { name: "board", exact: true }).click();
  assert.equal(
    await page.getByLabel("Dark squares", { exact: true }).inputValue(),
    "#123456",
  );
  const search = page.getByLabel("Search settings", { exact: true });
  for (const label of [
    "Bloom intensity",
    "Cinema dust",
    "Capture camera shake",
    "Beat spotlight",
    "Rotation",
  ]) {
    await search.fill(label);
    await page
      .locator(".search-results button")
      .filter({ has: page.getByText(label, { exact: true }) })
      .first()
      .click();
    const control = page.getByLabel(label, { exact: true });
    await expect(control).toBeVisible();
    await expect(control).toBeFocused();
  }
  const inspector = page.locator(".inspector-slot:visible .inspector");
  await inspector.getByRole("button", { name: "move", exact: true }).click();
  const moves = page.locator(
    '.move-track button:not([aria-label="Select intro clip"])',
  );
  await moves.nth(0).click();
  await page.getByLabel("Duration value", { exact: true }).fill("1");
  await moves.nth(1).click({ modifiers: ["Shift"] });
  assert.ok(
    (await inspector.locator(".hint").first().innerText()).includes(
      "2 moves selected",
    ),
  );
  assert.equal(
    await page.getByLabel("Duration value", { exact: true }).inputValue(),
    "",
  );
  await page.getByLabel("Duration value", { exact: true }).fill("0.8");
  for (const i of [0, 1]) {
    await moves.nth(i).click();
    assert.equal(
      await page.getByLabel("Duration value", { exact: true }).inputValue(),
      "0.8",
    );
  }
  await moves.nth(0).click();
  await page.getByLabel("Duration value", { exact: true }).fill("0.9");
  await moves.nth(1).click({ modifiers: ["Control"] });
  await moves.nth(1).click({ modifiers: ["Control"] });
  assert.equal(
    await page.getByLabel("Duration value", { exact: true }).inputValue(),
    "0.9",
    "Controls show the checked selection even if the active move was unchecked",
  );
  await inspector.getByRole("button", { name: "effects", exact: true }).click();
  await moves.nth(2).click();
  assert.equal(
    await inspector.locator('[data-inspector-tab="effects"]').isVisible(),
    true,
  );
  await page.getByLabel("Move light wash", { exact: true }).check();
  const light = inspector.locator("details").filter({
    has: page
      .locator("summary > span")
      .getByText("Move light & flicker", { exact: true }),
  });
  await light.locator("summary").click();
  assert.ok((await light.locator("summary").innerText()).includes("Enabled"));
  await page.getByLabel("Seek composition", { exact: true }).fill("0.5");
  await inspector
    .getByRole("button", { name: "Preview this move", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        (
          document.querySelector(
            '[aria-label="Seek composition"]',
          ) as HTMLInputElement
        ).value,
      ) > 0.5,
  );
  await inspector
    .getByRole("button", { name: "Preview this move", exact: true })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await page.getByLabel("Seek composition", { exact: true }).inputValue(),
    "0.5",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(100);
  await inspector
    .getByRole("button", { name: "Preview this move", exact: true })
    .click();
  await inspector
    .getByRole("button", { name: "Preview this move", exact: true })
    .waitFor({ timeout: 20000 });
  assert.ok(
    await page.getByRole("button", { name: "Pause", exact: true }).isVisible(),
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await nav.getByRole("button", { name: "framing", exact: true }).click();
  await page
    .locator('[data-category="framing"]')
    .getByRole("button", { name: "Edit intro clip →", exact: true })
    .click();
  assert.ok(
    await page.getByLabel("Opener preset", { exact: true }).isVisible(),
  );
  await page.screenshot({ path: "docs/redesign/intro.png" });
  await page.getByRole("button", { name: "Return to selected move" }).click();
  assert.ok(
    await inspector.locator('[data-inspector-tab="effects"]').isVisible(),
  );
  await nav.getByRole("button", { name: "game", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await nav.locator('[aria-current="page"]').getAttribute("aria-label"),
    "board",
  );
  await moves.filter({ hasText: /x/ }).first().click();
  await page
    .locator(".inspector-slot:visible .inspector-content")
    .evaluate((el) => {
      el.scrollTop = 0;
    });
  await page.screenshot({ path: "docs/redesign/inspector.png" });
  await page.setViewportSize({ width: 1100, height: 768 });
  await page.screenshot({ path: "docs/redesign/narrow.png" });
  const timelineHeader = page.locator(".timeline > header");
  assert.ok(
    await timelineHeader.evaluate((header) => {
      const bounds = header.getBoundingClientRect();
      return Array.from(header.children).every(
        (el) => el.getBoundingClientRect().bottom <= bounds.bottom + 1,
      );
    }),
    "Timeline controls fit inside their header",
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: nine tiles, preserved settings, mixed selection, editing scope, effect status, tab persistence, preview restore paused/playing, search reveal, keyboard navigation, intro shortcut, narrow layout.",
  );
} finally {
  await browser.close();
  server.kill();
}
