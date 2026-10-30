import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  GamePanel,
  StylesPanel,
  MusicPanel,
  ScenePanel,
  AnalysisPanel,
  FilesPanel,
  type PanelProps,
} from "./Panels";
import { Timeline } from "./Timeline";
import { clock, Select, Range } from "./controls";
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
  const [selected, setSelected] = useState(0),
    [tab, setTab] = useState("game"),
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
  const latest = useRef(p),
    timeRef = useRef(time),
    audio = useRef<AudioPlayer | null>(null),
    saved = useRef(p),
    clipboard = useRef<Effect | null>(null),
    assetKeys = useRef(new Map<string, string>());
  latest.current = p;
  timeRef.current = time;
  const message = useCallback((s: string) => {
    setStatus(s);
    setError(false);
  }, []);
  const run = useCallback((fn: () => Promise<unknown>) => {
    void fn().catch((e) => {
      setStatus(
        (e as Error).message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
      setError(true);
    });
  }, []);
  const stop = useCallback(() => {
    setPlaying(false);
    audio.current?.stop();
  }, []);
  const seek = useCallback(
    (t: number) => {
      stop();
      setTime(Math.max(0, Math.min(duration(latest.current), t)));
    },
    [stop],
  );
  const select = useCallback(
    (i: number) => {
      const seq = segments(latest.current);
      if (!seq[i]) return;
      setSelected(i);
      seek(seq[i].depart);
      setPicked(null);
    },
    [seek],
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
          if (!alive) return;
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
          if (a.kind === "audio") await audio.current!.load(a.id, url);
        } finally {
          if (a.kind === "audio") setLoadingAudio((n) => Math.max(0, n - 1));
        }
      });
    }
    const interval = setInterval(
      () =>
        run(async () => {
          const ids = await window.studio.assetStatus(latest.current.assets);
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
  }, [p.assets.map((a) => a.id + a.path).join("|")]);
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
        if (t >= duration(latest.current)) {
          setTime(duration(latest.current));
          stop();
          return;
        }
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
  }, [playing]);
  useEffect(() => {
    const timer = setTimeout(
      () =>
        window.studio.present({
          project: p,
          time,
          playing,
          assets: Object.fromEntries(
            p.assets
              .filter((a) => a.kind === "image" && assets[a.id])
              .map((a) => [a.id, assets[a.id]]),
          ),
        }),
      playing ? 100 : 0,
    );
    return () => clearTimeout(timer);
  }, [p, time, playing, assets]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!loadingAudio) setPlaying((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        stop();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save(false);
      }
      if (e.key === "ArrowRight")
        select(Math.min(latest.current.moves.length - 1, selected + 1));
      if (e.key === "ArrowLeft") select(Math.max(0, selected - 1));
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
  const panels: Record<string, React.ComponentType<PanelProps>> = {
      game: GamePanel,
      styles: StylesPanel,
      music: MusicPanel,
      scene: ScenePanel,
      analysis: AnalysisPanel,
      files: FilesPanel,
    },
    Panel = panels[tab];
  const end = duration(p),
    progressBusy =
      !!exportProgress &&
      !["Complete", "Failed", "Cancelled"].includes(exportProgress.phase);
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">♞</div>
          <div>
            <strong>CHESS ANIMATION STUDIO</strong>
            <small>LOCAL STUDIO · v{VERSION}</small>
          </div>
        </div>
        <div className="project-heading">
          <input
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
      <div className="workspace">
        <aside className="library">
          <nav className="library-tabs">
            {[
              ["game", BookOpen],
              ["styles", SlidersHorizontal],
              ["music", Music2],
              ["scene", Palette],
              ["analysis", Activity],
              ["files", FolderOpen],
            ].map(([name, Icon]) => (
              <button
                key={name as string}
                className={tab === name ? "active" : ""}
                onClick={() => setTab(name as string)}
              >
                {typeof Icon !== "string" && <Icon size={18} />}
                <span>{name as string}</span>
              </button>
            ))}
          </nav>
          <div className="library-content">
            {tab === "game" && (
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
            <Panel {...props} />
          </div>
        </aside>
        <main className="studio">
          <div className="composition-bar">
            <div>
              <span className="eyebrow">COMPOSITION</span>
              <strong>{p.title}</strong>
            </div>
            <Select
              label="Output format"
              value={p.format}
              options={[
                ["landscape", "16:9 Landscape"],
                ["vertical", "9:16 Vertical"],
                ["square", "1:1 Square"],
                ["square-in-vertical", "Square in vertical"],
              ]}
              onChange={(v) =>
                edit("Output format", (p) => {
                  p.format = v;
                })
              }
            />
          </div>
          <div className="preview-area">
            <Preview
              project={p}
              time={time}
              assets={assets}
              onSquare={square}
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
          <div className="transport">
            <div className="transport-row">
              <small>
                <kbd>SPACE</kbd>{" "}
                {p.moves[selected]
                  ? `Move ${selected + 1} · ${p.moves[selected].san}`
                  : "Starting position"}
              </small>
              <div className="transport-buttons">
                <button title="Restart" onClick={() => seek(0)}>
                  <SkipBack size={17} />
                </button>
                <button
                  title="Previous move"
                  onClick={() => select(Math.max(0, selected - 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  title={playing ? "Pause" : "Play"}
                  aria-label={playing ? "Pause" : "Play"}
                  className="play-button"
                  disabled={loadingAudio > 0}
                  onClick={() => {
                    if (time >= end) setTime(0);
                    setPlaying((v) => !v);
                  }}
                >
                  {playing ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <button
                  title="Next move"
                  onClick={() =>
                    select(Math.min(p.moves.length - 1, selected + 1))
                  }
                >
                  <ChevronRight size={18} />
                </button>
                <button title="End" onClick={() => seek(end)}>
                  <SkipForward size={17} />
                </button>
              </div>
              <small>
                <strong>{clock(time)}</strong> / {clock(end)}
              </small>
            </div>
            <input
              aria-label="Seek composition"
              type="range"
              min={0}
              max={end}
              step={0.001}
              value={time}
              onChange={(e) => seek(+e.target.value)}
            />
          </div>
          <Timeline
            project={p}
            time={time}
            selected={selected}
            select={select}
            seek={seek}
            edit={edit}
          />
        </main>
        <Inspector
          project={p}
          index={selected}
          edit={edit}
          onCopy={() => {
            clipboard.current = structuredClone(p.moves[selected].effect);
            message("Move effect copied.");
          }}
          onPaste={() => {
            if (clipboard.current)
              edit("Paste effect", (p) => {
                p.moves[selected].effect = structuredClone(clipboard.current!);
              });
          }}
        />
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
          · {p.style.pieceSet === "merida" ? "Nibbler" : "Cburnett"}
        </span>
      </footer>
      {exportOpen && (
        <div className="modal-backdrop">
          <section className="export-dialog">
            <span className="eyebrow">RENDER YOUR COMPOSITION</span>
            <h2>Export MP4</h2>
            <p>{sizes[p.format].join(" × ")} · 60 FPS · H.264 + AAC</p>
            <Range
              label="Export start"
              value={rangeStart}
              min={0}
              max={Math.max(0, end - 0.1)}
              step={0.05}
              unit="s"
              onChange={setRangeStart}
            />
            <Range
              label="Export end"
              value={rangeEnd}
              min={Math.min(end, rangeStart + 0.1)}
              max={end}
              step={0.05}
              unit="s"
              onChange={setRangeEnd}
            />
            <p className="hint">
              Each frame is rendered from its exact timeline timestamp. Music
              and sound cues are mixed into the video.
            </p>
            {missing.size > 0 && (
              <p className="danger">
                Relink missing assets in Files before exporting.
              </p>
            )}
            {exportProgress && (
              <div className="export-progress">
                <progress
                  max={Math.max(1, exportProgress.total)}
                  value={exportProgress.done}
                />
                <p>
                  {exportProgress.phase} {exportProgress.done}/
                  {exportProgress.total}
                </p>
                {exportProgress.error && (
                  <p className="danger">{exportProgress.error}</p>
                )}
                {exportProgress.path && (
                  <p className="path">{exportProgress.path}</p>
                )}
              </div>
            )}
            <div className="button-row">
              {progressBusy ? (
                <button onClick={() => run(() => window.studio.cancelExport())}>
                  Cancel export
                </button>
              ) : (
                <>
                  <button onClick={() => setExportOpen(false)}>Close</button>
                  <button
                    className="primary"
                    disabled={
                      !settings.ffmpeg ||
                      missing.size > 0 ||
                      rangeEnd <= rangeStart
                    }
                    onClick={() =>
                      run(async () => {
                        const started = await window.studio.export(p, {
                          format: p.format,
                          start: rangeStart,
                          end: rangeEnd,
                        });
                        if (!started)
                          message("Export file selection cancelled.");
                      })
                    }
                  >
                    Choose output & render
                  </button>
                </>
              )}
            </div>
            {!settings.ffmpeg && (
              <p className="danger">
                Choose an FFmpeg executable in Files to enable export.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
