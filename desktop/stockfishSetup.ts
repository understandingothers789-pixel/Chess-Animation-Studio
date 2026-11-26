import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import extract from "extract-zip";

const repository = "https://github.com/official-stockfish/Stockfish";
const maxArchive = 384 * 1024 * 1024;
const maxUnpacked = 512 * 1024 * 1024;
const sha256 = /^[a-f0-9]{64}$/i;

async function metadata(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
  });
  if (!response.ok)
    throw Error(
      `Could not check official Stockfish releases (HTTP ${response.status}).`,
    );
  const text = await response.text();
  if (text.length > 2_000_000)
    throw Error("Unexpected Stockfish release metadata.");
  return text;
}

async function hashFile(file: string, signal: AbortSignal) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file, { signal }))
    hash.update(chunk);
  return hash.digest("hex");
}

async function findExecutable(dir: string, name: string, signal: AbortSignal) {
  const matches: string[] = [];
  const visit = async (folder: string) => {
    signal.throwIfAborted();
    for (const item of await fs.readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isDirectory()) await visit(file);
      else if (item.isFile() && item.name.toLowerCase() === name)
        matches.push(file);
    }
  };
  await visit(dir);
  if (matches.length !== 1)
    throw Error(
      "The official archive does not contain the expected Stockfish executable.",
    );
  return matches[0];
}

export async function installStockfishDev(
  downloads: string,
  platform: string,
  arch: string,
  signal: AbortSignal,
  status: (message: string) => void,
) {
  if (platform !== "win32" || (arch !== "x64" && arch !== "arm64"))
    throw Error("Automatic Stockfish setup supports Windows x64 and ARM64.");
  status("Checking official Stockfish development releases…");
  const feed = await metadata(`${repository}/releases.atom`, signal);
  const tag = feed.match(
    /<id>tag:github\.com,2008:Repository\/\d+\/(stockfish-dev-\d{8}-[a-f0-9]{7,40})<\/id>/,
  )?.[1];
  if (!tag) throw Error("No official Stockfish development release was found.");
  const listing = await metadata(
    `${repository}/releases/expanded_assets/${tag}`,
    signal,
  );
  const releasePath = `/official-stockfish/Stockfish/releases/download/${tag}/`;
  const names =
    arch === "x64"
      ? [
          "stockfish-windows-x86-64-universal.zip",
          "stockfish-windows-x64-universal.zip",
        ]
      : ["stockfish-windows-arm64-universal.zip"];
  const asset = names.find((name) =>
    listing.includes(`href="${releasePath}${name}"`),
  );
  if (!asset) throw Error(`${tag} has no compatible Windows download.`);
  const digest = listing
    .split(`aria-label="Copy to clipboard digest for ${asset}"`)[1]
    ?.match(/^[^>]*\bvalue="sha256:([a-f0-9]{64})"/i)?.[1]
    ?.toLowerCase();
  if (!digest) throw Error("The official asset is missing a SHA-256 checksum.");

  const executable = asset.replace(/\.zip$/, ".exe");
  const url = `https://github.com${releasePath}${asset}`;
  const folder = path.resolve(downloads, "Stockfish Development", tag);
  const installed = path.join(folder, arch);
  const binary = path.join(installed, executable);
  const manifest = "studio-stockfish.json";
  const reuse = async () => {
    try {
      const { archiveHash, engineHash } = JSON.parse(
        await fs.readFile(path.join(installed, manifest), "utf8"),
      );
      return (
        archiveHash === digest &&
        typeof engineHash === "string" &&
        sha256.test(engineHash) &&
        (await hashFile(binary, signal)) === engineHash
      );
    } catch {
      signal.throwIfAborted();
      return false;
    }
  };
  const existing = await fs
    .lstat(installed)
    .catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return null;
      throw err;
    });
  if (existing) {
    if (await reuse()) return { binary, tag, reused: true };
    throw Error(
      `This Stockfish installation could not be verified. Move it out of ${installed} and retry.`,
    );
  }

  await fs.mkdir(folder, { recursive: true });
  const temp = await fs.mkdtemp(path.join(folder, ".install-"));
  try {
    const archive = path.join(temp, asset);
    const staged = path.join(temp, "package");
    const timeout = AbortSignal.any([signal, AbortSignal.timeout(300_000)]);
    status(`Downloading ${tag}…`);
    const response = await fetch(url, { signal: timeout });
    if (!response.ok || !response.body)
      throw Error(`Stockfish download failed (HTTP ${response.status}).`);
    const declared = Number(response.headers.get("content-length")) || 0;
    if (declared > maxArchive) throw Error("Stockfish download is too large.");
    const reader = response.body.getReader();
    const output = await fs.open(archive, "wx");
    const hash = createHash("sha256");
    let bytes = 0;
    let nextUpdate = 4 * 1024 * 1024;
    try {
      for (;;) {
        timeout.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxArchive || (declared && bytes > declared))
          throw Error("Stockfish download exceeds its expected size.");
        hash.update(value);
        await output.writeFile(value);
        if (bytes >= nextUpdate) {
          status(
            `Downloading Stockfish dev · ${Math.floor(bytes / 1024 ** 2)} MiB`,
          );
          nextUpdate = bytes + 4 * 1024 * 1024;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      await output.close();
    }
    if (
      !bytes ||
      (declared && bytes !== declared) ||
      hash.digest("hex") !== digest
    )
      throw Error("Stockfish download did not match the official checksum.");

    status("Verifying and unpacking Stockfish…");
    await fs.mkdir(staged);
    let unpacked = 0;
    await extract(archive, {
      dir: staged,
      onEntry(entry) {
        signal.throwIfAborted();
        unpacked += entry.uncompressedSize;
        if (unpacked > maxUnpacked)
          throw Error("Stockfish archive expands past the size limit.");
      },
    });
    const found = await findExecutable(staged, executable, signal);
    const selected = path.join(staged, executable);
    if (found !== selected) await fs.rename(found, selected);
    const handle = await fs.open(selected, "r");
    try {
      const header = Buffer.alloc(2);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      if (bytesRead !== 2 || header.toString("ascii") !== "MZ")
        throw Error("Stockfish archive does not contain a Windows executable.");
    } finally {
      await handle.close();
    }
    const engineHash = await hashFile(selected, signal);
    if (process.platform === "win32")
      await fs.writeFile(
        `${selected}:Zone.Identifier`,
        `[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=${url}\r\n`,
      );
    await fs.writeFile(
      path.join(staged, manifest),
      JSON.stringify({ archiveHash: digest, engineHash }),
    );
    signal.throwIfAborted();
    try {
      await fs.rename(staged, installed);
    } catch (err) {
      if (await reuse()) return { binary, tag, reused: true };
      throw err;
    }
    return { binary, tag, reused: false };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
