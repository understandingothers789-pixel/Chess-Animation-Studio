import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Save,
  FolderOpen,
  Plus,
  Undo2,
  Redo2,
  MonitorPlay,
  Download,
  ChevronsLeft,
  CheckCircle2,
  X,
  FileBox,
  Music2,
  SlidersHorizontal,
  Sparkles,
  Settings2,
  BookOpen,
} from "lucide-react";
import {
  APP_VERSION,
  FORMATS,
  DIMENSIONS,
  blankProject,
  effectPreset,
  uid,
  type Project,
  type Effect,
  type Preset,
  type Asset,
} from "../core/model";
import {
  sampleProject,
  importPgn,
  importFen,
  appendMove,
  setLine,
} from "../core/chess";
import { duration, segments, clamp } from "../core/timeline";
import { alignLandings, correctBeat } from "../core/audio";
import type { ExportProgress, Settings } from "../bridge";
import { useProject, type Edit } from "./useProject";
import { AudioEngine } from "./AudioEngine";
import { Preview } from "./Preview";
import { Timeline } from "./Timeline";
import { Inspector } from "./Inspector";
import {
  GamePanel,
  PresetsPanel,
  MusicPanel,
  DesignPanel,
  AnalysisPanel,
  SettingsPanel,
} from "./Panels";
import { Select, Range, timeLabel } from "./controls";

type LibraryTab =
  "game" | "styles" | "music" | "design" | "analysis" | "settings";
export function App() {
  const initial = useMemo(() => sampleProject(), []),
    store = useProject(initial),
    { project, replace, undo, redo } = store;
  const [path, setPath] = useState<string | null>(null),
    [saved, setSaved] = useState(JSON.stringify(initial));
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [selected, setSelected] = useState(0),
    [checked, setChecked] = useState(new Set<string>());
  const [tab, setTab] = useState<LibraryTab>("game"),
    [status, setStatus] = useState(
      "Ready · select a move to shape its animation",
    ),
    [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null),
    [recovery, setRecovery] = useState(false),
    [images, setImages] = useState<Record<string, string>>({});
  const [assetLoading, setAssetLoading] = useState(false),
    playOrigin = useRef({ wall: 0, time: 0 });
  const [copy, setCopy] = useState<Effect | null>(null),
    [promotion, setPromotion] = useState("q"),
    [from, setFrom] = useState<string | null>(null);
  const [analysisBusy, setAnalysisBusy] = useState(false),
    [analysisProgress, setAnalysisProgress] = useState("");
  const [exportOpen, setExportOpen] = useState(false),
    [exportProgress, setExportProgress] = useState<ExportProgress | null>(null),
    [exportBusy, setExportBusy] = useState(false),
    [encoder, setEncoder] = useState<"auto" | "software">("auto");
  const [arrangement, setArrangement] = useState<{
    project: Project;
    changed: number;
    skipped: number;
  } | null>(null);
  const audio = useRef<AudioEngine | null>(null),
    pRef = useRef(project),
    pathRef = useRef(path),
    analysisProject = useRef<string | null>(null),
    loaded = useRef(new Map<string, string>()),
    assetGeneration = useRef(0),
    analysisWorker = useRef<Worker | null>(null),
    importWorker = useRef<Worker | null>(null);
  const displayed = arrangement?.project ?? project,
    total = duration(displayed),
    segs = useMemo(() => segments(displayed), [displayed]),
    dirty = JSON.stringify(project) !== saved;
  pRef.current = project;
  pathRef.current = path;
  const failure = useCallback((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    setError(message);
    setStatus("Action needs attention");
  }, []);
  const notify = useCallback((s: string) => {
    setStatus(s);
    setError("");
  }, []);
  const edit: Edit = useCallback(
    (label, update) => {
      setPlaying(false);
      audio.current?.stop();
      setArrangement(null);
      store.edit(label, update);
    },
    [store.edit],
  );
  const refreshSettings = useCallback(
    () =>
      window.studio
        .settings()
        .then((s) => {
          setSettings(s);
          return s;
        })
        .catch(failure),
    [failure],
  );
  const seek = useCallback((t: number) => {
    audio.current?.stop();
    setPlaying(false);
    const bounded = clamp(t, 0, duration(pRef.current));
    setTime(bounded);
    const i = segments(pRef.current).findIndex((s) => bounded < s.end);
    setSelected(i < 0 ? pRef.current.moves.length - 1 : Math.max(0, i));
    setFrom(null);
  }, []);
  const select = useCallback((i: number) => {
    const p = pRef.current,
      s = segments(p)[i];
    if (!s) return;
    audio.current?.stop();
    setPlaying(false);
    setSelected(i);
    setTime(s.departure + p.moves[i].effect.duration * 0.42);
    setFrom(null);
  }, []);
  const pause = () => {
    setPlaying(false);
    audio.current?.stop();
  };
  const togglePlay = async () => {
    if (playing) {
      pause();
      return;
    }
    if (assetLoading) return;
    const start = time >= total - 0.01 ? 0 : time;
    setTime(start);
    try {
      const wall = await audio.current?.play(displayed, start);
      playOrigin.current = { time: start, wall: wall ?? performance.now() };
      setPlaying(true);
    } catch (e) {
      failure(e);
    }
  };

  useEffect(() => {
    audio.current = new AudioEngine();
    void refreshSettings().then((s) => {
      if (s) setRecovery(s.recovery);
    });
    const unsubExport = window.studio.onExport((p) => {
      setExportProgress(p);
      if (["complete", "cancelled", "error"].includes(p.phase)) {
        setExportBusy(false);
        if (p.phase === "error") setError(p.message);
        else notify(p.message);
      }
    });
    const unsubAnalysis = window.studio.onAnalysis((s) => {
      if (analysisProject.current !== pRef.current.id) return;
      store.edit("Analysis results", (p) => {
        const move = p.moves.find((m) => m.id === s.moveId);
        if (move) move.analysis = { ...move.analysis, ...s.analysis };
      });
      setAnalysisProgress(`${s.index} / ${s.total} moves analyzed`);
    });
    return () => {
      unsubExport();
      unsubAnalysis();
      audio.current?.stop();
      void audio.current?.context.close();
      analysisWorker.current?.terminate();
      importWorker.current?.terminate();
    };
  }, []);
  useEffect(() => {
    setTime((t) => Math.min(t, duration(project)));
    if (selected >= project.moves.length) setSelected(project.moves.length - 1);
  }, [project]);
  useEffect(() => {
    if (!playing) return;
    const { wall: start, time: startTime } = playOrigin.current;
    let frame = 0;
    const tick = (now: number) => {
      const at = Math.min(total, startTime + Math.max(0, (now - start) / 1000));
      setTime(at);
      const i = segs.findIndex((s) => at < s.end);
      setSelected(i < 0 ? displayed.moves.length - 1 : i);
      if (at >= total) {
        setPlaying(false);
        audio.current?.stop();
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, displayed]);
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(() => {
      void window.studio.autosave(project, path).catch(failure);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [project, path, dirty]);
  useEffect(() => {
    window.studio.editingState(project, path, dirty);
  }, [project, path, dirty]);
  const refreshAssets = useCallback(async (force = false) => {
    const generation = ++assetGeneration.current,
      p = pRef.current,
      file = pathRef.current;
    setAssetLoading(
      p.assets.some(
        (a) => force || loaded.current.get(a.id) !== `${a.path}|${file}`,
      ),
    );
    for (const a of p.assets) {
      const key = `${a.path}|${file}`;
      if (!force && loaded.current.get(a.id) === key) continue;
      try {
        const { data } = await window.studio.assetData(a, file);
        if (generation !== assetGeneration.current) return;
        if (a.kind === "audio") await audio.current!.load(a, data);
        else setImages((images) => ({ ...images, [a.id]: data }));
        loaded.current.set(a.id, key);
      } catch (e) {
        loaded.current.delete(a.id);
        audio.current?.remove(a.id);
        setImages((images) => {
          const copy = { ...images };
          delete copy[a.id];
          return copy;
        });
        window.studio.log(
          "asset-error",
          `Missing or unreadable asset: ${a.name}`,
        );
        setError(`${a.name}: ${(e as Error).message}. Relink in Settings.`);
      }
    }
    const ids = new Set(p.assets.map((a) => a.id));
    for (const id of loaded.current.keys())
      if (!ids.has(id)) {
        loaded.current.delete(id);
        audio.current?.remove(id);
        setImages((images) => {
          const copy = { ...images };
          delete copy[id];
          return copy;
        });
      }
    if (generation === assetGeneration.current) setAssetLoading(false);
  }, []);
  const assetSignature = project.assets
    .map((a) => `${a.id}:${a.path}`)
    .join("|");
  useEffect(() => {
    void refreshAssets();
  }, [assetSignature, path]);
  useEffect(() => {
    const fingerprints = new Map<string, string | null>();
    let busy = false;
    const check = async () => {
      if (busy) return;
      busy = true;
      try {
        const p = pRef.current,
          result = await window.studio.assetStatus(p.assets, pathRef.current);
        let changed = false;
        for (const [id, value] of Object.entries(result)) {
          if (value === null) {
            if (loaded.current.has(id)) {
              loaded.current.delete(id);
              audio.current?.stop();
              audio.current?.remove(id);
              setPlaying(false);
              setImages((images) => {
                const next = { ...images };
                delete next[id];
                return next;
              });
              setError("An asset was moved or deleted. Relink it in Settings.");
            }
          } else if (fingerprints.has(id) && fingerprints.get(id) !== value) {
            loaded.current.delete(id);
            changed = true;
          }
          fingerprints.set(id, value);
        }
        if (changed) await refreshAssets();
      } catch {
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 4000);
    return () => clearInterval(timer);
  }, [assetSignature, path]);
  const lastBroadcast = useRef(0);
  useEffect(() => {
    if (!playing || performance.now() - lastBroadcast.current > 120) {
      window.studio.presentationState({
        project: displayed,
        time,
        playing,
        assets: images,
      });
      lastBroadcast.current = performance.now();
    }
  }, [displayed, time, playing, images]);
  const confirmLoss = async () =>
    !dirty || (await window.studio.confirmDiscard());
  const load = async (file?: string, recover = false) => {
    try {
      if (!(await confirmLoss())) return;
      pause();
      analysisProject.current = null;
      await window.studio.cancelAnalysis();
      const result = await window.studio.readProject(file, recover);
      if (!result) return;
      replace(result.project);
      setPath(result.path);
      setSaved(recover ? "" : JSON.stringify(result.project));
      setTime(0);
      setSelected(result.project.moves.length ? 0 : -1);
      setChecked(new Set());
      setArrangement(null);
      loaded.current.clear();
      setImages({});
      setRecovery(false);
      notify(
        recover
          ? "Autosave recovered. Save it to keep these edits."
          : `Opened ${result.project.title}`,
      );
      void refreshSettings();
    } catch (e) {
      failure(e);
    }
  };
  const newProject = async () => {
    if (!(await confirmLoss())) return;
    pause();
    const p = blankProject();
    replace(p);
    setSaved(JSON.stringify(p));
    setPath(null);
    setSelected(-1);
    setTime(0);
    setImages({});
    loaded.current.clear();
    setChecked(new Set());
    notify("New project · enter moves or import PGN");
  };
  const save = async (saveAs = false) => {
    try {
      const file = await window.studio.saveProject(project, path, saveAs);
      if (file) {
        setPath(file);
        setSaved(JSON.stringify(project));
        await window.studio.discardRecovery();
        setRecovery(false);
        notify("Project saved safely.");
        void refreshSettings();
      }
    } catch (e) {
      failure(e);
    }
  };
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        pause();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === "ArrowRight")
        select(Math.min(project.moves.length - 1, selected + 1));
      if (e.key === "ArrowLeft") select(Math.max(0, selected - 1));
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [playing, time, project, path, selected]);
  const importGame = (text: string, fen: boolean, policy = "match") => {
    pause();
    const source = pRef.current;
    importWorker.current?.terminate();
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url), {
      type: "module",
    });
    importWorker.current = worker;
    notify("Validating chess input in a background worker…");
    worker.onmessage = (
      event: MessageEvent<{
        project?: Project;
        matched?: number;
        error?: string;
      }>,
    ) => {
      worker.terminate();
      if (event.data.error) {
        failure(new Error(event.data.error));
        window.studio.log("import-error", event.data.error);
        return;
      }
      if (pRef.current !== source) {
        failure(
          new Error(
            "The project changed during import. Load the input again to preserve the latest edits.",
          ),
        );
        return;
      }
      const next = event.data.project!;
      edit("Import chess", (p) => Object.assign(p, next));
      setTime(0);
      setSelected(next.moves.length ? 0 : -1);
      setChecked(new Set());
      notify(
        `${fen ? "Position" : "Selected main line"} loaded · ${event.data.matched} matching moves preserved. Other effects ${policy === "ply" ? "reassigned by number" : "use defaults"}. Undo restores the previous game.`,
      );
    };
    worker.onerror = () => {
      failure(new Error("Chess input could not be processed."));
      worker.terminate();
    };
    worker.postMessage({ project: source, text, fen, policy });
  };
  const importFile = async () => {
    try {
      const r = await window.studio.importText();
      if (r)
        importGame(
          r.text,
          /\.fen$/i.test(r.name) ||
            (!r.text.includes("[") && r.text.trim().split("/").length === 8),
        );
    } catch (e) {
      failure(e);
    }
  };
  const applyPreset = (preset: Preset, scope = "selected") => {
    let count = 0;
    edit("Apply move style", (p) => {
      p.defaults = effectPreset(preset);
      for (let i = 0; i < p.moves.length; i++)
        if (
          scope === "all" ||
          (scope === "checked" && checked.has(p.moves[i].id)) ||
          (scope === "selected" && i === selected)
        ) {
          const old = p.moves[i].effect;
          p.moves[i].effect = {
            ...effectPreset(preset),
            badge: old.badge,
            cameras: old.cameras,
            locked: old.locked,
          };
          count++;
        }
    });
    if (selected >= 0) select(selected);
    notify(`Style applied to ${count} move${count !== 1 ? "s" : ""}.`);
  };
  const addBeat = (at: number) =>
    edit("Add beat", (p) => {
      p.beats.push({ id: uid(), time: at, strong: false, selected: true });
      p.beats.sort((a, b) => a.time - b.time);
    });
  const attachBeat = (id: string) => {
    const b = project.beats.find((b) => b.id === id),
      s = segments(project)[selected];
    if (!b || !s) return;
    const e = project.moves[selected].effect,
      available = b.time - s.start;
    if (available < 0.15 * e.landing || available > 30 + 8 * e.landing) {
      failure(
        new Error(
          "This beat cannot be reached within this move’s timing limits. Choose a nearby later beat.",
        ),
      );
      return;
    }
    edit("Anchor landing beat", (p) => {
      const e = p.moves[selected].effect;
      e.duration = clamp(available / e.landing, 0.15, 8);
      e.delay = Math.max(0, available - e.duration * e.landing);
      e.landingBeat = id;
    });
    notify(`Landing aligned to ${timeLabel(b.time)}.`);
  };
  const importAudio = async (role: "music" | "sound") => {
    try {
      const asset = await window.studio.pickAsset("audio");
      if (!asset) return;
      const { data } = await window.studio.assetData(asset, path);
      notify("Decoding local audio…");
      const buffer = await audio.current!.load(asset, data);
      if (role === "sound") {
        edit("Import sound", (p) => {
          p.assets.push(asset);
        });
        notify("Sound added to the local library.");
        return;
      }
      if (buffer.duration > 3600)
        throw new Error("Trim music to one hour or less before importing.");
      notify("Finding transients in a background worker…");
      analysisWorker.current?.terminate();
      const worker = new Worker(new URL("./audio.worker.ts", import.meta.url), {
        type: "module",
      });
      analysisWorker.current = worker;
      // Chromium decodes off-thread; analyze a first-channel copy in the worker.
      const samples = buffer.getChannelData(0).slice(),
        projectId = project.id;
      worker.onmessage = (event) => {
        if (pRef.current.id !== projectId) {
          worker.terminate();
          return;
        }
        const { waveform, beats } = event.data;
        edit("Import music & beats", (p) => {
          p.assets.push(asset);
          p.music = {
            assetId: asset.id,
            offset: 0,
            trimStart: 0,
            trimEnd: buffer.duration,
            volume: 0.7,
            muted: false,
            fadeIn: 0.5,
            fadeOut: 0.8,
            duration: buffer.duration,
            waveform,
          };
          p.beats = beats.map((b: Project["beats"][number]) => ({
            ...b,
            sourceTime: b.time,
            assetId: asset.id,
          }));
        });
        notify(
          `Music imported · ${beats.length} likely beats. Correct markers in Music.`,
        );
        worker.terminate();
      };
      worker.onerror = () => {
        failure(new Error("Audio analysis failed. Try a shorter WAV file."));
        worker.terminate();
      };
      worker.postMessage({ samples, sampleRate: buffer.sampleRate }, [
        samples.buffer,
      ]);
    } catch (e) {
      failure(e);
      window.studio.log("audio-error", (e as Error).message);
    }
  };
  const importImage = async (badge?: string) => {
    try {
      const a = await window.studio.pickAsset(badge ? "badge" : "image");
      if (a)
        edit("Import image", (p) => {
          p.assets.push(a);
          if (badge) p.badgePack[badge] = a.id;
          else {
            p.layouts[p.output].image = a.id;
            p.layouts[p.output].background = "image";
          }
        });
    } catch (e) {
      failure(e);
    }
  };
  const onPick = (square: string) => {
    if (playing) {
      pause();
      return;
    }
    const p = project,
      segs = segments(p),
      through = time >= p.leadIn && selected >= 0 ? selected + 1 : 0;
    if (!from) {
      setFrom(square);
      setTime(through ? segs[through - 1].end - 0.00001 : 0);
      notify(`${square} selected · choose a legal destination`);
      return;
    }
    try {
      const next = appendMove(p, from + square + promotion, through);
      edit("Enter legal move", (p) => Object.assign(p, next));
      setSelected(next.moves.length - 1);
      const s = segments(next).at(-1)!;
      setTime(s.departure + next.moves.at(-1)!.effect.duration * 0.42);
      setFrom(null);
      notify(`Added ${next.moves.at(-1)!.san} to a new variation.`);
    } catch {
      setFrom(square);
      failure(
        new Error(
          `Illegal move ${from}–${square}. Select a piece and legal destination.`,
        ),
      );
    }
  };
  const runAnalysis = async (
    mode: "book" | "engine" | "both",
    all: boolean,
  ) => {
    if (analysisBusy) return;
    setAnalysisBusy(true);
    analysisProject.current = project.id;
    setAnalysisProgress("Starting background analysis…");
    try {
      const ids = all
        ? project.moves.map((m) => m.id)
        : project.moves[selected]
          ? [project.moves[selected].id]
          : [];
      await window.studio.analyze(project, mode, ids);
      notify("Analysis finished. Manual badges are preserved.");
    } catch (e) {
      failure(e);
    } finally {
      setAnalysisBusy(false);
    }
  };
  const startExport = async () => {
    pause();
    setExportBusy(true);
    setExportProgress(null);
    try {
      await window.studio.exportVideo(displayed, path, {
        format: displayed.output,
        encoder,
      });
    } catch (e) {
      setExportBusy(false);
      failure(e);
    }
  };
  const collect = async () => {
    try {
      const r = await window.studio.collectAssets(project, path);
      if (r) {
        await load(r.path);
        notify("Portable project collected with relative asset references.");
      }
    } catch (e) {
      failure(e);
    }
  };
  const removeAsset = (id: string) =>
    edit("Remove asset", (p) => {
      p.assets = p.assets.filter((a) => a.id !== id);
      if (p.music?.assetId === id) p.music = null;
      p.cues = p.cues.filter((c) => c.assetId !== id);
      for (const f of FORMATS)
        if (p.layouts[f].image === id) {
          p.layouts[f].image = null;
          p.layouts[f].background = "gradient";
        }
      for (const k of Object.keys(p.badgePack))
        if (p.badgePack[k] === id) delete p.badgePack[k];
    });
  const relink = async (a: Asset) => {
    try {
      const next = await window.studio.relinkAsset(a);
      if (next) {
        loaded.current.delete(a.id);
        edit("Relink asset", (p) => {
          p.assets[p.assets.findIndex((x) => x.id === a.id)] = next;
        });
        notify("Asset relinked.");
      }
    } catch (e) {
      failure(e);
    }
  };
  const formatsLabel = {
    landscape: "16:9 Landscape",
    vertical: "9:16 Vertical",
    square: "1:1 Square",
    "square-in-vertical": "Square in 9:16",
  };
  const tabs: [LibraryTab, typeof Music2, string][] = [
    ["game", BookOpen, "Game"],
    ["styles", Sparkles, "Styles"],
    ["music", Music2, "Music"],
    ["design", SlidersHorizontal, "Design"],
    ["analysis", CheckCircle2, "Analysis"],
    ["settings", Settings2, "Settings"],
  ];
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">♞</div>
        <div className="brand">
          <strong>
            CHESS ANIMATION <span>STUDIO</span>
          </strong>
          <small>LOCAL DESKTOP · v{APP_VERSION}</small>
        </div>
        <div className="project-title">
          <input
            aria-label="Project title"
            value={project.title}
            maxLength={200}
            onChange={(e) =>
              edit("Project title", (p) => {
                p.title = e.target.value;
              })
            }
          />
          <span>
            {dirty ? "● Unsaved changes" : path ? "✓ Saved" : "Local draft"}
          </span>
        </div>
        <div className="top-actions">
          <button title="New project" onClick={() => void newProject()}>
            <Plus size={16} />
          </button>
          <button title="Open project" onClick={() => void load()}>
            <FolderOpen size={16} />
          </button>
          <button onClick={() => void save()}>
            <Save size={15} /> Save
          </button>
          <button title="Save as" onClick={() => void save(true)}>
            Save as
          </button>
          <span className="divider" />
          <button
            title="Undo (Ctrl+Z)"
            disabled={!store.canUndo}
            onClick={() => {
              pause();
              undo();
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            title="Redo (Ctrl+Shift+Z)"
            disabled={!store.canRedo}
            onClick={() => {
              pause();
              redo();
            }}
          >
            <Redo2 size={16} />
          </button>
          <span className="divider" />
          <button onClick={() => void window.studio.present().catch(failure)}>
            <MonitorPlay size={16} /> Present
          </button>
          <button className="primary" onClick={() => setExportOpen(true)}>
            <Download size={16} /> Export MP4
          </button>
        </div>
      </header>
      {recovery && (
        <div className="notification recovery">
          <strong>An autosave is available.</strong>
          <span>
            Recover the last editing session before making new changes.
          </span>
          <button onClick={() => void load(undefined, true)}>
            Recover session
          </button>
          <button
            onClick={() => {
              void window.studio.discardRecovery();
              setRecovery(false);
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="notification error" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <div className="workspace">
        <aside className="library">
          <nav className="library-tabs">
            {tabs.map(([id, Icon, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => setTab(id)}
                title={label}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="library-content">
            {tab === "game" && (
              <>
                <div className="panel-title">GAME & VARIATIONS</div>
                <div className="variation-control">
                  <select
                    aria-label="Selected variation"
                    value={project.selectedLine}
                    onChange={(e) => {
                      const index = Number(e.target.value);
                      edit("Select variation", (p) =>
                        Object.assign(p, setLine(p, p.lines[index].sans), {
                          selectedLine: index,
                        }),
                      );
                      setTime(0);
                      setSelected(0);
                    }}
                  >
                    {project.lines.map((l, i) => (
                      <option key={i} value={i}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="wide"
                    style={{ marginTop: 10 }}
                    onClick={() => void load("__sample__")}
                  >
                    Open sample with original music
                  </button>
                </div>
                <GamePanel
                  project={project}
                  selected={selected}
                  checked={checked}
                  onSelect={select}
                  onCheck={(id) =>
                    setChecked((set) => {
                      const n = new Set(set);
                      n.has(id) ? n.delete(id) : n.add(id);
                      return n;
                    })
                  }
                  onImport={importGame}
                  onFile={() => void importFile()}
                  onNew={() => void newProject()}
                  promotion={promotion}
                  setPromotion={setPromotion}
                />
              </>
            )}
            {tab === "styles" && (
              <PresetsPanel
                project={project}
                checked={checked}
                selected={selected}
                onApply={applyPreset}
                edit={edit}
              />
            )}
            {tab === "music" && (
              <MusicPanel
                project={project}
                edit={edit}
                time={time}
                onImport={(role) => void importAudio(role)}
                onPreview={(id) => audio.current?.preview(id)}
                onAlign={(selection) => {
                  pause();
                  setArrangement(alignLandings(project, selection));
                  notify(
                    "Previewing a proposed arrangement. Apply or cancel above the preview.",
                  );
                }}
                onAddBeat={addBeat}
                onStatus={notify}
              />
            )}
            {tab === "design" && (
              <DesignPanel
                project={project}
                edit={edit}
                onImage={() => void importImage()}
                onBadge={(b) => void importImage(b)}
                onPack={() => {
                  void window.studio
                    .importBadgePack()
                    .then((pack) => {
                      if (pack) {
                        edit("Import badge pack", (p) => {
                          p.assets.push(...pack.assets);
                          Object.assign(p.badgePack, pack.badges);
                        });
                        notify(
                          `${pack.assets.length} local badge images imported with source and usage guidance.`,
                        );
                      }
                    })
                    .catch(failure);
                }}
              />
            )}
            {tab === "analysis" && (
              <AnalysisPanel
                project={project}
                selected={selected}
                edit={edit}
                busy={analysisBusy}
                progress={analysisProgress}
                onAnalyze={(m, a) => void runAnalysis(m, a)}
                onCancel={() => void window.studio.cancelAnalysis()}
              />
            )}
            {tab === "settings" && (
              <>
                <SettingsPanel
                  settings={settings}
                  onConfigure={(key, value) => {
                    void window.studio
                      .configure(key, value)
                      .then((s) => {
                        setSettings(s);
                        notify(
                          `${key === "token" ? "Secure token" : "Tool"} setting updated.`,
                        );
                      })
                      .catch(failure);
                  }}
                  onLogs={() => void window.studio.openLogs().catch(failure)}
                  assets={project.assets}
                  edit={edit}
                  onRelink={(a) => void relink(a)}
                  onRemove={removeAsset}
                  onRefresh={() => void refreshAssets(true)}
                />
                <div className="padded">
                  <button className="wide" onClick={() => void collect()}>
                    <FileBox size={14} /> Collect portable project
                  </button>
                  <label className="select-field">
                    <span>Recent projects</span>
                    <select
                      aria-label="Recent projects"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) void load(e.target.value);
                      }}
                    >
                      <option value="">Open recent…</option>
                      {settings?.recent.map((f) => (
                        <option key={f} value={f}>
                          {f.split(/[\\/]/).at(-1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </>
            )}
          </div>
        </aside>
        <main className="stage-column">
          <div className="stage-toolbar">
            <div>
              <span className="eyebrow">COMPOSITION</span>
              <strong>{project.title}</strong>
            </div>
            <Select
              label="Format"
              value={project.output}
              options={FORMATS.map((f) => [f, formatsLabel[f]] as const)}
              onChange={(v) =>
                edit("Output format", (p) => {
                  p.output = v;
                })
              }
            />
          </div>
          {arrangement && (
            <div className="arrangement-banner">
              <span>
                Timing preview · {arrangement.changed} aligned ·{" "}
                {arrangement.skipped} unchanged
              </span>
              <button
                onClick={() => {
                  const next = arrangement.project;
                  edit("Apply automatic timing", (p) => Object.assign(p, next));
                  notify(
                    "Timing applied. Undo restores the previous arrangement.",
                  );
                }}
              >
                Apply timing
              </button>
              <button
                onClick={() => {
                  setArrangement(null);
                  pause();
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <Preview
            project={displayed}
            time={time}
            images={images}
            onPick={onPick}
          />
          <div className="transport">
            <div className="transport-left">
              <span className="keyboard-hint">SPACE</span>
              <span>
                {from
                  ? `${from} → select destination`
                  : displayed.moves[selected]?.san
                    ? `Move ${selected + 1} · ${displayed.moves[selected].san}`
                    : "Starting position"}
              </span>
            </div>
            <div className="transport-buttons">
              <button title="Restart" onClick={() => seek(0)}>
                <ChevronsLeft size={18} />
              </button>
              <button
                title="Previous move"
                disabled={selected <= 0}
                onClick={() => select(selected - 1)}
              >
                <SkipBack size={17} />
              </button>
              <button
                className="play-button"
                title={playing ? "Pause" : "Play"}
                aria-label={playing ? "Pause" : "Play"}
                disabled={assetLoading}
                onClick={() => void togglePlay()}
              >
                {playing ? <Pause size={19} /> : <Play size={19} />}
              </button>
              <button
                title="Next move"
                disabled={selected >= project.moves.length - 1}
                onClick={() => select(selected + 1)}
              >
                <SkipForward size={17} />
              </button>
            </div>
            <div className="time-display">
              {timeLabel(time)} <span>/ {timeLabel(total)}</span>
            </div>
          </div>
          <label className="seek-bar">
            <span className="sr-only">Seek timeline</span>
            <input
              aria-label="Seek timeline"
              type="range"
              min={0}
              max={total}
              step={0.001}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </label>
          <Timeline
            project={displayed}
            time={time}
            selected={selected}
            onSelect={select}
            onSeek={seek}
            onAddBeat={addBeat}
            onMoveBeat={(id, t) =>
              edit("Move beat", (p) => {
                correctBeat(p, id, t);
              })
            }
          />
        </main>
        <Inspector
          project={project}
          index={selected}
          edit={edit}
          onCopy={() => {
            if (project.moves[selected]) {
              setCopy({
                ...structuredClone(project.moves[selected].effect),
                landingBeat: null,
              });
              notify("Move effects copied.");
            }
          }}
          onPaste={() => {
            if (copy)
              edit("Paste effects", (p) => {
                p.moves[selected].effect = structuredClone(copy);
              });
          }}
          hasCopy={!!copy}
          onBeat={attachBeat}
          onStatus={notify}
        />
      </div>
      <footer className="statusbar">
        <span className={error ? "status-error" : ""}>
          <i />
          {status}
        </span>
        <span>
          {analysisBusy ? "Analyzing · " : ""}
          {project.output} · deterministic timeline <b>v{APP_VERSION}</b>
        </span>
      </footer>
      {exportOpen && (
        <div className="dialog-backdrop">
          <section
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Export MP4"
          >
            <div className="dialog-heading">
              <span className="eyebrow">FROM TIMELINE TO VIDEO</span>
              <button
                aria-label="Close export"
                onClick={() => setExportOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <h2>Ready for the final frame.</h2>
            <p>
              Exact-time rendering with the same scene as your preview. Music
              and sound cues are mixed into the MP4.
            </p>
            <Select
              label="Export format"
              value={project.output}
              options={FORMATS}
              onChange={(v) =>
                edit("Export format", (p) => {
                  p.output = v;
                })
              }
            />
            <Select
              label="H.264 encoder"
              value={encoder}
              options={[
                ["auto", "Detect hardware · software fallback"],
                ["software", "Software · libx264"],
              ]}
              onChange={setEncoder}
            />
            <div className="export-spec">
              <span>{DIMENSIONS[project.output].join(" × ")}</span>
              <span>60 FPS</span>
              <span>{timeLabel(total)}</span>
              <span>AAC audio</span>
            </div>
            <Range
              label="Final hold"
              value={project.tailHold}
              onChange={(v) =>
                edit("Final hold", (p) => {
                  p.tailHold = v;
                })
              }
              min={0}
              max={10}
              unit="s"
            />
            <p className="hint">
              FFmpeg must be installed or selected in Settings. The app checks
              encoders and falls back to software. Keep this session open while
              exporting.
            </p>
            {exportProgress && (
              <div className={`export-progress ${exportProgress.phase}`}>
                <progress
                  value={exportProgress.done}
                  max={exportProgress.total || 1}
                />
                <strong>{exportProgress.message}</strong>
                {exportProgress.path && <code>{exportProgress.path}</code>}
              </div>
            )}
            <div className="button-row">
              {exportBusy ? (
                <button
                  className="wide"
                  onClick={() =>
                    void window.studio.cancelExport().catch(failure)
                  }
                >
                  Cancel export
                </button>
              ) : (
                <button
                  className="primary wide"
                  onClick={() => void startExport()}
                >
                  <Download size={16} /> Choose output file & export
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
