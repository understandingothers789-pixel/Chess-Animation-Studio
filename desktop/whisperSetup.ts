import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import extract from "extract-zip";
const engineUrl =
  "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.2/whisper-bin-x64.zip";
const engineHash =
  "b1514ebc099765e39fa37eb780b92a140a94c86bb0b3b3d98226b38825979732";
const modelUrl =
  "https://raw.githubusercontent.com/alex-vt/WhisperInput/f0fb2a2822fa142d89ba37773f7a1b7f028901d1/app/src/main/assets/models/ggml-tiny.en.bin";
const modelHash =
  "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f";
async function download(
  url: string,
  file: string,
  algorithm: string,
  expected: string,
  max: number,
  signal?: AbortSignal,
) {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body)
    throw Error(
      `Whisper download failed (${response.status}). You can still import transcripts.`,
    );
  const handle = await fs.open(file, "w"),
    hash = createHash(algorithm);
  let bytes = 0;
  try {
    for await (const chunk of response.body as any) {
      bytes += chunk.length;
      if (bytes > max) throw Error("Whisper download exceeds expected size.");
      hash.update(chunk);
      await handle.writeFile(chunk);
    }
    if (hash.digest("hex") !== expected)
      throw Error("Whisper download checksum mismatch.");
  } finally {
    await handle.close();
  }
}
export async function installWhisper(root: string, signal?: AbortSignal) {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw Error(
      "Automatic setup supports Windows x64. On other platforms, choose an installed whisper-cli and GGML model.",
    );
  const target = path.join(root, "whisper-v1.8.2-tiny-en"),
    model = path.join(target, "ggml-tiny.en.bin");
  const find = async (dir: string): Promise<string | null> => {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        const nested = await find(full);
        if (nested) return nested;
      } else if (item.name.toLowerCase() === "whisper-cli.exe") return full;
    }
    return null;
  };
  if (await fs.stat(model).catch(() => null)) {
    const binary = await find(target);
    if (binary) return { binary, model };
  }
  await fs.mkdir(root, { recursive: true });
  const temp = await fs.mkdtemp(path.join(root, "whisper-setup-"));
  try {
    const zip = path.join(temp, "engine.zip"),
      unpacked = path.join(temp, "package");
    await fs.mkdir(unpacked);
    await download(engineUrl, zip, "sha256", engineHash, 10_000_000, signal);
    await download(
      modelUrl,
      path.join(unpacked, "ggml-tiny.en.bin"),
      "sha256",
      modelHash,
      80_000_000,
      signal,
    );
    if (signal?.aborted) throw Error("Whisper setup cancelled.");
    await extract(zip, { dir: unpacked });
    if (signal?.aborted) throw Error("Whisper setup cancelled.");
    if (!(await find(unpacked)))
      throw Error("Downloaded archive does not contain whisper-cli.exe.");
    if (signal?.aborted) throw Error("Whisper setup cancelled.");
    await fs.writeFile(
      path.join(unpacked, "SOURCES.txt"),
      `Whisper.cpp v1.8.2 (MIT): ${engineUrl}\nOpenAI Whisper tiny.en model (MIT), mirrored at: ${modelUrl}\nVerified model SHA-256: ${modelHash}\nOfficial model table SHA-1: c78c86eb1a8faa21b369bcd33207cc90d64ae9df\nhttps://github.com/ggml-org/whisper.cpp/blob/v1.8.2/LICENSE\nhttps://github.com/openai/whisper/blob/main/LICENSE\n`,
    );
    await fs.rm(target, { recursive: true, force: true });
    await fs.rename(unpacked, target);
    return { binary: (await find(target))!, model };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
