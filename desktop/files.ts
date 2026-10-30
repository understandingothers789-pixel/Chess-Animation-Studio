import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseProject, type Project, type Asset } from "../src/core/project";
export const extensions = {
  audio: new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]),
  image: new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]),
};
export async function atomic(file: string, data: string | Uint8Array) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = file + ".tmp-" + randomUUID();
  try {
    const h = await fs.open(temp, "wx");
    try {
      await h.writeFile(data);
      await h.sync();
    } finally {
      await h.close();
    }
    await fs.rename(temp, file);
  } catch (e) {
    await fs.rm(temp, { force: true });
    throw e;
  }
}
export async function readProject(file: string): Promise<Project> {
  const stat = await fs.stat(file);
  if (stat.size > 32 * 1024 * 1024)
    throw Error("Project is larger than 32 MB.");
  const p = parseProject(JSON.parse(await fs.readFile(file, "utf8")));
  for (const a of p.assets) a.path = path.resolve(path.dirname(file), a.path);
  return p;
}
export async function writeProject(file: string, p: Project) {
  const copy = parseProject(structuredClone(p));
  for (const a of copy.assets)
    a.path = path.relative(path.dirname(file), a.path);
  await atomic(file, JSON.stringify(copy, null, 2));
}
export async function validAsset(a: Asset) {
  if (!extensions[a.kind].has(path.extname(a.path).toLowerCase()))
    throw Error("Unsupported asset type.");
  const s = await fs.stat(a.path);
  if (!s.isFile() || s.size > 256 * 1024 * 1024)
    throw Error("Asset must be a file smaller than 256 MB.");
  return s;
}
export async function dataUrl(a: Asset) {
  await validAsset(a);
  const ext = path.extname(a.path).slice(1).toLowerCase(),
    mime =
      ext === "svg"
        ? "image/svg+xml"
        : a.kind === "image"
          ? `image/${ext === "jpg" ? "jpeg" : ext}`
          : `audio/${ext === "mp3" ? "mpeg" : ext === "m4a" ? "mp4" : ext}`;
  return `data:${mime};base64,${(await fs.readFile(a.path)).toString("base64")}`;
}
export async function collectProject(p: Project, dir: string) {
  const copy = structuredClone(p),
    assets = path.join(dir, "assets");
  await fs.mkdir(assets, { recursive: true });
  for (const a of copy.assets) {
    await validAsset(a);
    const name = a.id.replace(/[^a-z0-9-]/gi, "") + path.extname(a.path);
    const dest = path.join(assets, name);
    await fs.copyFile(a.path, dest, fs.constants.COPYFILE_EXCL);
    a.path = dest;
  }
  const file = path.join(dir, "Composition.castudio");
  await writeProject(file, copy);
  return { project: copy, path: file };
}
export async function readPack(file: string) {
  const s = await fs.stat(file);
  if (s.size > 65536) throw Error("Badge pack manifest exceeds 64 KB.");
  const m = JSON.parse(await fs.readFile(file, "utf8"));
  if (m.version !== 1 || !m.badges || typeof m.badges !== "object")
    throw Error("Expected badge pack version 1.");
  const root = await fs.realpath(path.dirname(file)),
    assets: Asset[] = [],
    mapping: Record<string, string> = {};
  for (const [key, v] of Object.entries(m.badges)) {
    if (
      ![
        "book",
        "brilliant",
        "best",
        "good",
        "inaccuracy",
        "mistake",
        "blunder",
        "custom",
      ].includes(key) ||
      typeof v !== "string" ||
      path.isAbsolute(v)
    )
      throw Error("Invalid badge entry.");
    const target = await fs.realpath(path.resolve(root, v));
    if (!target.startsWith(root + path.sep))
      throw Error("Badge paths must stay within the pack directory.");
    const a: Asset = {
      id: randomUUID(),
      name: key,
      kind: "image",
      path: target,
      source: String(m.source ?? "").slice(0, 3000),
      guidance: String(m.guidance ?? "").slice(0, 6000),
    };
    await validAsset(a);
    assets.push(a);
    mapping[key] = a.id;
  }
  return { assets, mapping };
}
export function sound(capture = false): Buffer {
  const sr = 48000,
    length = Math.round(sr * (capture ? 0.16 : 0.075)),
    data = Buffer.alloc(44 + length * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(sr, 24);
  data.writeUInt32LE(sr * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const t = i / sr,
      envelope = Math.exp(-t * (capture ? 35 : 75));
    const value =
      Math.sin(2 * Math.PI * (capture ? 130 : 240) * t) * envelope * 0.25;
    data.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return data;
}
