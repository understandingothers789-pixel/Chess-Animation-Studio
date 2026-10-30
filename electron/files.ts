import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseProject, type Project, type Asset } from "../src/core/model";
import { z } from "zod";
import { buildGame } from "../src/core/chess";

export async function atomicWrite(file: string, data: string | Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomUUID()}.tmp`,
  );
  try {
    const handle = await fs.open(temp, "wx");
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true }).catch(() => {});
  }
}
export async function readProject(file: string): Promise<Project> {
  const stat = await fs.stat(file);
  if (stat.size > 32 * 1024 * 1024) throw new Error("Project exceeds 32 MB.");
  const p = parseProject(JSON.parse(await fs.readFile(file, "utf8")));
  buildGame(p);
  return p;
}
export async function readBadgePack(
  file: string,
): Promise<{ assets: Asset[]; badges: Record<string, string> }> {
  if ((await fs.stat(file)).size > 1_000_000)
    throw new Error("Badge pack manifest exceeds 1 MB.");
  const pack = z
    .object({
      kind: z.literal("chess-animation-badges"),
      schemaVersion: z.literal(1),
      source: z.string().max(10000),
      guidance: z.string().max(10000),
      badges: z.record(z.string().min(1).max(32), z.string().min(1).max(1000)),
    })
    .parse(JSON.parse(await fs.readFile(file, "utf8")));
  if (Object.keys(pack.badges).length > 100)
    throw new Error("Too many badge images in this pack.");
  const root = await fs.realpath(path.dirname(file)),
    assets: Asset[] = [],
    badges: Record<string, string> = {};
  for (const [label, relative] of Object.entries(pack.badges)) {
    if (path.isAbsolute(relative))
      throw new Error("Pack images must use relative paths.");
    const resolved = await fs.realpath(path.resolve(root, relative));
    if (
      !resolved.startsWith(root + path.sep) ||
      ![".png", ".webp", ".jpg", ".jpeg"].includes(
        path.extname(resolved).toLowerCase(),
      )
    )
      throw new Error(
        "Badge images must be PNG/WebP/JPEG files inside the pack folder.",
      );
    const id = randomUUID();
    assets.push({
      id,
      name: `${label} · local pack`,
      path: resolved,
      kind: "badge",
      source: pack.source,
      guidance: pack.guidance,
    });
    badges[label] = id;
  }
  return { assets, badges };
}
export const resolveAsset = (asset: Asset, projectPath: string | null) =>
  path.isAbsolute(asset.path)
    ? asset.path
    : path.resolve(
        projectPath ? path.dirname(projectPath) : process.cwd(),
        asset.path,
      );
export function relativeAssets(
  p: Project,
  from: string | null,
  to: string,
): Project {
  const copy = structuredClone(p);
  for (const a of copy.assets)
    a.path = path
      .relative(path.dirname(to), resolveAsset(a, from))
      .split(path.sep)
      .join("/");
  return copy;
}
export async function dataForAsset(
  a: Asset,
  projectPath: string | null,
): Promise<{ data: string; mime: string }> {
  const file = resolveAsset(a, projectPath),
    stat = await fs.stat(file);
  if (stat.size > 256 * 1024 * 1024)
    throw new Error(
      `${a.name} exceeds the 256 MB import limit. Use a trimmed audio file.`,
    );
  const mime = (
    {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".flac": "audio/flac",
      ".png": "image/png",
      ".webp": "image/webp",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    } as Record<string, string>
  )[path.extname(file).toLowerCase()];
  if (!mime)
    throw new Error(
      "Unsupported asset type. Use WAV/MP3/OGG/M4A/FLAC or PNG/JPEG/WebP.",
    );
  if ((a.kind === "audio") !== mime.startsWith("audio/"))
    throw new Error("Asset type does not match the file.");
  const data = (await fs.readFile(file)).toString("base64");
  return { data: `data:${mime};base64,${data}`, mime };
}
export async function collectProject(
  p: Project,
  source: string | null,
  folder: string,
): Promise<{ project: Project; path: string }> {
  const destination = path.join(folder, "project.castudio"),
    copy = structuredClone(p);
  await fs.mkdir(path.join(folder, "assets"), { recursive: true });
  // Validate every asset before copying; never overwrite existing project/assets.
  for (const a of p.assets) await fs.access(resolveAsset(a, source));
  try {
    await fs.access(destination);
    throw new Error(
      "This folder already contains a project. Choose a new folder.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (const a of copy.assets) {
    const filename = `${a.id.replace(/[^\w-]/g, "")}${path.extname(a.path).toLowerCase()}`;
    const dest = path.join(folder, "assets", filename);
    await fs.copyFile(resolveAsset(a, source), dest, 1);
    a.path = `assets/${filename}`;
  }
  await atomicWrite(destination, JSON.stringify(copy, null, 2));
  return { project: copy, path: destination };
}
export function synthWave(
  kind: "move" | "capture",
  sampleRate = 48000,
): Buffer {
  const length = Math.round(sampleRate * (kind === "move" ? 0.12 : 0.32)),
    pcm = Buffer.alloc(length * 2);
  let random = 1337;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    random = (Math.imul(random, 1664525) + 1013904223) | 0;
    const noise = ((random >>> 0) / 4294967296) * 2 - 1;
    const v =
      (Math.sin(2 * Math.PI * (kind === "move" ? 210 : 95) * t) * 0.7 +
        noise * 0.3) *
      Math.exp(-t * (kind === "move" ? 45 : 19)) *
      0.5;
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
