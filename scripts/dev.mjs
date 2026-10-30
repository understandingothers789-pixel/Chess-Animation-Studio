import { spawn } from "node:child_process";
import { createServer } from "vite";
import { build } from "esbuild";
await build({
  entryPoints: ["desktop/main.ts", "desktop/preload.ts"],
  outdir: "desktop-build",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
  outExtension: { ".js": ".cjs" },
});
const server = await createServer();
await server.listen();
const electron = spawn(
  process.platform === "win32"
    ? "node_modules/.bin/electron.cmd"
    : "node_modules/.bin/electron",
  ["."],
  {
    stdio: "inherit",
    env: { ...process.env, STUDIO_DEV_URL: "http://127.0.0.1:5174" },
  },
);
electron.on("exit", async () => {
  await server.close();
  process.exit();
});
process.on("SIGINT", () => electron.kill());
