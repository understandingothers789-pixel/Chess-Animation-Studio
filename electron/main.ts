import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  net,
  safeStorage,
  Menu,
} from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_VERSION,
  parseProject,
  type Asset,
  type Project,
} from "../src/core/model";
import { buildGame } from "../src/core/chess";
import {
  atomicWrite,
  readProject,
  relativeAssets,
  dataForAsset,
  collectProject,
  readBadgePack,
  resolveAsset,
} from "./files";
import { AnalysisService } from "./analysis";
import { VideoExport } from "./export";
import type { ExportOptions, Settings } from "../src/bridge";

let editor: BrowserWindow | null = null,
  presentation: BrowserWindow | null = null,
  worker: BrowserWindow | null = null;
let job: VideoExport | null = null,
  analysis: AnalysisService;
let lastPresentation: unknown = null,
  closing = false,
  exportStarting = false;
let editing: { project: unknown; path: string | null; dirty: boolean } | null =
  null;
let config: { ffmpeg: string; stockfish: string; recent: string[] } = {
  ffmpeg: "ffmpeg",
  stockfish:
    process.platform === "linux" &&
    require("node:fs").existsSync("/usr/games/stockfish")
      ? "/usr/games/stockfish"
      : "stockfish",
  recent: [],
};
let base = "",
  logFile = "",
  tokenFile = "";
const approvedProjects = new Set<string>(),
  approvedAssets = new Set<string>();
function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
let logQueue = Promise.resolve();
function log(event: string, message = "") {
  // Never pass URLs with query strings, token contents, or complete project data here.
  const line = `${new Date().toISOString()} ${event.slice(0, 80)} ${message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 3000)}\n`;
  logQueue = logQueue.then(async () => {
    try {
      const s = await fs.stat(logFile).catch(() => null);
      if (s && s.size > 1_000_000) {
        await fs.rm(logFile + ".2", { force: true });
        await fs.rename(logFile + ".1", logFile + ".2").catch(() => {});
        await fs.rename(logFile, logFile + ".1");
      }
      await fs.appendFile(logFile, line);
    } catch {}
  });
}
function trusted(
  event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
  role: "editor" | "worker" = "editor",
) {
  if (event.sender !== (role === "editor" ? editor : worker)?.webContents)
    throw new Error("This action is not available in this window.");
}
function handle(
  name: string,
  fn: (...args: any[]) => unknown,
  role: "editor" | "worker" = "editor",
) {
  ipcMain.handle(name, async (event, ...args) => {
    trusted(event, role);
    try {
      return await fn(...args);
    } catch (e) {
      if (!name.includes("configure")) log(name, errorMessage(e));
      throw new Error(errorMessage(e));
    }
  });
}
async function settings(): Promise<Settings> {
  return {
    ...config,
    hasToken: await fs.access(tokenFile).then(
      () => true,
      () => false,
    ),
    recovery: await fs.access(path.join(base, "recovery.json")).then(
      () => true,
      () => false,
    ),
  };
}
async function saveConfig() {
  await atomicWrite(path.join(base, "settings.json"), JSON.stringify(config));
}
async function recent(file: string) {
  config.recent = [file, ...config.recent.filter((p) => p !== file)].slice(
    0,
    10,
  );
  await saveConfig();
}
async function localToken() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return undefined;
    return safeStorage.decryptString(await fs.readFile(tokenFile));
  } catch {
    return undefined;
  }
}
function createWindow(mode: "editor" | "presentation" | "export") {
  const win = new BrowserWindow({
    title:
      mode === "presentation"
        ? "Chess Animation Studio · Presentation"
        : "Chess Animation Studio",
    icon: path.join(__dirname, "../build/icon.png"),
    width: mode === "editor" ? 1600 : 1280,
    height: mode === "editor" ? 1000 : 720,
    minWidth: mode === "editor" ? 1100 : 300,
    minHeight: mode === "editor" ? 720 : 300,
    backgroundColor: "#101719",
    show: mode !== "export",
    frame: mode !== "presentation",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.webContents.on("render-process-gone", (_e, d) => {
    log("renderer-failure", d.reason);
    if (mode === "export") void cancelExport();
  });
  const query = mode === "editor" ? "" : `?mode=${mode}`;
  if (process.env.STUDIO_DEV_URL)
    void win.loadURL(process.env.STUDIO_DEV_URL + query);
  else
    void win.loadFile(path.join(__dirname, "../dist/index.html"), {
      query: mode === "editor" ? {} : { mode },
    });
  if (mode === "presentation")
    win.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") {
        win.setFullScreen(false);
        event.preventDefault();
      }
      if (input.type === "keyDown" && input.key === "F11") {
        win.setFullScreen(!win.isFullScreen());
        event.preventDefault();
      }
    });
  return win;
}
async function pickAsset(
  kind: Asset["kind"],
  previous?: Asset,
): Promise<Asset | null> {
  const r = await dialog.showOpenDialog(editor!, {
    title: previous ? `Relink ${previous.name}` : "Import local asset",
    properties: ["openFile"],
    filters: [
      {
        name: kind === "audio" ? "Audio" : "Images",
        extensions:
          kind === "audio"
            ? ["wav", "mp3", "ogg", "m4a", "flac"]
            : ["png", "webp", "jpg", "jpeg"],
      },
    ],
  });
  if (r.canceled) return null;
  const file = r.filePaths[0];
  approvedAssets.add(file);
  return {
    ...previous,
    id: previous?.id ?? crypto.randomUUID(),
    kind,
    name: previous?.name ?? path.basename(file),
    path: file,
    source: previous?.source ?? "Local import",
    guidance: previous?.guidance ?? "Verify your rights before publishing.",
  };
}
async function allowProjectAssets(p: Project, file: string | null) {
  for (const a of p.assets)
    approvedAssets.add(
      path.resolve(file ? path.dirname(file) : process.cwd(), a.path),
    );
}
async function cancelExport() {
  const current = job;
  const cancelledWorker = worker;
  job = null;
  worker = null;
  cancelledWorker?.destroy();
  await current?.cancel();
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  closing = true;
  analysis?.cancel();
  void job?.cancel();
});
app.whenReady().then(async () => {
  if (process.env.STUDIO_TEST_DATA)
    app.setPath("userData", process.env.STUDIO_TEST_DATA);
  base = app.getPath("userData");
  await fs.mkdir(base, { recursive: true });
  logFile = path.join(base, "activity.log");
  tokenFile = path.join(base, "masters.token");
  try {
    const stored = JSON.parse(
      await fs.readFile(path.join(base, "settings.json"), "utf8"),
    );
    for (const key of ["ffmpeg", "stockfish"] as const)
      if (typeof stored[key] === "string") config[key] = stored[key];
    if (Array.isArray(stored.recent))
      config.recent = stored.recent
        .filter((p: unknown) => typeof p === "string")
        .slice(0, 10);
  } catch {}
  log("startup", `Chess Animation Studio ${APP_VERSION} ${process.platform}`);
  Menu.setApplicationMenu(null);
  analysis = new AnalysisService(
    path.join(base, "analysis-cache"),
    (url, token, signal) =>
      net.fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      }),
  );
  handle("settings", settings);
  handle("configure", async (key: string, value?: string) => {
    if (key === "token") {
      if (value === "") {
        await fs.rm(tokenFile, { force: true });
      } else if (value) {
        if (
          !safeStorage.isEncryptionAvailable() ||
          (process.platform === "linux" &&
            safeStorage.getSelectedStorageBackend() === "basic_text")
        )
          throw new Error(
            "Secure operating-system storage is unavailable. Token was not stored.",
          );
        await atomicWrite(tokenFile, safeStorage.encryptString(value.trim()));
      }
    } else if (key === "ffmpeg" || key === "stockfish") {
      const r = await dialog.showOpenDialog(editor!, {
        title: `Choose ${key} executable`,
        properties: ["openFile"],
      });
      if (!r.canceled) config[key] = r.filePaths[0];
      await saveConfig();
    } else throw new Error("Unknown setting.");
    return settings();
  });
  handle("project:read", async (file?: string, recovery = false) => {
    if (recovery) {
      const r = JSON.parse(
        await fs.readFile(path.join(base, "recovery.json"), "utf8"),
      );
      const project = parseProject(r.project);
      buildGame(project);
      if (r.path) approvedProjects.add(r.path);
      await allowProjectAssets(project, r.path);
      for (const a of project.assets) a.path = resolveAsset(a, r.path);
      return { project, path: r.path };
    }
    const template = file === "__sample__";
    if (template) {
      file = path.join(
        app.getAppPath().replace(/app\.asar$/, "app.asar.unpacked"),
        "samples",
        "Opera-Game.castudio",
      );
      approvedProjects.add(file);
    }
    if (file && !config.recent.includes(file) && !approvedProjects.has(file))
      throw new Error("Open this project through the file chooser.");
    if (!file) {
      const r = await dialog.showOpenDialog(editor!, {
        properties: ["openFile"],
        filters: [{ name: "Studio project", extensions: ["castudio", "json"] }],
      });
      if (r.canceled) return null;
      file = r.filePaths[0];
    }
    const project = await readProject(file);
    approvedProjects.add(file);
    await allowProjectAssets(project, file);
    for (const a of project.assets) a.path = resolveAsset(a, file);
    if (!template) await recent(file);
    log("project-open", path.basename(file));
    return { project, path: template ? null : file };
  });
  handle(
    "project:save",
    async (value: unknown, file: string | null, saveAs = false) => {
      const p = parseProject(value);
      buildGame(p);
      let dest = file;
      if (!dest || saveAs) {
        const r = await dialog.showSaveDialog(editor!, {
          defaultPath:
            (p.title.replace(/[<>:"/\\|?*]/g, "_") || "Project") + ".castudio",
          filters: [{ name: "Studio project", extensions: ["castudio"] }],
          properties: ["showOverwriteConfirmation", "createDirectory"],
        });
        if (r.canceled || !r.filePath) return null;
        dest = r.filePath;
        approvedProjects.add(dest);
      }
      if (!approvedProjects.has(dest))
        throw new Error("Choose a project destination with Save As.");
      const copy = relativeAssets(p, file, dest);
      await atomicWrite(dest, JSON.stringify(copy, null, 2));
      await recent(dest);
      log("project-save", path.basename(dest));
      return dest;
    },
  );
  handle("project:autosave", async (value: unknown, file: string | null) => {
    const project = parseProject(value);
    await atomicWrite(
      path.join(base, "recovery.json"),
      JSON.stringify({ project, path: file, at: new Date().toISOString() }),
    );
  });
  handle("project:discard-recovery", () =>
    fs.rm(path.join(base, "recovery.json"), { force: true }),
  );
  handle("project:confirm-discard", async () => {
    const r = await dialog.showMessageBox(editor!, {
      type: "question",
      buttons: ["Keep editing", "Discard changes"],
      defaultId: 0,
      cancelId: 0,
      message: "Discard unsaved changes?",
      detail: "Save your project first if you want to keep these edits.",
    });
    return r.response === 1;
  });
  handle("import:text", async () => {
    const r = await dialog.showOpenDialog(editor!, {
      properties: ["openFile"],
      filters: [
        { name: "Chess game or position", extensions: ["pgn", "fen", "txt"] },
      ],
    });
    if (r.canceled) return null;
    const file = r.filePaths[0];
    const stat = await fs.stat(file);
    if (stat.size > 2_000_000) throw new Error("PGN/FEN exceeds 2 MB.");
    return { text: await fs.readFile(file, "utf8"), name: path.basename(file) };
  });
  handle("asset:pick", pickAsset);
  handle("asset:badge-pack", async () => {
    const r = await dialog.showOpenDialog(editor!, {
      title: "Import local badge pack manifest",
      properties: ["openFile"],
      filters: [{ name: "Badge pack manifest", extensions: ["json"] }],
    });
    if (r.canceled) return null;
    const result = await readBadgePack(r.filePaths[0]);
    for (const a of result.assets) approvedAssets.add(a.path);
    return result;
  });
  handle("asset:relink", (a: Asset) => pickAsset(a.kind, a));
  handle("asset:data", async (a: Asset, file: string | null) => {
    const resolved = path.resolve(
      file ? path.dirname(file) : process.cwd(),
      a.path,
    );
    if (!approvedAssets.has(resolved))
      throw new Error("Asset access was not granted. Relink this asset.");
    return dataForAsset(a, file);
  });
  handle("asset:status", async (assets: Asset[], file: string | null) => {
    const result: Record<string, string | null> = {};
    for (const a of assets.slice(0, 500)) {
      const resolved = resolveAsset(a, file);
      if (!approvedAssets.has(resolved)) {
        result[a.id] = null;
        continue;
      }
      const s = await fs.stat(resolved).catch(() => null);
      result[a.id] = s ? `${s.size}:${s.mtimeMs}` : null;
    }
    return result;
  });
  handle("asset:collect", async (value: unknown, file: string | null) => {
    const p = parseProject(value);
    const r = await dialog.showOpenDialog(editor!, {
      title: "Choose an empty portable-project folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (r.canceled) return null;
    const result = await collectProject(p, file, r.filePaths[0]);
    approvedProjects.add(result.path);
    await allowProjectAssets(result.project, result.path);
    await recent(result.path);
    return result;
  });
  handle(
    "analysis:start",
    async (value: unknown, mode: "book" | "engine" | "both", ids: string[]) => {
      if (!["book", "engine", "both"].includes(mode))
        throw new Error("Invalid analysis mode.");
      const p = parseProject(value);
      log("analysis-start", mode);
      await analysis.run(
        p,
        mode,
        ids,
        config.stockfish,
        await localToken(),
        (progress) => editor?.webContents.send("analysis:progress", progress),
      );
      log("analysis-finished", mode);
    },
  );
  handle("analysis:cancel", () => analysis.cancel());
  handle("presentation:open", () => {
    if (!presentation) {
      presentation = createWindow("presentation");
      presentation.webContents.on("did-finish-load", () => {
        if (lastPresentation)
          presentation?.webContents.send(
            "presentation:state",
            lastPresentation,
          );
      });
      presentation.on("closed", () => (presentation = null));
    }
    presentation.focus();
  });
  ipcMain.on("presentation:state", (event, state) => {
    trusted(event);
    lastPresentation = state;
    presentation?.webContents.send("presentation:state", state);
  });
  handle(
    "export:start",
    async (
      value: unknown,
      projectPath: string | null,
      options: ExportOptions,
    ) => {
      if (job || exportStarting)
        throw new Error("An export is already running.");
      exportStarting = true;
      try {
        const p = parseProject(value);
        buildGame(p);
        if (!DIMENSIONS_CHECK(options.format))
          throw new Error("Invalid output format.");
        let dest: string | undefined = process.env.STUDIO_TEST_DATA
          ? options.path
          : undefined;
        if (!dest) {
          const r = await dialog.showSaveDialog(editor!, {
            defaultPath: `${p.title.replace(/[<>:"/\\|?*]/g, "_")}-${options.format}.mp4`,
            filters: [{ name: "MP4 video", extensions: ["mp4"] }],
            properties: ["showOverwriteConfirmation", "createDirectory"],
          });
          if (r.canceled || !r.filePath) {
            editor?.webContents.send("export:progress", {
              phase: "cancelled",
              done: 0,
              total: 1,
              message: "No output file selected.",
            });
            return;
          }
          dest = r.filePath;
        }
        if (!dest.toLowerCase().endsWith(".mp4")) dest += ".mp4";
        job = new VideoExport(
          p,
          projectPath,
          options,
          config.ffmpeg,
          dest,
          (progress) => {
            editor?.webContents.send("export:progress", progress);
            if (["complete", "cancelled", "error"].includes(progress.phase))
              log("export-" + progress.phase, progress.message);
          },
        );
        await job.initialize();
        log(
          "export-start",
          `${options.format} ${job.width}x${job.height} ${job.fps}fps ${job.encoder}`,
        );
        const assets: Record<string, string> = {};
        for (const a of p.assets.filter((a) => a.kind !== "audio"))
          assets[a.id] = (await dataForAsset(a, projectPath)).data;
        worker = createWindow("export");
        worker.webContents.once("did-finish-load", () =>
          worker?.webContents.send("export:task", {
            project: p,
            options: {
              ...options,
              width: job!.width,
              height: job!.height,
              fps: job!.fps,
              start: job!.start,
              end: job!.end,
            },
            assets,
          }),
        );
      } catch (e) {
        await cancelExport();
        throw e;
      } finally {
        exportStarting = false;
      }
    },
  );
  handle(
    "export:frame",
    async (bytes: Uint8Array, index: number) => {
      if (!job) throw new Error("Export is not active.");
      await job.frame(bytes, index);
    },
    "worker",
  );
  handle(
    "export:finish",
    async (error?: string) => {
      const current = job;
      try {
        if (error) {
          await current?.cancel();
          editor?.webContents.send("export:progress", {
            phase: "error",
            done: 0,
            total: 1,
            message: error,
          });
        } else await current?.finish();
      } finally {
        job = null;
        const completedWorker = worker;
        worker = null;
        setTimeout(() => completedWorker?.destroy(), 50);
      }
    },
    "worker",
  );
  handle("export:cancel", cancelExport);
  handle("logs:open", async () => {
    await logQueue;
    await shell.openPath(base);
  });
  ipcMain.on("log", (event, name, message) => {
    trusted(event);
    if (
      ["renderer-error", "import-error", "asset-error", "audio-error"].includes(
        name,
      )
    )
      log(name, String(message));
  });
  ipcMain.on("editing:state", (event, project, file, dirty) => {
    trusted(event);
    editing = { project, path: file, dirty: !!dirty };
  });
  editor = createWindow("editor");
  editor.on("close", (event) => {
    if (!closing && editing?.dirty) {
      event.preventDefault();
      const state = editing;
      void (async () => {
        try {
          const project = parseProject(state.project);
          await atomicWrite(
            path.join(base, "recovery.json"),
            JSON.stringify({
              project,
              path: state.path,
              at: new Date().toISOString(),
            }),
          );
          const r = await dialog.showMessageBox(editor!, {
            type: "question",
            buttons: ["Keep editing", "Quit (autosave retained)"],
            defaultId: 0,
            cancelId: 0,
            message: "Quit with unsaved changes?",
            detail:
              "Your current edits have been retained in the local recovery file.",
          });
          if (r.response === 1) {
            closing = true;
            editor?.close();
          }
        } catch (e) {
          await dialog.showMessageBox(editor!, {
            type: "error",
            message:
              "Recovery could not be written. Save your project before quitting.",
            detail: errorMessage(e),
          });
        }
      })();
    }
  });
});
function DIMENSIONS_CHECK(f: string) {
  return ["landscape", "vertical", "square", "square-in-vertical"].includes(f);
}
