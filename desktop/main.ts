import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  safeStorage,
  Menu,
} from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
  dataUrl,
  validAsset,
  readPack,
} from "./files";
import { analyze } from "./analysis";
import { VideoJob } from "./export";
import type { Settings, ExportOptions } from "../src/bridge";
const root = path.resolve(__dirname, "..");
let editor: BrowserWindow | null = null,
  presentation: BrowserWindow | null = null,
  worker: BrowserWindow | null = null,
  job: VideoJob | null = null,
  analysis: AbortController | null = null;
let pathProjectId: string | null = null;
let currentPath: string | null = null,
  lastProject: Project | null = null;
const allowed = new Map<string, string>();
let preferences: Settings = {
  ffmpeg: "",
  stockfish: "",
  encoder: "auto",
  tokenPresent: false,
};
let recoveryTimer: NodeJS.Timeout | undefined,
  recoveryWrite = Promise.resolve(),
  lastState: unknown = null;
let quitting = false;
if (process.env.STUDIO_USER_DATA)
  app.setPath("userData", process.env.STUDIO_USER_DATA);
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
  for (const a of p.assets) allowed.set(a.id, path.resolve(a.path));
}
function ensureAsset(a: Asset) {
  if (allowed.get(a.id) !== path.resolve(a.path))
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
async function recovery() {
  if (lastProject)
    await atomic(
      store("recovery.json"),
      JSON.stringify({
        project: lastProject,
        path: pathProjectId === lastProject.id ? currentPath : null,
      }),
    );
}
async function open(file: string) {
  const p = await readProject(file);
  permit(p);
  lastProject = p;
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
  let file = pathProjectId === p.id ? currentPath : null;
  if (as || !file) {
    const r = await dialog.showSaveDialog(editor!, {
      defaultPath: p.title.replace(/[^a-z0-9 _-]/gi, "") + ".castudio",
      filters: [{ name: "Chess Studio project", extensions: ["castudio"] }],
    });
    if (r.canceled || !r.filePath) return null;
    file = r.filePath;
  }
  await writeProject(file, p);
  currentPath = file;
  pathProjectId = p.id;
  lastProject = p;
  await remember(file);
  return file;
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
  worker?.destroy();
  worker = null;
  const active = job;
  job = null;
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
  const saved = (await json("settings.json", {})) as Partial<Settings>;
  preferences = {
    ...preferences,
    ...saved,
    ffmpeg: process.env.FFMPEG_PATH ?? saved.ffmpeg ?? "",
    stockfish: process.env.STOCKFISH_PATH ?? saved.stockfish ?? "",
    tokenPresent: !!(await readToken()),
  };
  Menu.setApplicationMenu(null);
  editor = windowOf("editor");
  void log(`Startup ${VERSION}; ${process.platform} ${process.arch}`);
  editor.on("close", (e) => {
    if (!quitting && lastProject) {
      e.preventDefault();
      quitting = true;
      clearTimeout(recoveryTimer);
      void recovery().finally(() => editor?.close());
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
    lastProject = p;
    currentPath = null;
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
  handle("autosave", async (value: unknown) => {
    const p = parseProject(value);
    checkAssets(p);
    lastProject = p;
    clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(() => {
      recoveryWrite = recoveryWrite
        .then(recovery)
        .catch((e) => log("Recovery write failed: " + e.message));
    }, 1400);
  });
  handle("recover", async () => {
    const r = (await json("recovery.json", null)) as {
      project: unknown;
      path: string | null;
    } | null;
    if (!r) return null;
    const project = parseProject(r.project);
    permit(project);
    lastProject = project;
    currentPath = r.path;
    pathProjectId = project.id;
    return { project, path: r.path };
  });
  handle("discardRecovery", async () => {
    await fs.rm(store("recovery.json"), { force: true });
  });
  handle("recent", () => json("recent.json", []));
  handle("chooseText", async (kind: string) => {
    if (!["pgn", "fen"].includes(kind)) throw Error("Invalid import type.");
    const f = await chooseFile([
      { name: kind.toUpperCase(), extensions: [kind, "txt"] },
    ]);
    if (!f) return null;
    if ((await fs.stat(f)).size > 2e6) throw Error("Text file exceeds 2 MB.");
    return fs.readFile(f, "utf8");
  });
  handle("importAsset", async (kind: "audio" | "image") => {
    if (!["audio", "image"].includes(kind)) throw Error("Invalid asset type.");
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
  });
  handle("assetData", async (a: Asset) => {
    ensureAsset(a);
    try {
      return await dataUrl(a);
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
    async (value: unknown, kind: "book" | "engine", indices: number[]) => {
      if (
        !["book", "engine"].includes(kind) ||
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
    checkAssets(p);
    if (
      !formats.includes(options.format) ||
      !Number.isFinite(options.start) ||
      !Number.isFinite(options.end)
    )
      throw Error("Invalid export settings.");
    if (
      (options.width || options.height || options.fps) &&
      !process.env.STUDIO_TEST
    )
      throw Error("Custom dimensions are only available in validation mode.");
    const r = await dialog.showSaveDialog(editor!, {
      defaultPath: p.title.replace(/[^a-z0-9 _-]/gi, "") + ".mp4",
      filters: [{ name: "MP4 video", extensions: ["mp4"] }],
    });
    if (r.canceled || !r.filePath) return false;
    const progress = (v: unknown) =>
      editor?.webContents.send("export-progress", v);
    job = new VideoJob(
      p,
      options,
      r.filePath,
      preferences.ffmpeg,
      preferences.encoder === "auto",
      progress,
    );
    try {
      await job.start();
      const assets: Record<string, string> = {};
      for (const a of p.assets)
        if (a.kind === "image") assets[a.id] = await dataUrl(a);
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
      return true;
    } catch (e) {
      await failExport(e);
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
        await failExport(e);
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
  handle("cancelExport", async () => {
    worker?.destroy();
    worker = null;
    const active = job;
    job = null;
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
