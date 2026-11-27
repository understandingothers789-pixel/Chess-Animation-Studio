// Standard portable Electron layout using the official runtime and an optional publisher signature.
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
const appSigned = Boolean(process.env.STUDIO_SIGNING_PFX_BASE64);
if (process.env.STUDIO_REQUIRE_SIGNATURE === "true" && !appSigned)
  throw Error(
    "Windows publisher signing is required, but the signing credential is unavailable.",
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
for (const name of ["dist", "desktop-build", "samples"])
  await fs.cp(name, path.join(app, name), { recursive: true });
const docs = path.join(app, "docs");
await fs.mkdir(docs, { recursive: true });
for (const name of [
  "USER_GUIDE.md",
  "BADGE_PACK.md",
  "THIRD_PARTY.md",
  "SOURCES.md",
  "licenses",
])
  await fs.cp(path.join("docs", name), path.join(docs, name), {
    recursive: true,
  });
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
if (appSigned) {
  if (process.platform !== "win32")
    throw Error("Windows publisher signing requires a Windows build host.");
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.resolve("scripts/sign-windows.ps1"),
      host,
    ],
    { stdio: "inherit" },
  );
}
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
  packagedExecutableSha256: await sha(host),
  packaging: appSigned
    ? "Official Electron runtime with a verified publisher signature; application payload in resources/app."
    : "Unmodified official Electron runtime; application payload in resources/app.",
  appSigned,
};
await fs.writeFile(
  path.join(target, "BUILD.json"),
  JSON.stringify(manifest, null, 2),
);
await fs.writeFile(
  path.join(target, "START-HERE.txt"),
  `Chess Animation Studio ${pkg.version}\r\nExtract all files, then open Chess Animation Studio.exe. Keep the files together.\r\n${appSigned ? "The executable has a verified publisher signature." : "This build has no Studio publisher signature."}\r\nChoose FFmpeg in Files to enable MP4 export. Stockfish is optional.\r\n`,
);
const zip = path.join(
  path.dirname(target),
  `Chess-Animation-Studio-${pkg.version}-Windows-x64.zip`,
);
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
    result.stdout?.trim() ||
      JSON.stringify(
        {
          status: "Query failed",
          message: result.stderr || String(result.error || "No output"),
        },
        null,
        2,
      ),
  );
} else
  execFileSync(
    "python3",
    [
      "-c",
      'import shutil,sys; shutil.make_archive(sys.argv[1],"zip",sys.argv[2])',
      zip.slice(0, -4),
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
