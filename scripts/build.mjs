import { build } from "esbuild";
await build({
  entryPoints: ["desktop/main.ts", "desktop/preload.ts"],
  outdir: "desktop-build",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  outExtension: { ".js": ".cjs" },
});
