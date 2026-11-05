import { pasteSettings, type SettingsClipboard } from "../core/editing";
import { Transport } from "./transport/Transport";
import { ExportDialog } from "./export/ExportDialog";
import { AnnotationEditor } from "./annotations/AnnotationEditor";
import { annotation } from "../core/annotations";
import { PresetBrowser } from "./presets/PresetBrowser";
import { useWorkspace, WorkspaceBar, Splitter } from "./workspace/Workspace";
import { settingHelp } from "./help";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  BookOpen,
  SlidersHorizontal,
  Music2,
  Palette,
  Activity,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Monitor,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  RefreshCw,
  Grid3X3,
  Crop,
  CloudSnow,
  Sparkles,
} from "lucide-react";
import { useProject } from "./state";
import {
  blank,
  VERSION,
  formats,
  sizes,
  type Project,
  type Asset,
  type Effect,
} from "../core/project";
import { sample, buildGame, appendMove, legalMoves } from "../core/chess";
import { duration, segments } from "../core/timeline";
import { detectedMarkers } from "../core/audio";
import { AudioPlayer } from "./audio";
import { Preview } from "./Preview";
import { Inspector } from "./Inspector";
import { IntroInspector } from "./Intro";
import {
  GamePanel,
  MusicPanel,
  BoardPanel,
  FramingPanel,
  AtmospherePanel,
  EffectsPanel,
  AnalysisPanel,
  FilesPanel,
  type PanelProps,
} from "./Panels";
import { Timeline } from "./Timeline";
import { movePreviewWindow } from "./movePreview";
import { SettingsSearch } from "./SettingsSearch";
import { clock, Select, Range, SettingsScope } from "./controls";
import type { Settings, ExportProgress } from "../bridge";
export function App() {
  const {
    project: p,
    edit,
    replace,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useProject();
  const workspace = useWorkspace();
  const layout = workspace.layout;
  const [inspectorRequest, setInspectorRequest] = useState<{
    section: string;
    version: number;
  } | null>(null);
  const [annotationId, setAnnotationId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<"arrow" | "circle" | null>(null);
  const annotationFrom = useRef<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<Effect | null>(null);

  const [introSelected, setIntroSelected] = useState(false);
  const [selected, setSelected] = useState(0),
    [tab, setTab] = useState(
      () => localStorage.getItem("studio.category") || "game",
    ),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [status, setStatus] = useState("Ready to shape your next move."),
    [error, setError] = useState(false),
    [path, setPath] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [checked, setChecked] = useState(new Set<string>()),
    [assets, setAssets] = useState<Record<string, string>>({}),
    [missing, setMissing] = useState(new Set<string>()),
    [settings, setSettings] = useState<Settings>({
      ffmpeg: "",
      stockfish: "",
      encoder: "auto",
      tokenPresent: false,
    }),
    [recent, setRecent] = useState<string[]>([]),
    [recovery, setRecovery] = useState<{
      project: Project;
      path: string | null;
    } | null>(null),
    [promotion, setPromotion] = useState("q"),
    [picked, setPicked] = useState<string | null>(null),
    [analysisProgress, setAnalysisProgress] = useState<{
      done: number;
      total: number;
    } | null>(null),
    [exportOpen, setExportOpen] = useState(false),
    [exportProgress, setExportProgress] = useState<ExportProgress | null>(null),
    [rangeStart, setRangeStart] = useState(0),
    [rangeEnd, setRangeEnd] = useState(0),
    [loadingAudio, setLoadingAudio] = useState(0);
  useEffect(() => localStorage.setItem("studio.category", tab), [tab]);
  const previewProject = useMemo(() => {
    if (!presetDraft || !p.moves[selected]) return p;
    const next = structuredClone(p);
    next.moves[selected].effect = structuredClone(presetDraft);
    return next;
  }, [p, presetDraft, selected]);
  const [audition, setAudition] = useState<{
    time: number;
    playing: boolean;
    end: number;
  } | null>(null);
  const latest = useRef(p),
    timeRef = useRef(time),
    audio = useRef<AudioPlayer | null>(null),
    saved = useRef(p),
    clipboard = useRef<SettingsClipboard | null>(null),
    assetKeys = useRef(new Map<string, string>());
  const [assetRevision, setAssetRevision] = useState(0);
  const fingerprints = useRef(new Map<string, string | null>());
  latest.current = p;
  timeRef.current = time;
  const message = useCallback((s: string) => {
    setStatus(s);
    setError(false);
  }, []);
  const run = useCallback((fn: () => Promise<unknown>) => {
    void fn().catch((e) => {
      setStatus(
        ((e as Error).message || (e as Error).name || String(e)).replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
      setError(true);
    });
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    setAudition(null);
    audio.current?.stop();
  }, []);
  const seek = useCallback(
    (t: number) => {
      stop();
      setTime(Math.max(0, Math.min(duration(latest.current), t)));
    },
    [stop],
  );
  const selectionAnchor = useRef(0);
  const select = useCallback(
    (
      i: number,
      modifiers?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
    ) => {
      setIntroSelected(false);
      const ctrl = modifiers?.ctrlKey || modifiers?.metaKey;
      setChecked((old) => {
        const next = ctrl ? new Set(old) : new Set<string>();
        if (modifiers?.shiftKey) {
          for (
            let j = Math.min(selectionAnchor.current, i);
            j <= Math.max(selectionAnchor.current, i);
            j++
          )
            if (latest.current.moves[j]) next.add(latest.current.moves[j].id);
        } else {
          const id = latest.current.moves[i]?.id;
          if (id) {
            if (ctrl && next.has(id)) next.delete(id);
            else next.add(id);
          }
          selectionAnchor.current = i;
        }
        return next;
      });
      const seq = segments(latest.current);
      if (!seq[i]) return;
      setSelected(i);
      seek(seq[i].depart);
      setPicked(null);
    },
    [seek],
  );
  const contextSelect = useCallback(
    (index: number) => {
      const move = latest.current.moves[index];
      if (!move) return;
      stop();
      setSelected(index);
      setIntroSelected(false);
      setChecked((old) => {
        if (old.has(move.id)) return old;
        selectionAnchor.current = index;
        return new Set([move.id]);
      });
    },
    [stop],
  );
  useEffect(() => {
    audio.current = new AudioPlayer();
    run(async () => {
      setSettings(await window.studio.settings());
      setRecent(await window.studio.recent());
      setRecovery(await window.studio.recover());
    });
    const offA = window.studio.onAnalysis(setAnalysisProgress),
      offE = window.studio.onExport((v) => {
        setExportProgress(v);
        if (v.phase === "Complete") message("Export complete: " + v.path);
        if (v.error) {
          setStatus(v.error);
          setError(true);
        }
      });
    return () => {
      audio.current?.dispose();
      offA();
      offE();
    };
  }, []);
  useEffect(() => {
    setDirty(p !== saved.current);
    const timer = setTimeout(() => run(() => window.studio.autosave(p)), 800);
    return () => clearTimeout(timer);
  }, [p]);
  useEffect(() => {
    stop();
    setTime((t) => Math.min(t, duration(p)));
    setSelected((i) => Math.max(0, Math.min(i, p.moves.length - 1)));
  }, [p.id, p.moves.length]);
  useEffect(() => {
    let alive = true;
    for (const id of assetKeys.current.keys())
      if (!p.assets.some((a) => a.id === id)) {
        assetKeys.current.delete(id);
        audio.current?.clear(id);
        setAssets((v) => {
          const n = { ...v };
          delete n[id];
          return n;
        });
      }
    for (const a of p.assets) {
      if (assetKeys.current.get(a.id) === a.path) continue;
      assetKeys.current.set(a.id, a.path);
      if (a.kind === "audio") setLoadingAudio((n) => n + 1);
      run(async () => {
        try {
          const url = await window.studio.assetData(a);
          if (
            !latest.current.assets.some(
              (v) => v.id === a.id && v.path === a.path,
            )
          )
            return;
          if (!url) {
            setMissing((s) => new Set(s).add(a.id));
            return;
          }
          setMissing((s) => {
            const n = new Set(s);
            n.delete(a.id);
            return n;
          });
          setAssets((v) => ({ ...v, [a.id]: url }));
          if (a.kind === "audio") {
            const buffer = await audio.current!.load(a.id, url);
            if (
              latest.current.music.asset === a.id &&
              latest.current.music.sourceDuration === 0
            ) {
              const samples = buffer.getChannelData(0).slice();
              const worker = new Worker(
                new URL("../workers/audio.ts", import.meta.url),
                { type: "module" },
              );
              await new Promise<void>((resolve, reject) => {
                worker.onerror = () => {
                  worker.terminate();
                  reject(Error("Music beat analysis failed."));
                };
                worker.onmessage = (e) => {
                  worker.terminate();
                  if (e.data.error) {
                    reject(Error("Music beat analysis failed."));
                    return;
                  }
                  const current = latest.current;
                  if (
                    current.music.asset === a.id &&
                    current.music.sourceDuration === 0
                  )
                    edit("Analyze imported music", (p) => {
                      p.music.sourceDuration = buffer.duration;
                      p.waveform = e.data.waveform;
                      p.beats = detectedMarkers(p, e.data.peaks);
                    });
                  resolve();
                };
                worker.postMessage({ samples, rate: buffer.sampleRate }, [
                  samples.buffer,
                ]);
              });
            }
          }
        } finally {
          if (a.kind === "audio") setLoadingAudio((n) => Math.max(0, n - 1));
        }
      });
    }
    const interval = setInterval(
      () =>
        run(async () => {
          const states = await window.studio.assetStatus(latest.current.assets);
          const ids = Object.entries(states)
            .filter(([, value]) => value === null)
            .map(([id]) => id);
          for (const [id, value] of Object.entries(states)) {
            if (
              fingerprints.current.has(id) &&
              fingerprints.current.get(id) !== value
            ) {
              assetKeys.current.delete(id);
              setAssetRevision((n) => n + 1);
            }
            fingerprints.current.set(id, value);
          }
          if (!alive) return;
          setMissing(new Set(ids));
          for (const id of ids) {
            audio.current?.clear(id);
            assetKeys.current.delete(id);
            setAssets((v) => {
              const n = { ...v };
              delete n[id];
              return n;
            });
          }
        }),
      4000,
    );
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [p.assets.map((a) => a.id + a.path).join("|"), assetRevision]);
  useEffect(() => {
    if (!playing) return;
    let alive = true,
      raf = 0;
    const start = timeRef.current;
    run(async () => {
      const origin = await audio.current!.play(latest.current, start);
      if (!alive) {
        audio.current!.stop();
        return;
      }
      const tick = () => {
        if (!alive) return;
        const t = start + Math.max(0, (performance.now() - origin) / 1000);
        if (audition && t >= audition.end) {
          setTime(audition.time);
          timeRef.current = audition.time;
          setPlaying(audition.playing);
          setAudition(null);
          return;
        }
        if (t >= duration(latest.current)) {
          setTime(duration(latest.current));
          stop();
          return;
        }
        audio.current?.updateMusic(latest.current, t);
        setTime(t);
        raf = requestAnimationFrame(tick);
      };
      tick();
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      audio.current?.stop();
    };
  }, [playing, audition]);
  useEffect(() => {
    audio.current?.updateMusic(p, timeRef.current);
  }, [p.music.volume, p.music.muted, p.music.volumePoints]);
  const lastPresentation = useRef(0);
  useEffect(() => {
    if (playing && performance.now() - lastPresentation.current < 100) return;
    lastPresentation.current = performance.now();
    window.studio.present({
      project: p,
      time,
      playing,
      assets: Object.fromEntries(
        p.assets
          .filter((a) => a.kind === "image" && assets[a.id])
          .map((a) => [a.id, assets[a.id]]),
      ),
    });
  }, [p, time, playing, assets]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.key === "Escape") {
        setDrawing(null);
        annotationFrom.current = null;
        setPicked(null);
      }
      const buttonFocus = (e.target as HTMLElement).closest("button,summary");
      if (e.code === "Space" && !buttonFocus) {
        e.preventDefault();
        if (!loadingAudio) setPlaying((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        stop();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>('[aria-label="Search settings"]')
          ?.focus();
      }
      if (
        e.shiftKey &&
        ["ArrowRight", "ArrowLeft"].includes(e.key) &&
        !buttonFocus
      ) {
        e.preventDefault();
        seek(timeRef.current + (e.key === "ArrowRight" ? 1 / 60 : -1 / 60));
        return;
      }
      if (e.key === "ArrowRight" && !buttonFocus)
        select(Math.min(latest.current.moves.length - 1, selected + 1));
      if (e.key === "ArrowLeft" && !buttonFocus)
        select(Math.max(0, selected - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, loadingAudio]);
  function adopted(project: Project, file: string | null) {
    stop();
    replace(project);
    setPath(file);
    setTime(0);
    setSelected(0);
    setPicked(null);
    setChecked(new Set());
    saved.current = project;
    setDirty(false);
    setRecovery(null);
  }
  function confirmDiscard() {
    return !dirty || confirm("Discard unsaved edits to this composition?");
  }
  function save(as: boolean) {
    run(async () => {
      const file = await window.studio.save(latest.current, as);
      if (file) {
        saved.current = latest.current;
        setDirty(false);
        setPath(file);
        setRecent(await window.studio.recent());
        message("Saved " + file);
      }
    });
  }
  function open() {
    if (!confirmDiscard()) return;
    run(async () => {
      const result = await window.studio.open();
      if (result) adopted(result.project, result.path);
    });
  }
  function openRecent(f: string) {
    if (!confirmDiscard()) return;
    run(async () => {
      const result = await window.studio.openPath(f);
      adopted(result.project, result.path);
    });
  }
  function importText(text: string, kind: "pgn" | "fen", preserve: boolean) {
    stop();
    message("Validating legal game…");
    const snapshot = latest.current;
    const worker = new Worker(
      new URL("../workers/import.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) {
        setError(true);
        setStatus(e.data.error);
        return;
      }
      if (latest.current !== snapshot) {
        message("Import discarded because the composition changed. Try again.");
        return;
      }
      replace(e.data.project);
      setSelected(0);
      setTime(0);
      message("Imported legal game and variations.");
    };
    worker.onerror = () => {
      worker.terminate();
      setError(true);
      setStatus("Import worker failed.");
    };
    worker.postMessage({ project: snapshot, text, kind, preserve });
  }
  async function importAsset(
    kind: "audio" | "image",
    use: "music" | "sound" | "background" | "badge",
    badgeKind?: string,
  ) {
    const a = await window.studio.importAsset(kind);
    if (!a) return;
    stop();
    edit("Import " + use, (p) => {
      p.assets.push(a);
      if (use === "music") {
        p.music = {
          ...p.music,
          asset: a.id,
          sourceDuration: 0,
          trimStart: 0,
          trimEnd: 0,
          offset: 0,
          volumePoints: [],
          muted: false,
          fadeIn: 0,
          fadeOut: 0,
        };
        p.waveform = [];
        p.beats = [];
      }
      if (use === "background") {
        p.layouts[p.format].background = "image";
        p.layouts[p.format].image = a.id;
      }
      if (use === "badge" && badgeKind) p.badgeAssets[badgeKind] = a.id;
    });
    message("Imported " + a.name);
  }
  async function analyzeMusic() {
    const snapshot = latest.current,
      id = snapshot.music.asset,
      buffer = audio.current?.buffers.get(id ?? "");
    if (!buffer) throw Error("Wait for the music file to finish loading.");
    if (buffer.duration > 3600)
      throw Error("Music analysis supports up to one hour.");
    message("Analyzing waveform and transients…");
    const samples = buffer.getChannelData(0).slice();
    const worker = new Worker(new URL("../workers/audio.ts", import.meta.url), {
      type: "module",
    });
    await new Promise<void>((resolve, reject) => {
      worker.onerror = () => {
        worker.terminate();
        reject(Error("Audio analysis failed."));
      };
      worker.onmessage = (e) => {
        worker.terminate();
        if (e.data.error) {
          reject(Error(e.data.error));
          return;
        }
        if (latest.current.music.asset !== id) {
          resolve();
          return;
        }
        edit("Audio analysis", (p) => {
          p.waveform = e.data.waveform;
          p.music.sourceDuration = buffer.duration;
          p.beats = detectedMarkers(p, e.data.peaks);
        });
        message("Waveform ready; review and correct the suggested markers.");
        resolve();
      };
      worker.postMessage({ samples, rate: buffer.sampleRate }, [
        samples.buffer,
      ]);
    });
  }
  function square(s: string) {
    stop();
    const at =
      timeRef.current < p.lead
        ? -1
        : Math.max(
            -1,
            segments(p).findIndex((seg) => timeRef.current < seg.end) - 1,
          );
    if (picked) {
      try {
        const next = appendMove(p, at, picked, s, promotion);
        replace(next);
        setSelected(next.moves.length - 1);
        setTime(segments(next).at(-1)!.end);
        setPicked(null);
        message("Legal move added as a new variation.");
        return;
      } catch {}
    }
    const moves = legalMoves(p, at, s);
    if (moves.length) {
      setPicked(s);
      message(`From ${s}: choose ${moves.join(", ")}.`);
    } else {
      setPicked(null);
      message("Choose a piece that can move in this position.");
    }
  }
  const props: PanelProps = {
    project: p,
    edit,
    replace,
    selected,
    checked,
    setChecked,
    select,
    time,
    seek,
    assets,
    missing,
    settings,
    setSettings,
    run,
    message,
    importText,
    importAsset,
    analyzeMusic,
    onOpen: open,
    openRecent,
    recent,
    path,
    promotion,
    setPromotion,
    analysisProgress,
  };
  function selectIntro() {
    setIntroSelected(true);
    setChecked(new Set());
    seek(0);
  }
  function previewMove(index = selected) {
    if (audition) {
      setTime(audition.time);
      setPlaying(audition.playing);
      setAudition(null);
      return;
    }
    const segment = movePreviewWindow(p, index);
    if (!segment) return;
    setAudition({ time, playing, end: segment.end });
    setTime(segment.start);
    timeRef.current = segment.start;
    setPlaying(true);
  }
  const panels: Record<string, React.ComponentType<PanelProps> | null> = {
    game: GamePanel,
    presets: null,
    music: MusicPanel,
    board: BoardPanel,
    framing: FramingPanel,
    atmosphere: AtmospherePanel,
    effects: EffectsPanel,
    analysis: AnalysisPanel,
    files: FilesPanel,
  };
  const end = duration(p),
    progressBusy =
      !!exportProgress &&
      !["Complete", "Failed", "Cancelled"].includes(exportProgress.phase);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-icon"
            src="./studio-mark.svg"
            alt="Chess Animation Studio — frame and motion logo"
          />
          <div>
            <strong>CHESS ANIMATION STUDIO</strong>
            <small>LOCAL STUDIO · v{VERSION}</small>
          </div>
        </div>
        <div className="project-heading">
          <input
            title={settingHelp("Project title")}
            aria-description={settingHelp("Project title")}
            aria-label="Project title"
            value={p.title}
            onChange={(e) =>
              edit("Title", (p) => {
                p.title = e.target.value;
              })
            }
          />
          <small>
            {dirty
              ? "Unsaved changes"
              : path
                ? "Saved composition"
                : "Local composition"}
          </small>
        </div>
        <div className="header-actions">
          <button
            title="New composition"
            onClick={() => {
              if (confirmDiscard()) adopted(blank(), null);
            }}
          >
            <Plus size={16} />
          </button>
          <button title="Open composition" onClick={open}>
            <FolderOpen size={16} />
          </button>
          <button onClick={() => save(false)}>
            <Save size={15} /> Save
          </button>
          <button onClick={() => save(true)}>Save as</button>
          <span className="divider" />
          <button
            title="Undo"
            disabled={!canUndo}
            onClick={() => {
              stop();
              undo();
            }}
          >
            <Undo2 size={16} />
          </button>
          <button
            title="Redo"
            disabled={!canRedo}
            onClick={() => {
              stop();
              redo();
            }}
          >
            <Redo2 size={16} />
          </button>
          <button onClick={() => run(() => window.studio.presentation())}>
            <Monitor size={15} /> Present
          </button>
          <button
            className="primary"
            onClick={() => {
              stop();
              setRangeStart(0);
              setRangeEnd(end);
              setExportOpen(true);
            }}
          >
            <Download size={15} /> Export MP4
          </button>
        </div>
      </header>
      {recovery && (
        <div className="recovery">
          <span>
            A recovery snapshot is available:{" "}
            <strong>{recovery.project.title}</strong>
          </span>
          <button onClick={() => adopted(recovery.project, recovery.path)}>
            Recover session
          </button>
          <button
            onClick={() => {
              setRecovery(null);
              run(() => window.studio.discardRecovery());
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <WorkspaceBar workspace={workspace} />
      <div
        className={`workspace flexible ${layout.compact ? "compact-nav" : ""} ${layout.hideLeft ? "left-hidden" : ""} ${layout.hideRight ? "right-hidden" : ""} ${layout.hideTimeline ? "timeline-hidden" : ""}`}
        style={
          {
            "--left": `${layout.left}px`,
            "--right": `${layout.right}px`,
            "--timeline": `${layout.timeline}px`,
            "--ui-scale": layout.scale / 100,
          } as React.CSSProperties
        }
      >
        <aside className="library">
          <nav
            className="library-tabs"
            aria-label="Composition categories"
            onKeyDown={(e) => {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll("button"),
              );
              const index = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const offset = (
                {
                  ArrowRight: 1,
                  ArrowLeft: -1,
                  ArrowDown: 3,
                  ArrowUp: -3,
                } as Record<string, number>
              )[e.key];
              if (offset !== undefined && index >= 0) {
                e.preventDefault();
                e.stopPropagation();
                const next = buttons[(index + offset + 9) % 9];
                next.focus();
                next.click();
              }
            }}
          >
            {[
              ["game", BookOpen],
              ["board", Grid3X3],
              ["framing", Crop],
              ["atmosphere", CloudSnow],
              ["effects", Sparkles],
              ["presets", SlidersHorizontal],
              ["music", Music2],
              ["analysis", Activity],
              ["files", FolderOpen],
            ].map(([name, Icon]) => (
              <button
                key={name as string}
                title={name as string}
                aria-label={name as string}
                aria-current={tab === name ? "page" : undefined}
                className={tab === name ? "active" : ""}
                onClick={() => setTab(name as string)}
              >
                {typeof Icon !== "string" && <Icon size={18} />}
                <span>{name as string}</span>
              </button>
            ))}
          </nav>
          <SettingsSearch navigate={setTab} selectIntro={selectIntro} />
          <div className="library-content">
            {Object.entries(panels).map(([category, Panel]) => (
              <div
                key={category}
                data-category={category}
                hidden={tab !== category}
              >
                <SettingsScope.Provider value={category}>
                  <div className="panel-context">
                    <span className="eyebrow">
                      {category === "presets"
                        ? "MOVE ANIMATION LIBRARY"
                        : "COMPOSITION SETTINGS"}
                    </span>
                    <h2>{category[0].toUpperCase() + category.slice(1)}</h2>
                    <p>
                      {
                        (
                          {
                            game: "Import games and manage moves and variations.",
                            board:
                              "Piece artwork, board colors and orientation.",
                            framing:
                              "Output formats, backgrounds and board positioning.",
                            atmosphere:
                              "Continuous particles, color cycles and board animation.",
                            effects:
                              "Cinematic captures and glow across the composition.",
                            presets:
                              "Apply animation styles to selected, checked or all moves.",
                            music: "Music, beats, sound cues and audio levels.",
                            analysis:
                              "Evaluation, classifications and review styling.",
                            files: "Project recovery, assets and local tools.",
                          } as Record<string, string>
                        )[category]
                      }
                    </p>
                  </div>
                  {(category === "framing" || category === "atmosphere") && (
                    <button className="wide" onClick={selectIntro}>
                      Edit intro clip →
                    </button>
                  )}
                  {category === "game" && (
                    <button
                      className="sample-button"
                      onClick={() => {
                        if (confirmDiscard())
                          run(async () => {
                            const project = await window.studio.sample();
                            adopted(project, null);
                            message("Opera Game sample opened.");
                          });
                      }}
                    >
                      Open Opera Game with original music <span>↗</span>
                    </button>
                  )}
                  {category === "effects" && (
                    <>
                      <p className="hint">
                        Global cinema adds sparks, fragments, shockwaves and
                        dust to captures at each move’s impact time. Per-move
                        capture and lighting settings remain separate. Bloom
                        processes the enabled glow sources.
                      </p>
                      <button
                        className="wide"
                        onClick={() => {
                          setIntroSelected(false);
                          document
                            .querySelector<HTMLButtonElement>(
                              '.inspector .tabs [data-tab="effects"]',
                            )
                            ?.click();
                        }}
                      >
                        Edit selected move’s capture impact →
                      </button>
                    </>
                  )}
                  {category === "presets" ? (
                    <PresetBrowser
                      project={p}
                      index={selected}
                      checked={checked}
                      edit={edit}
                      onPreview={(fx) => {
                        setPresetDraft(fx);
                        seek(segments(p)[selected]?.start ?? 0);
                        setPlaying(true);
                      }}
                      onCancel={() => {
                        setPresetDraft(null);
                        stop();
                      }}
                    />
                  ) : (
                    Panel && <Panel {...props} />
                  )}
                </SettingsScope.Provider>
              </div>
            ))}
          </div>
        </aside>
        <Splitter
          label="Left settings width"
          value={layout.left}
          min={220}
          max={500}
          onChange={(left) => workspace.patch({ left })}
        />
        <main className="studio">
          <div className="composition-bar">
            <div>
              <span className="eyebrow">COMPOSITION</span>
              <strong>{p.title}</strong>
            </div>
            <Select
              label="Output format"
              value={
                p.format === "vertical" && p.shorts.enabled
                  ? "shorts"
                  : p.format
              }
              options={[
                ["landscape", "16:9 Landscape"],
                ["vertical", "9:16 Vertical"],
                ["shorts", "9:16 Shorts · cropped board"],
                ["square", "1:1 Square"],
                ["square-in-vertical", "Square in vertical"],
              ]}
              onChange={(v) =>
                edit("Output format", (p) => {
                  p.format = v === "shorts" ? "vertical" : v;
                  p.shorts.enabled = v === "shorts";
                })
              }
            />
          </div>
          <div className="preview-area">
            <Preview
              playing={playing}
              onToggle={() => setPlaying((v) => !v)}
              project={previewProject}
              time={time}
              assets={Object.fromEntries(
                p.assets
                  .filter((a) => a.kind === "image" && assets[a.id])
                  .map((a) => [a.id, assets[a.id]]),
              )}
              onCompositionPoint={(x, y) => {
                const a = p.annotations.find((a) => a.id === annotationId);
                if (a && (a.kind === "text" || a.kind === "caption"))
                  edit("Position annotation", (p) => {
                    Object.assign(
                      p.annotations.find((a) => a.id === annotationId)!,
                      { x, y },
                    );
                  });
              }}
              onContextAnnotation={(sq, kind, x, y) => {
                stop();
                setPicked(null);
                workspace.patch({ hideRight: false });
                const drawer =
                  document.querySelector<HTMLDetailsElement>(
                    ".annotation-drawer",
                  );
                if (drawer) drawer.open = true;
                if (kind === "arrow") {
                  setDrawing("arrow");
                  setAnnotationId(null);
                  annotationFrom.current = sq;
                  message(`Arrow from ${sq}: click destination; Esc cancels.`);
                } else {
                  setDrawing(null);
                  annotationFrom.current = null;
                  const a = annotation(kind, time);
                  a.from = sq;
                  a.to = sq;
                  a.x = x;
                  a.y = y;
                  edit("Add board annotation", (p) => {
                    p.annotations.push(a);
                  });
                  setAnnotationId(a.id);
                }
              }}
              onSquare={(sq) => {
                if (!drawing) {
                  square(sq);
                  return;
                }
                if (drawing === "arrow" && !annotationFrom.current) {
                  annotationFrom.current = sq;
                  message("Click the arrow destination square.");
                  return;
                }
                const existing = p.annotations.find(
                  (a) => a.id === annotationId && a.kind === drawing,
                );
                const a = existing
                  ? structuredClone(existing)
                  : annotation(drawing, time);
                a.from = annotationFrom.current ?? sq;
                a.to = sq;
                edit("Draw annotation", (p) => {
                  if (existing)
                    Object.assign(p.annotations.find((v) => v.id === a.id)!, a);
                  else p.annotations.push(a);
                });
                setAnnotationId(a.id);
                annotationFrom.current = null;
                setDrawing(null);
                message("Annotation added.");
              }}
              onError={(s) => {
                setStatus(s);
                setError(true);
              }}
            />
            <div className="preview-caption">
              <span>● EXACT-TIME PREVIEW</span>
              <span>{sizes[p.format].join(" × ")} · 60 FPS</span>
            </div>
          </div>
          <Transport
            p={p}
            selected={selected}
            time={time}
            end={end}
            playing={playing}
            loadingAudio={loadingAudio}
            select={select}
            seek={seek}
            toggle={() => {
              if (time >= end) setTime(0);
              setPlaying((v) => !v);
            }}
          />
          <Splitter
            label="Timeline height"
            vertical
            value={layout.timeline}
            min={120}
            max={520}
            onChange={(timeline) => workspace.patch({ timeline })}
          />
          <Timeline
            contextSelect={contextSelect}
            clipboard={clipboard}
            report={message}
            preview={(index) => {
              setSelected(index);
              previewMove(index);
            }}
            navigate={(category, section) => {
              setTab(category);
              workspace.patch({ hideLeft: false });
              if (section)
                requestAnimationFrame(() => {
                  const panel = document.querySelector(
                    `[data-category="${category}"]`,
                  );
                  const details = Array.from(
                    panel?.querySelectorAll<HTMLDetailsElement>(
                      "details.section",
                    ) ?? [],
                  ).find(
                    (d) =>
                      d.querySelector("summary > span")?.textContent ===
                      section,
                  );
                  if (details) {
                    details.open = true;
                    details.scrollIntoView({
                      block: "start",
                      behavior: "smooth",
                    });
                  }
                });
            }}
            inspect={(index, section, annotation) => {
              workspace.patch({ hideRight: false });
              if (section === "intro") {
                selectIntro();
              } else if (section === "annotations") {
                if (annotation) setAnnotationId(annotation);
                requestAnimationFrame(() => {
                  const drawer =
                    document.querySelector<HTMLDetailsElement>(
                      ".annotation-drawer",
                    );
                  if (drawer) {
                    drawer.open = true;
                    drawer.scrollIntoView({ block: "nearest" });
                  }
                });
              } else {
                contextSelect(index);
                setInspectorRequest({ section, version: Date.now() });
              }
            }}
            project={p}
            time={time}
            selected={selected}
            checked={checked}
            introSelected={introSelected}
            selectIntro={() => {
              setIntroSelected(true);
              setChecked(new Set());
              seek(0);
            }}
            select={select}
            seek={seek}
            edit={edit}
          />
        </main>
        <Splitter
          label="Right inspector width"
          value={layout.right}
          min={240}
          max={540}
          onChange={(right) => workspace.patch({ right })}
        />
        <div className="inspector-host">
          <details className="annotation-drawer">
            <summary>
              Annotations · {p.annotations.length}
              {drawing ? " · click preview squares" : ""}
            </summary>
            <AnnotationEditor
              project={p}
              edit={edit}
              time={time}
              selected={annotationId}
              onSelect={setAnnotationId}
              onDraw={(kind) => {
                setDrawing(kind);
                annotationFrom.current = null;
                message(
                  kind
                    ? "Click preview squares to draw " + kind + "."
                    : "Select text and Alt-click the preview to position it.",
                );
              }}
            />
          </details>
          <div hidden={!introSelected} className="inspector-slot">
            <IntroInspector project={p} edit={edit} />
            <button
              className="return-move"
              data-return-move
              onClick={() => setIntroSelected(false)}
            >
              Return to selected move
            </button>
          </div>
          <div hidden={introSelected} className="inspector-slot">
            <SettingsScope.Provider value="move-inspector">
              <Inspector
                requestedTab={inspectorRequest}
                project={p}
                checked={checked}
                index={selected}
                edit={edit}
                onPreview={() => previewMove()}
                seek={seek}
                previewing={!!audition}
                previewDisabled={loadingAudio > 0}
                onGlobalEffects={() => setTab("effects")}
                onCopy={() => {
                  if (p.moves[selected])
                    clipboard.current = {
                      kind: "everything",
                      source: structuredClone(p.moves[selected].effect),
                      format: p.format,
                    };
                  message("Move effect copied.");
                }}
                onPaste={() => {
                  if (clipboard.current)
                    edit("Paste effect", (p) => {
                      for (const m of p.moves.filter((m) =>
                        checked.size
                          ? checked.has(m.id)
                          : m.id === p.moves[selected]?.id,
                      ))
                        m.effect = pasteSettings(
                          m.effect,
                          clipboard.current!,
                          p.format,
                        );
                    });
                }}
              />
            </SettingsScope.Provider>
          </div>
        </div>
      </div>
      <footer className={"status-bar " + (error ? "error" : "")}>
        <span>
          {error ? "!" : "●"} {status}
        </span>
        <span>
          {loadingAudio
            ? "Loading audio…"
            : missing.size
              ? `${missing.size} missing assets · relink in Files`
              : "Offline editing ready"}{" "}
          ·{" "}
          {p.style.pieceSet === "merida"
            ? "Nibbler"
            : p.style.pieceSet === "neo"
              ? "Neo"
              : "Cburnett"}
        </span>
      </footer>
      {exportOpen && (
        <ExportDialog
          project={p}
          index={selected}
          settings={settings}
          missing={missing.size}
          progress={exportProgress}
          close={() => setExportOpen(false)}
          cancel={() => run(() => window.studio.cancelExport())}
          render={(options) =>
            run(async () => {
              const started = await window.studio.export(p, options);
              if (!started) message("Export file selection cancelled.");
            })
          }
        />
      )}
    </div>
  );
}
