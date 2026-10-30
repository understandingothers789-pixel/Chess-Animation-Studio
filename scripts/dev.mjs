import { spawn } from "node:child_process";
import { build } from "esbuild";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
  stdio: "inherit",
});
await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  external: ["electron"],
});
for (let n = 0; n < 100; n++) {
  try {
    const r = await fetch("http://127.0.0.1:5173");
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const electron = spawn(
  process.platform === "win32"
    ? "node_modules/.bin/electron.cmd"
    : "node_modules/.bin/electron",
  ["."],
  {
    stdio: "inherit",
    env: { ...process.env, STUDIO_DEV_URL: "http://127.0.0.1:5173" },
    shell: process.platform === "win32",
  },
);
const close = () => {
  electron.kill();
  vite.kill();
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
electron.on("exit", () => {
  vite.kill();
});
