import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { filmLayout } from "../src/core/introVideo";
import { installStockfishDev } from "./stockfishSetup";
import {
  introDuration,
  introSourceFrame,
  prepareIntroVideo,
} from "./introVideo";
import { installWhisper } from "./whisperSetup";
import { transcribeLocal } from "./transcription";
import { requiredAssetIds } from "../src/core/exportAssets";
import { productionChecks } from "../src/core/productionChecks";
import { validateExport } from "../src/core/exportOptions";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  safeStorage,
  Menu,
  protocol,
  nativeImage,
} from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  parseProject,
  type Project,
  type Asset,
  VERSION,
  formats,
} from "../src/core/project";
import {
  atomic,
  readProject,
  writeProject,
  collectProject,
  assetMime,
  validAsset,
  readPack,
} from "./files";
import { analyze } from "./analysis";
import { VideoJob } from "./export";
import type {
  Settings,
  ExportOptions,
  ExportProgress,
  RecoverySummary,
} from "../src/bridge";
const mediaScheme = "studio-media";
protocol.registerSchemesAsPrivileged([
  {
    scheme: mediaScheme,
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
const mediaEntries = new Map<string, { file: string; type: string }>();
const mediaTokens = new Map<string, string>();

async function mediaUrl(asset: Asset, preview: boolean) {
  ensureAsset(asset);
  const stat = await validAsset(asset);
  const key = JSON.stringify([asset.path, stat.size, stat.mtimeMs, preview]);
  const existing = mediaTokens.get(key);
  if (existing && mediaEntries.has(existing)) {
    const entry = mediaEntries.get(existing)!;
    mediaEntries.delete(existing);
    mediaEntries.set(existing, entry);
    return `${mediaScheme}://asset/${existing}`;
  }
  let file = asset.path,
    type = assetMime(asset);
  if (preview && asset.kind === "image" && !/\.svg$/i.test(file)) {
    const image = nativeImage.createFromPath(file);
    const { width, height } = image.getSize();
    if (Math.max(width, height) > 1280) {
      const thumbnail = path.join(
        app.getPath("userData"),
        "previews",
        createHash("sha256").update(key).digest("hex") + ".png",
      );
      const resized =
        width >= height
          ? image.resize({ width: 1280 })
          : image.resize({ height: 1280 });
      if (!(await fs.stat(thumbnail).catch(() => null)))
        await atomic(thumbnail, resized.toPNG());
      file = thumbnail;
      type = "image/png";
    }
  }
  const token = randomUUID();
  mediaTokens.set(key, token);
  mediaEntries.set(token, { file, type });
  if (mediaEntries.size > 900) {
    const oldest = mediaEntries.keys().next().value!;
    mediaEntries.delete(oldest);
    for (const [name, value] of mediaTokens)
      if (value === oldest) mediaTokens.delete(name);
  }
  return `${mediaScheme}://asset/${token}`;
}

async function serveMedia(request: Request) {
  const url = new URL(request.url);
  const entry =
    url.hostname === "asset"
      ? mediaEntries.get(url.pathname.slice(1))
      : undefined;
  if (!entry || !["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 404 });
  const stat = await fs.stat(entry.file).catch(() => null);
  if (!stat?.isFile() || stat.size > 256 * 1024 * 1024)
    return new Response(null, { status: 404 });
  const headers = new Headers({
    "Content-Type": entry.type,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "private, max-age=60",
  });
  const range = request.headers.get("range");
  let start = 0,
    end = stat.size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, { status: 416 });
    const [, from, to] = match;
    start = from ? Number(from) : Math.max(0, stat.size - Number(to));
    end = from && to ? Math.min(end, Number(to)) : end;
    if (start > end || start >= stat.size || !Number.isSafeInteger(start)) {
      headers.set("Content-Range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  const stream =
    request.method === "HEAD" || stat.size === 0
      ? null
      : (Readable.toWeb(
          createReadStream(entry.file, { start, end }),
        ) as ReadableStream<Uint8Array>);
  return new Response(stream, { status: range ? 206 : 200, headers });
}
const root = path.resolve(__dirname, "..");
let editor: BrowserWindow | null = null,
  presentation: BrowserWindow | null = null,
  worker: BrowserWindow | null = null,
  job: VideoJob | null = null,
  analysis: AbortController | null = null;
let transcription: AbortController | null = null;
let stockfishDownload: {
  controller: AbortController;
  task: Promise<Settings>;
} | null = null;
let exportGeneration = 0;
let lastExportPath: string | undefined;
let pathProjectId: string | null = null;
let currentPath: string | null = null;
const allowed = new Map<string, string>();
const allowedIntroSources = new Map<string, string>();
let preferences: Settings = {
  ffmpeg: "",
  stockfish: "",
  encoder: "auto",
  tokenPresent: false,
};
let recoveryWrite = Promise.resolve(),
  lastState: unknown = null;
let flushingRecovery = false;
let quitting = false;
app.on("before-quit", () => {
  transcription?.abort();
  stockfishDownload?.controller.abort();
});
app.setPath(
  "userData",
  process.env.STUDIO_USER_DATA ??
    path.join(app.getPath("appData"), "ChessAnimationStudio-Fresh"),
);
const store = (file: string) => path.join(app.getPath("userData"), file);
async function json(file: string, fallback: unknown) {
  try {
    return JSON.parse(await fs.readFile(store(file), "utf8"));
  } catch {
    return fallback;
  }
}
async function log(message: string) {
  try {
    const f = store("logs/activity.log");
    await fs.mkdir(path.dirname(f), { recursive: true });
    if ((await fs.stat(f).catch(() => null))?.size! > 1e6) {
      await fs.rename(f, f + ".1").catch(() => {});
    }
    await fs.appendFile(f, `${new Date().toISOString()} ${message}\n`);
  } catch {}
}
async function remember(file: string) {
  const list = (await json("recent.json", [])) as string[];
  await atomic(
    store("recent.json"),
    JSON.stringify([file, ...list.filter((x) => x !== file)].slice(0, 12)),
  );
}
function permit(p: Project) {
  allowed.clear();
  allowedIntroSources.clear();
  for (const a of p.assets) {
    allowed.set(a.id, path.resolve(a.path));
    if (a.kind === "filmstrip" && a.videoSource)
      allowedIntroSources.set(a.id, path.resolve(a.videoSource));
  }
}
function ensureAsset(a: Asset) {
  if (
    allowed.get(a.id) !== path.resolve(a.path) ||
    (a.videoSource &&
      (a.kind !== "filmstrip" ||
        allowedIntroSources.get(a.id) !== path.resolve(a.videoSource)))
  )
    throw Error("Choose or relink this asset before reading it.");
}
function checkAssets(p: Project) {
  for (const a of p.assets) ensureAsset(a);
}
function windowOf(role: string) {
  const w = new BrowserWindow({
    width: role === "editor" ? 1550 : 1280,
    height: role === "editor" ? 980 : 720,
    minWidth: 1100,
    minHeight: 700,
    show: role !== "export",
    icon: path.join(root, "dist/studio-mark.png"),
    backgroundColor: "#101715",
    title: `Chess Animation Studio ${VERSION}`,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.env.STUDIO_DEV_URL)
    void w.loadURL(`${process.env.STUDIO_DEV_URL}?role=${role}`);
  else void w.loadFile(path.join(root, "dist/index.html"), { query: { role } });
  w.webContents.on("render-process-gone", (_e, d) => {
    void log("Renderer stopped: " + d.reason);
    if (role === "export" && worker === w && job)
      void failExport(Error("Export renderer stopped: " + d.reason));
  });
  return w;
}
function handle(
  name: string,
  fn: (...args: any[]) => unknown,
  role: "editor" | "worker" = "editor",
) {
  ipcMain.handle(name, async (event, ...args) => {
    const expected = role === "editor" ? editor : worker;
    if (!expected || event.sender !== expected.webContents)
      throw Error("Request is not allowed from this window.");
    try {
      return await fn(...args);
    } catch (e) {
      void log(
        `${name}: ${(e as Error).message.replace(/Bearer\s+\S+/g, "[redacted]")}`,
      );
      throw e;
    }
  });
}
const recoveryDir = () => store("recovery");
function recoveryGroup(projectId: string, file: string | null) {
  const resolved = file && path.resolve(file);
  const identity =
    process.platform === "win32" ? resolved?.toLowerCase() : resolved;
  return createHash("sha256")
    .update(JSON.stringify([projectId, identity]))
    .digest("hex");
}
type Checkpoint = { project: Project; path: string | null };
const checkpointFile = (id: string) =>
  id === "legacy"
    ? store("recovery.json")
    : path.join(recoveryDir(), id + ".json");
const checkpointId = /^(?:legacy|[0-9a-f]{64}(?:-\d{13}-[0-9a-f-]{36})?)$/;
function queueRecovery(work: () => Promise<void>) {
  const action = recoveryWrite.then(work);
  recoveryWrite = action.catch((e) =>
    log("Recovery write failed: " + e.message),
  );
  return action;
}
async function readCheckpoint(file: string): Promise<Checkpoint | null> {
  try {
    const item = JSON.parse(await fs.readFile(file, "utf8"));
    return {
      project: parseProject(item.project),
      path: typeof item.path === "string" ? item.path : null,
    };
  } catch {
    return null;
  }
}
async function listCheckpoints(): Promise<RecoverySummary[]> {
  const files = await fs.readdir(recoveryDir()).catch(() => []);
  const ids = [
    ...files
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -5))
      .filter((id) => checkpointId.test(id)),
    "legacy",
  ];
  const result: RecoverySummary[] = [];
  for (const id of ids) {
    const file = checkpointFile(id);
    const stat = await fs.stat(file).catch(() => null);
    if (!stat) continue;
    const item = await readCheckpoint(file);
    if (item)
      result.push({
        id,
        projectId: item.project.id,
        title: item.project.title,
        path: item.path,
        updated: stat.mtimeMs,
      });
  }
  return result.sort(
    (a, b) => b.updated - a.updated || b.id.localeCompare(a.id),
  );
}
async function recoveryList(includeSaved = false) {
  await recoveryWrite;
  const items = await listCheckpoints();
  if (includeSaved) return items;
  const newest = new Map<string, RecoverySummary>();
  for (const item of items) {
    const group = recoveryGroup(item.projectId, item.path);
    if (!newest.has(group)) newest.set(group, item);
  }
  const active = await Promise.all(
    [...newest].map(async ([group, item]) => {
      const saved = await json(path.join("recovery", group + ".saved"), 0);
      return item.updated > Number(saved) ? item : null;
    }),
  );
  return active.filter((item): item is RecoverySummary => !!item);
}
async function recoveryItem(id: string) {
  if (typeof id !== "string" || !checkpointId.test(id))
    throw Error("Invalid recovery checkpoint.");
  return readCheckpoint(checkpointFile(id));
}
async function writeCheckpoint(item: Checkpoint, preserve?: string) {
  const group = recoveryGroup(item.project.id, item.path);
  const files = await fs.readdir(recoveryDir()).catch(() => []);
  const older = files
    .filter((name) => name.startsWith(group + "-") && name.endsWith(".json"))
    .sort()
    .reverse();
  const data = JSON.stringify(item);
  if (
    older[0] &&
    (await fs
      .readFile(path.join(recoveryDir(), older[0]), "utf8")
      .catch(() => "")) === data
  ) {
    const stat = await fs.stat(path.join(recoveryDir(), older[0]));
    const saved = await json(path.join("recovery", group + ".saved"), 0);
    if (stat.mtimeMs > Number(saved)) return;
  }
  const id = group + "-" + Date.now() + "-" + randomUUID();
  await atomic(checkpointFile(id), data);
  await Promise.all(
    older
      .slice(3)
      .filter((name) => name !== preserve + ".json")
      .map((name) => fs.rm(path.join(recoveryDir(), name), { force: true })),
  );
}
function adoptRecovery(item: Checkpoint) {
  permit(item.project);
  currentPath = item.path;
  pathProjectId = item.project.id;
  return item;
}
async function open(file: string) {
  const p = await readProject(file);
  permit(p);
  currentPath = file;
  pathProjectId = p.id;
  await remember(file);
  void log("Project opened.");
  return { project: p, path: file };
}
async function chooseFile(filters: Electron.FileFilter[]) {
  const r = await dialog.showOpenDialog(editor!, {
    properties: ["openFile"],
    filters,
  });
  return r.canceled ? null : r.filePaths[0];
}
async function save(p: Project, as: boolean) {
  p = parseProject(p);
  checkAssets(p);
  const previousPath = pathProjectId === p.id ? currentPath : null;
  let file = previousPath;
  if (as || !file) {
    const r = await dialog.showSaveDialog(editor!, {
      defaultPath: p.title.replace(/[^a-z0-9 _-]/gi, "") + ".castudio",
      filters: [{ name: "Chess Studio project", extensions: ["castudio"] }],
    });
    if (r.canceled || !r.filePath) return null;
    file = r.filePath;
  }
  await writeProject(file, p);
  const group = recoveryGroup(p.id, file);
  await queueRecovery(async () => {
    const groups = new Set([
      group,
      ...(previousPath ? [] : [recoveryGroup(p.id, null)]),
    ]);
    for (const key of groups) {
      const latest = (await listCheckpoints()).find(
        (item) => recoveryGroup(item.projectId, item.path) === key,
      );
      if (!latest) continue;
      const snapshot = await recoveryItem(latest.id);
      if (JSON.stringify(snapshot?.project) === JSON.stringify(p))
        await atomic(
          store(path.join("recovery", key + ".saved")),
          JSON.stringify(latest.updated),
        );
    }
  });
  currentPath = file;
  pathProjectId = p.id;
  await remember(file);
  return file;
}
async function importIntro(
  input: string,
  trim?: Asset["videoTrim"],
  knownDuration?: number,
): Promise<Asset> {
  if (!preferences.ffmpeg)
    throw Error("Choose FFmpeg before preparing an intro video.");
  const id = randomUUID();
  const output = store(path.join("intro-media", id + ".jpg"));
  const duration =
    knownDuration ?? (await introDuration(preferences.ffmpeg, input));
  const seconds = Math.min(
    trim?.seconds ?? 3,
    duration ? Math.max(0, duration - (trim?.start ?? 0)) : 6,
  );
  if (seconds <= 0)
    throw Error("Choose an in-point before the end of the original video.");
  const film = filmLayout(seconds, trim?.quality === "detail");
  await prepareIntroVideo(preferences.ffmpeg, input, output, trim, film);
  const a: Asset = {
    id,
    kind: "filmstrip",
    name: path.basename(input),
    path: output,
    source: "Intro video",
    videoTrim: trim,
    film,
    videoSource: input,
    videoDuration: duration,
    guidance:
      "Silent prepared clip. Keep the original media to change its crop or in-point.",
  };
  allowed.set(id, path.resolve(output));
  allowedIntroSources.set(id, path.resolve(input));
  return a;
}
async function readToken() {
  try {
    return safeStorage.decryptString(
      await fs.readFile(store("masters-token.bin")),
    );
  } catch {
    return "";
  }
}
async function failExport(error: unknown) {
  const message = (error as Error).message;
  const target = worker,
    active = job;
  worker = null;
  job = null;
  target?.destroy();
  await active?.clean();
  editor?.webContents.send("export-progress", {
    phase: "Failed",
    done: 0,
    total: 1,
    error: message,
  });
  void log("Export failed: " + message);
}
app.whenReady().then(async () => {
  protocol.handle(mediaScheme, serveMedia);
  const saved = (await json("settings.json", {})) as Partial<Settings>;
  preferences = {
    ...preferences,
    ...saved,
    ffmpeg: process.env.FFMPEG_PATH ?? saved.ffmpeg ?? "",
    stockfish: process.env.STOCKFISH_PATH ?? saved.stockfish ?? "",
    tokenPresent: !!(await readToken()),
    platform: process.platform,
    architecture: process.arch,
    whisper: process.env.WHISPER_PATH ?? saved.whisper,
    whisperModel: process.env.WHISPER_MODEL_PATH ?? saved.whisperModel,
  };
  Menu.setApplicationMenu(null);
  editor = windowOf("editor");
  void log(`Startup ${VERSION}; ${process.platform} ${process.arch}`);
  editor.on("close", (e) => {
    if (stockfishDownload) {
      e.preventDefault();
      stockfishDownload.controller.abort();
      void stockfishDownload.task
        .catch(() => {})
        .finally(() => editor?.close());
      return;
    }
    if (!quitting) {
      e.preventDefault();
      if (flushingRecovery) return;
      flushingRecovery = true;
      const closing = editor;
      if (!closing) return;
      const flushed = new Promise<void>((resolve) => {
        const ready = (event: Electron.IpcMainEvent) => {
          if (event.sender === closing.webContents) complete();
        };
        const complete = () => {
          clearTimeout(timer);
          ipcMain.removeListener("recovery-flushed", ready);
          resolve();
        };
        const timer = setTimeout(complete, 2000);
        ipcMain.on("recovery-flushed", ready);
        closing.webContents.send("flush-recovery");
      });
      void flushed
        .then(() => recoveryWrite)
        .finally(() => {
          quitting = true;
          if (!closing.isDestroyed()) closing.close();
        });
    }
  });
  editor.on("closed", () => {
    editor = null;
    presentation?.destroy();
    worker?.destroy();
    analysis?.abort();
    void job?.cancel();
    app.quit();
  });
  handle("sample", async () => {
    const p = await readProject(path.join(root, "samples/Opera.castudio"));
    permit(p);
    currentPath = null;
    pathProjectId = null;
    return p;
  });
  handle("open", async () => {
    const f = await chooseFile([
      { name: "Chess Studio project", extensions: ["castudio"] },
    ]);
    return f ? open(f) : null;
  });
  handle("openPath", async (f: string) => {
    const recent = (await json("recent.json", [])) as string[];
    if (!recent.includes(f)) throw Error("Project is not in recent files.");
    return open(f);
  });
  handle("save", save);
  handle("projectReport", async (input: Project) => {
    const p = parseProject(input);
    const r = await dialog.showSaveDialog(editor!, {
      defaultPath: p.title.replace(/[^a-z0-9 _-]/gi, "") + "-settings.json",
      filters: [{ name: "Project settings report", extensions: ["json"] }],
    });
    if (r.canceled || !r.filePath) return null;
    const report = structuredClone(p);
    report.assets = report.assets.map((asset) => ({
      ...asset,
      path: "[local path omitted]",
      videoSource: undefined,
    }));
    await fs.writeFile(r.filePath, JSON.stringify(report, null, 2), "utf8");
    return r.filePath;
  });
  handle("autosave", async (value: unknown, preserve?: string) => {
    const project = parseProject(value);
    checkAssets(project);
    const checkpoint = {
      project,
      path: pathProjectId === project.id ? currentPath : null,
    };
    return queueRecovery(() => writeCheckpoint(checkpoint, preserve));
  });
  handle("listRecovery", recoveryList);
  handle("openRecovery", async (id: string) => {
    await recoveryWrite;
    const item = await recoveryItem(id);
    if (!item) throw Error("This recovery checkpoint is no longer available.");
    return adoptRecovery(item);
  });
  handle("recover", async () => {
    const [summary] = await recoveryList();
    const item = summary && (await recoveryItem(summary.id));
    return item ? adoptRecovery(item) : null;
  });
  handle("discardRecovery", async (id?: string) => {
    const target = id ?? (await recoveryList())[0]?.id;
    if (typeof target !== "string" || !checkpointId.test(target)) return;
    return queueRecovery(() => fs.rm(checkpointFile(target), { force: true }));
  });
  handle("recent", () => json("recent.json", []));
  handle("chooseTranscript", async () => {
    const file = await chooseFile([
      { name: "Timed transcript", extensions: ["json", "srt", "vtt"] },
    ]);
    if (!file) return null;
    if ((await fs.stat(file)).size > 4_000_000)
      throw Error("Transcript exceeds 4 MB.");
    return { text: await fs.readFile(file, "utf8"), name: path.basename(file) };
  });
  handle("whisperInstall", async () => {
    if (transcription)
      throw Error("A transcription/setup task is already running.");
    const controller = new AbortController();
    transcription = controller;
    try {
      const tools = await installWhisper(
        app.getPath("userData"),
        controller.signal,
      );
      preferences.whisper = tools.binary;
      preferences.whisperModel = tools.model;
      await atomic(store("settings.json"), JSON.stringify(preferences));
      return preferences;
    } finally {
      if (transcription === controller) transcription = null;
    }
  });
  handle("whisperTool", async (kind: string) => {
    if (kind !== "binary" && kind !== "model")
      throw Error("Invalid Whisper tool kind.");
    const file = await chooseFile([
      {
        name: kind === "model" ? "Whisper GGML model" : "whisper-cli",
        extensions:
          kind === "model"
            ? ["bin"]
            : process.platform === "win32"
              ? ["exe"]
              : ["*"],
      },
    ]);
    if (file) {
      preferences[kind === "model" ? "whisperModel" : "whisper"] = file;
      await atomic(store("settings.json"), JSON.stringify(preferences));
    }
    return preferences;
  });
  handle("whisperSetup", async () => {
    await shell.openExternal(
      "https://github.com/ggml-org/whisper.cpp/releases",
    );
  });
  handle("cancelTranscription", () => {
    transcription?.abort();
  });
  handle("transcribe", async (asset: Asset, mode: string) => {
    if (mode !== "source" && mode !== "storyboard")
      throw Error("Invalid transcript timeline.");
    if (transcription) throw Error("A local transcription is already running.");
    if (
      asset.kind !== "audio" ||
      allowed.get(asset.id) !== path.resolve(asset.path)
    )
      throw Error("Import this audio into the project first.");
    const controller = new AbortController();
    transcription = controller;
    try {
      await validAsset(asset);
      return await transcribeLocal({
        audio: asset.path,
        binary: preferences.whisper ?? "",
        model: preferences.whisperModel ?? "",
        ffmpeg: preferences.ffmpeg || "ffmpeg",
        mode,
        signal: controller.signal,
      });
    } finally {
      if (transcription === controller) transcription = null;
    }
  });
  handle("chooseText", async (kind: string) => {
    if (!["pgn", "fen"].includes(kind)) throw Error("Invalid import type.");
    const f = await chooseFile([
      { name: kind.toUpperCase(), extensions: [kind, "txt"] },
    ]);
    if (!f) return null;
    if ((await fs.stat(f)).size > 2e6) throw Error("Text file exceeds 2 MB.");
    return fs.readFile(f, "utf8");
  });
  handle(
    "importAsset",
    async (kind: Asset["kind"], trim?: Asset["videoTrim"]) => {
      if (kind === "filmstrip") {
        if (!preferences.ffmpeg)
          throw Error("Choose FFmpeg before importing an intro video.");
        const input = await chooseFile([
          {
            name: "Video or animated reaction",
            extensions: ["mp4", "mov", "webm", "mkv", "m4v", "gif", "webp"],
          },
        ]);
        if (!input) return null;
        return importIntro(input, trim);
      }
      if (!["audio", "image"].includes(kind))
        throw Error("Invalid asset type.");
      const f = await chooseFile([
        {
          name: kind === "audio" ? "Music or sound" : "Image",
          extensions:
            kind === "audio"
              ? ["mp3", "wav", "ogg", "m4a", "flac", "aac"]
              : ["png", "jpg", "jpeg", "webp", "svg"],
        },
      ]);
      if (!f) return null;
      const a: Asset = {
        id: randomUUID(),
        name: path.basename(f),
        kind,
        path: f,
        source: "Local import",
        guidance: "",
      };
      await validAsset(a);
      allowed.set(a.id, path.resolve(f));
      return a;
    },
  );
  handle(
    "retimeIntro",
    async (asset: Asset, trim: NonNullable<Asset["videoTrim"]>) => {
      ensureAsset(asset);
      if (asset.kind !== "filmstrip" || !asset.videoSource)
        throw Error("Replace the intro to attach its original video.");
      return importIntro(asset.videoSource, trim, asset.videoDuration);
    },
  );
  handle("introSourceFrame", async (asset: Asset, time: number) => {
    ensureAsset(asset);
    if (!preferences.ffmpeg || asset.kind !== "filmstrip" || !asset.videoSource)
      return null;
    return introSourceFrame(preferences.ffmpeg, asset.videoSource, time);
  });
  handle("assetData", async (a: Asset) => {
    ensureAsset(a);
    try {
      return await mediaUrl(a, true);
    } catch {
      return null;
    }
  });
  handle("assetStatus", async (assets: Asset[]) => {
    const states: Record<string, string | null> = {};
    for (const a of assets) {
      ensureAsset(a);
      try {
        const s = await validAsset(a);
        states[a.id] = s.size + ":" + s.mtimeMs;
      } catch {
        states[a.id] = null;
      }
    }
    return states;
  });
  handle("collect", async (value: unknown) => {
    const p = parseProject(value);
    checkAssets(p);
    const r = await dialog.showOpenDialog(editor!, {
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled) return null;
    const dir = path.join(
      r.filePaths[0],
      p.title.replace(/[^a-z0-9 _-]/gi, "") + "-" + Date.now(),
    );
    const result = await collectProject(p, dir);
    permit(result.project);
    currentPath = result.path;
    pathProjectId = result.project.id;
    await remember(result.path);
    return result;
  });
  handle("badgePack", async () => {
    const f = await chooseFile([
      { name: "Badge pack manifest", extensions: ["json"] },
    ]);
    if (!f) return null;
    const pack = await readPack(f);
    for (const a of pack.assets) allowed.set(a.id, path.resolve(a.path));
    return pack;
  });
  handle("settings", () => preferences);
  handle("stockfishInstall", async () => {
    if (stockfishDownload) throw Error("Stockfish setup is already running.");
    const controller = new AbortController();
    const task = (async () => {
      const result = await installStockfishDev(
        app.getPath("downloads"),
        process.platform,
        process.arch,
        controller.signal,
        (message) => editor?.webContents.send("stockfish-progress", message),
      );
      const next = { ...preferences, stockfish: result.binary };
      await atomic(store("settings.json"), JSON.stringify(next));
      preferences.stockfish = result.binary;
      return preferences;
    })();
    stockfishDownload = { controller, task };
    try {
      return await task;
    } catch (error) {
      if (controller.signal.aborted) return null;
      throw error;
    } finally {
      stockfishDownload = null;
    }
  });
  handle("cancelStockfishInstall", () => {
    stockfishDownload?.controller.abort();
  });
  handle("showStockfish", () => {
    if (preferences.stockfish) shell.showItemInFolder(preferences.stockfish);
  });
  handle("tool", async (kind: "ffmpeg" | "stockfish") => {
    if (!["ffmpeg", "stockfish"].includes(kind)) throw Error("Unknown tool.");
    const f = await chooseFile([
      {
        name: kind,
        extensions: process.platform === "win32" ? ["exe"] : ["*"],
      },
    ]);
    if (f) {
      preferences[kind] = f;
      await atomic(store("settings.json"), JSON.stringify(preferences));
    }
    return preferences;
  });
  handle("setEncoder", async (v: string) => {
    if (v !== "auto" && v !== "software")
      throw Error("Invalid encoder setting.");
    preferences.encoder = v;
    await atomic(store("settings.json"), JSON.stringify(preferences));
  });
  handle("token", async (value: string) => {
    if (value.length > 1000) throw Error("Token is too long.");
    if (!value) {
      await fs.rm(store("masters-token.bin"), { force: true });
      preferences.tokenPresent = false;
      return;
    }
    if (
      !safeStorage.isEncryptionAvailable() ||
      (process.platform === "linux" &&
        safeStorage.getSelectedStorageBackend() === "basic_text")
    )
      throw Error("Secure credential storage is unavailable on this system.");
    await atomic(store("masters-token.bin"), safeStorage.encryptString(value));
    preferences.tokenPresent = true;
  });
  handle("logs", async () => {
    await fs.mkdir(store("logs"), { recursive: true });
    await shell.openPath(store("logs"));
  });
  handle(
    "analyze",
    async (
      value: unknown,
      kind: "book" | "engine" | "starter",
      indices: number[],
    ) => {
      if (
        !["book", "engine", "starter"].includes(kind) ||
        !Array.isArray(indices) ||
        indices.length > 3000 ||
        indices.some((i) => !Number.isInteger(i) || i < 0)
      )
        throw Error("Invalid analysis request.");
      const p = parseProject(value);
      analysis?.abort();
      const controller = new AbortController();
      analysis = controller;
      try {
        return await analyze(
          p,
          kind,
          indices,
          store("cache"),
          preferences.stockfish,
          await readToken(),
          controller.signal,
          (done, total) =>
            editor?.webContents.send("analysis-progress", { done, total }),
        );
      } finally {
        if (analysis === controller) analysis = null;
      }
    },
  );
  handle("cancelAnalysis", () => {
    analysis?.abort();
  });
  handle("export", async (value: unknown, options: ExportOptions) => {
    if (job) throw Error("An export is already running.");
    const p = parseProject(value);
    options = validateExport(p, options);
    const needed = requiredAssetIds(p, options);
    for (const a of p.assets) if (needed.has(a.id)) ensureAsset(a);
    const errors = productionChecks(p, options).filter(
      (i) => i.severity === "error",
    );
    if (errors.length) throw Error(errors.map((i) => i.message).join(" "));
    const r = await dialog.showSaveDialog(editor!, {
      defaultPath: p.title.replace(/[^a-z0-9 _-]/gi, "") + ".mp4",
      filters: [{ name: "MP4 video", extensions: ["mp4"] }],
    });
    if (r.canceled || !r.filePath) return false;
    const generation = ++exportGeneration;
    const progress = (v: ExportProgress) => {
      if (generation !== exportGeneration) return;
      if (v.phase === "Complete" && v.path) lastExportPath = v.path;
      editor?.webContents.send("export-progress", v);
    };
    job = new VideoJob(
      p,
      options,
      r.filePath,
      preferences.ffmpeg,
      preferences.encoder === "auto",
      progress,
    );
    const active = job;
    try {
      await active.start();
      const assets: Record<string, string> = {};
      for (const a of p.assets)
        if (a.kind !== "audio" && needed.has(a.id))
          assets[a.id] = await mediaUrl(a, false);
      if (job !== active) {
        await active.clean();
        return false;
      }
      worker = windowOf("export");
      const target = worker;
      const timer = setTimeout(() => {
        if (worker === target)
          void failExport(Error("Export renderer did not start."));
      }, 30000);
      const ready = (event: Electron.IpcMainEvent) => {
        if (event.sender !== target.webContents) return;
        clearTimeout(timer);
        ipcMain.removeListener("worker-ready", ready);
        target.webContents.send("export-task", { project: p, options, assets });
      };
      ipcMain.on("worker-ready", ready);
      target.once("closed", () => {
        clearTimeout(timer);
        ipcMain.removeListener("worker-ready", ready);
        if (worker === target && job === active)
          void failExport(Error("Export renderer closed unexpectedly."));
      });
      return true;
    } catch (e) {
      if (job === active) await failExport(e);
      else await active.clean();
      throw e;
    }
  });
  handle(
    "frame",
    async (bytes: Uint8Array, index: number) => {
      if (!job) throw Error("No export is active.");
      await job.frame(bytes, index);
    },
    "worker",
  );
  handle(
    "finish",
    async (error?: string) => {
      const active = job,
        target = worker;
      if (!active) return;
      try {
        await active.finish(error);
      } catch (e) {
        if (job === active) await failExport(e);
      } finally {
        if (job === active) job = null;
        setTimeout(() => {
          if (target && !target.isDestroyed()) target.destroy();
          if (worker === target) worker = null;
        }, 0);
      }
    },
    "worker",
  );
  handle("showExport", async () => {
    if (!lastExportPath)
      throw Error("Export a video before opening its output folder.");
    if (!(await fs.stat(lastExportPath).catch(() => null))?.isFile())
      throw Error("The exported file has been moved or deleted.");
    shell.showItemInFolder(lastExportPath);
  });
  handle("cancelExport", async () => {
    const target = worker,
      active = job;
    worker = null;
    job = null;
    target?.destroy();
    await active?.cancel();
  });
  handle("presentation", async () => {
    if (presentation && !presentation.isDestroyed()) {
      presentation.focus();
      return;
    }
    presentation = windowOf("presentation");
    presentation.webContents.once("did-finish-load", () => {
      if (lastState) presentation?.webContents.send("present-state", lastState);
    });
    presentation.webContents.on("before-input-event", (_e, input) => {
      if (input.type === "keyDown" && input.key === "F11")
        presentation?.setFullScreen(!presentation.isFullScreen());
      if (input.key === "Escape") presentation?.setFullScreen(false);
    });
    presentation.on("closed", () => {
      presentation = null;
    });
  });
  ipcMain.on("present", (event, value) => {
    if (event.sender !== editor?.webContents) return;
    lastState = { ...value, at: Date.now() };
    presentation?.webContents.send("present-state", lastState);
  });
});
app.on("window-all-closed", () => app.quit());
