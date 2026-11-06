import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5193", "--strictPort"],
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
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5193")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.addInitScript(() => {
    window.studio = {
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
      present: () => {},
      assetStatus: async () => ({}),
      assetData: async () => null,
    };
  });
  await page.goto("http://127.0.0.1:5193", { timeout: 90000 });
  await page.waitForSelector(".app-shell", { timeout: 90000 });
  await page.waitForSelector(".loading", { state: "hidden", timeout: 90000 });
  const first = page.locator(".move-clip").first();
  await first.locator(".clip-select").click({ button: "right" });
  const copy = page.getByRole("menuitem", { name: "Copy", exact: true });
  await copy.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("menuitem", { name: "Movement", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: "docs/context-menu-029/keyboard-flyout.png" });
  await page.keyboard.press("Escape");
  for (const left of [false, true]) {
    if (left)
      await first.evaluate((el) =>
        el.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            button: 2,
            clientX: 1438,
            clientY: 898,
          }),
        ),
      );
    else await first.locator(".clip-select").click({ button: "right" });
    await copy.hover();
    await expect(page.getByRole("menu")).toHaveCount(2);
    const parent = await copy.boundingBox(),
      child = await page.getByRole("menu").last().boundingBox();
    const x = left ? child.x + child.width - 12 : child.x + 12,
      y = parent.y + parent.height / 2;
    await page.mouse.move(parent.x + parent.width / 2, y);
    await page.mouse.move(x, y, { steps: 12 });
    await page.waitForTimeout(380);
    await expect(page.getByRole("menu")).toHaveCount(2);
    await expect(copy).toHaveAttribute("aria-expanded", "true");
    for (let i = 0; i < 8; i++)
      await page.mouse.move(x + (i % 2 ? 2 : -2), y + (i % 2 ? 1 : -1));
    await expect(page.getByRole("menu")).toHaveCount(2);
    await page.keyboard.press("Escape");
  }
  await page.locator(".move-clip .clip-select").first().click();
  await page
    .locator(".move-clip .clip-select")
    .nth(2)
    .click({ modifiers: ["Control"] });
  await first.locator(".clip-select").click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Speed / Duration", exact: true })
    .hover();
  await expect(
    page.getByRole("menuitem", { name: "Set exact duration…", exact: true }),
  ).toContainText("2 selected");
  await page.screenshot({ path: "docs/context-menu-029/duration-scope.png" });
  console.log(
    "PASS: keyboard-focused flyout captured; horizontal transitions and minor pointer jitter preserve both right- and left-opening hierarchies.",
  );
} finally {
  await browser.close();
  server.kill();
}
