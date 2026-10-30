// Standard portable Electron layout. The runtime executable is copied, never edited.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
const platform =
  process.platform === "win32" ? "win32" : process.env.PORTABLE_PLATFORM;
if (platform !== "win32")
  throw Error(
    "Use the Windows workflow, or explicitly set PORTABLE_PLATFORM=win32 for an untested cross-package.",
  );
const target = path.resolve(
  "release",
  `Chess-Animation-Studio-${pkg.version}-Windows-Portable`,
);
if (await fs.stat(target).catch(() => null))
  throw Error(
    "Refusing to replace an existing versioned portable directory: " + target,
  );
let runtime = path.resolve("node_modules/electron/dist");
if (process.platform !== "win32") {
  const { downloadArtifact } = require("@electron/get"),
    extract = require("extract-zip");
  const zip = await downloadArtifact({
    version: pkg.devDependencies.electron,
    artifactName: "electron",
    platform: "win32",
    arch: "x64",
  });
  runtime = path.resolve(
    "release",
    `electron-${pkg.devDependencies.electron}-win32-runtime`,
  );
  if (!(await fs.stat(runtime).catch(() => null)))
    await extract(zip, { dir: runtime });
}
await fs.mkdir(target, { recursive: true });
await fs.cp(runtime, target, { recursive: true });
const host = path.join(target, "Chess Animation Studio.exe");
await fs.rename(path.join(target, "electron.exe"), host);
await fs.rm(path.join(target, "resources/default_app.asar"), { force: true });
const app = path.join(target, "resources/app");
await fs.mkdir(app, { recursive: true });
for (const name of ["dist", "desktop-build", "samples", "docs"])
  await fs.cp(name, path.join(app, name), { recursive: true });
await fs.copyFile("LICENSE", path.join(app, "LICENSE"));
await fs.writeFile(
  path.join(app, "package.json"),
  JSON.stringify({
    name: pkg.name,
    version: pkg.version,
    main: "desktop-build/main.cjs",
  }),
);
const sha = async (p) =>
  crypto
    .createHash("sha256")
    .update(await fs.readFile(p))
    .digest("hex");
const before = await sha(path.join(runtime, "electron.exe"));
if (before !== (await sha(host)))
  throw Error("Runtime executable was unexpectedly modified.");
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const dirty = !!execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
const manifest = {
  appVersion: pkg.version,
  sourceCommit: commit,
  sourceDirty: dirty,
  electron: pkg.devDependencies.electron,
  node: process.version,
  buildOS: process.platform,
  buildArch: process.arch,
  runtimeExecutableSha256: before,
  packaging:
    "Unmodified official Electron runtime; application payload in resources/app. No executable resource editing or app signing.",
  appSigned: false,
};
await fs.writeFile(
  path.join(target, "BUILD.json"),
  JSON.stringify(manifest, null, 2),
);
await fs.writeFile(
  path.join(target, "START-HERE.txt"),
  `Chess Animation Studio ${pkg.version}\r\nExtract all files, then open Chess Animation Studio.exe. Keep the files together.\r\nThe runtime retains its upstream vendor signature; this application payload is unsigned. Windows policy approval is not guaranteed.\r\nChoose FFmpeg in Files to enable MP4 export. Stockfish is optional.\r\n`,
);
const zip = target + ".zip";
if (process.platform === "win32") {
  const escaped = target.replace(/'/g, "''"),
    z = zip.replace(/'/g, "''");
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Compress-Archive -Path '${escaped}\\*' -DestinationPath '${z}' -CompressionLevel Optimal`,
    ],
    { stdio: "inherit" },
  );
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `$s=Get-AuthenticodeSignature -LiteralPath '${host.replace(/'/g, "''")}'; $s | Select-Object Status,StatusMessage,@{n='Subject';e={$_.SignerCertificate.Subject}} | ConvertTo-Json`,
    ],
    { encoding: "utf8" },
  );
  await fs.writeFile(
    path.join("release", `runtime-signature-${pkg.version}.json`),
    result.stdout,
  );
} else
  execFileSync(
    "python3",
    [
      "-c",
      'import shutil,sys; shutil.make_archive(sys.argv[1],"zip",sys.argv[2])',
      target,
      target,
    ],
    { stdio: "inherit" },
  );
const checksum = await sha(zip);
await fs.writeFile(zip + ".sha256", `${checksum}  ${path.basename(zip)}\n`);
console.log(
  JSON.stringify(
    { ...manifest, archive: path.basename(zip), sha256: checksum },
    null,
    2,
  ),
);
