import { spawn } from "node:child_process";
import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "pipe",
});
let app: Awaited<ReturnType<typeof electron.launch>> | null = null;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const r = await fetch("http://127.0.0.1:5173");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  app = await electron.launch({
    args: [
      ".",
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      DISPLAY: process.env.DISPLAY ?? ":100",
      STUDIO_TEST_DATA: "/tmp/castudio-dev-smoke",
      STUDIO_DEV_URL: "http://127.0.0.1:5173",
    },
  });
  const page = await app.firstWindow(),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.waitForSelector(".play-button");
  await page.getByTitle("3. Nf3", { exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: Vite development startup, nonce-protected React refresh, preload bridge, and WebGL preview.",
  );
} finally {
  await app?.close();
  server.kill();
}
