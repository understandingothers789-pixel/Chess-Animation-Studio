import { normalizeMusicRange } from "../core/audio/timing";
import { MoveFrames } from "./preview/MoveFrames";
import { TranscriptPanel } from "./captions/TranscriptPanel";
import { quickCaption } from "../core/transcripts";
import type { Annotation } from "../core/annotations";
import "./storyboard/storyboard.css";
import { StoryMusic } from "./storyboard/StoryMusic";
import { StorySourcePanel } from "./storyboard/StorySourcePanel";
import { StoryTimeline } from "./storyboard/StoryTimeline";
import { StoryTransport } from "./storyboard/StoryTransport";
import { ShotInspector } from "./storyboard/ShotInspector";
import {
  StoryThumbnails,
  type ThumbnailRenderer,
} from "./storyboard/thumbnails";
import {
  compileStoryboard,
  presentationDuration,
  resolveStoryboardFrame,
  shotFromMove,
} from "../core/storyboard";
import type { PlaybackMode } from "../core/project";
import { focusSetting } from "./focusSetting";
import { pasteSettings, type SettingsClipboard } from "../core/editing";
import { Transport } from "./transport/Transport";
import { ExportDialog } from "./export/ExportDialog";
import { AnnotationEditor } from "./annotations/AnnotationEditor";
import { annotation } from "../core/annotations";
import { PresetBrowser } from "./presets/PresetBrowser";
import { useWorkspace, WorkspaceBar, Splitter } from "./workspace/Workspace";
import { settingHelp } from "./help";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
} from "react";
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
} from "../core/project";
import {
  sample,
  buildGame,
  appendMove,
  legalMoves,
  selectLine,
} from "../core/chess";
import { duration, segments, stepFrame } from "../core/timeline";
import { activeBeats, updateMusicAnalysis } from "../core/beatMarkers";
import { syncMarkers } from "../core/audio";
import { analyzeMusicBuffer } from "./audio/analyzeMusic";
import { AudioPlayer } from "./audio";
import { StartingSquareMeme } from "./StartingSquareMeme";
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
  const [mode, setMode] = useState<PlaybackMode>("source");
  const modeRef = useRef<PlaybackMode>(mode);
  modeRef.current = mode;
  const sourceClock = useRef(0),
    storyClock = useRef(0);
  const [shotId, setShotId] = useState<string | null>(null),
    shotIdRef = useRef<string | null>(null);
  shotIdRef.current = shotId;
  const thumbnailPort = useRef<ThumbnailRenderer | null>(null);
  const thumbnails = useMemo(() => new StoryThumbnails(thumbnailPort), []);
  const workspace = useWorkspace();
  const layout = workspace.layout;
  const [inspectorRequest, setInspectorRequest] = useState<{
    section: string;
    version: number;
  } | null>(null);
  const [searchRequest, setSearchRequest] = useState(0);
  const [settingsRequest, setSettingsRequest] = useState<{
    category: string;
    section?: string;
    control?: string;
    serial: number;
  } | null>(null);
  const [memeMoveId, setMemeMoveId] = useState<string | null>(null);
  const memeDialog = useRef<HTMLDialogElement>(null);
  const memeIndex = memeMoveId
    ? p.moves.findIndex((m) => m.id === memeMoveId)
    : -1;
  useEffect(() => {
    const dialog = memeDialog.current;
    if (memeIndex >= 0 && dialog && !dialog.open) dialog.showModal();
  }, [memeIndex]);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [annotationFocus, setAnnotationFocus] = useState(0);
  const [annotationId, setAnnotationId] = useState<string | null>(null);
  const [annotationIds, setAnnotationIds] = useState<string[]>([]);
  useEffect(() => setAnnotationIds([]), [mode, shotId]);
  const [drawing, setDrawing] = useState<"arrow" | "circle" | null>(null);
  const annotationFrom = useRef<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<{
    project: Project;
    anchorMoveId: string;
    preview: Project;
    index: number;
  } | null>(null);
  const presetOrigin = useRef<number | null>(null);
  const [beforePreset, setBeforePreset] = useState(false);
  const [loopPreview, setLoopPreview] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [fps, setFps] = useState(() => {
    const saved = Number(localStorage.getItem("studio.exportFps"));
    return [24, 30, 60].includes(saved) ? saved : 60;
  });
  useEffect(() => localStorage.setItem("studio.exportFps", String(fps)), [fps]);

  const [videoImporting, setVideoImporting] = useState(false);
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
    [loadingAudio, setLoadingAudio] = useState(0);
  useLayoutEffect(() => {
    if (settingsRequest && tab === settingsRequest.category && !layout.hideLeft)
      focusSetting(
        document.querySelector(`[data-category="${settingsRequest.category}"]`),
        settingsRequest.section,
        settingsRequest.control,
      );
  }, [settingsRequest, tab, layout.hideLeft]);
  useLayoutEffect(() => {
    if (!annotationFocus || layout.hideRight) return;
    const drawer = document.querySelector<HTMLDetailsElement>(
      mode === "storyboard" ? ".story-annotation-editor" : ".annotation-drawer",
    );
    if (drawer) {
      drawer.open = true;
      const a = (
        mode === "storyboard"
          ? (p.storyboard.shots.find((s) => s.id === shotId)?.annotations ?? [])
          : p.annotations
      ).find((a) => a.id === annotationId);
      focusSetting(
        drawer,
        undefined,
        a?.kind === "text" || a?.kind === "caption"
          ? mode === "storyboard"
            ? "Shot caption"
            : "Annotation text"
          : "Annotation width",
      );
    }
  }, [annotationFocus, annotationId, layout.hideRight, mode, shotId]);
  useEffect(() => localStorage.setItem("studio.category", tab), [tab]);
  const matchingPreset =
    mode === "source" &&
    presetDraft?.project === p &&
    presetDraft.anchorMoveId === p.moves[selected]?.id
      ? presetDraft
      : null;
  const activePreset =
    tab === "presets" && !layout.hideLeft ? matchingPreset : null;
  const previewProject =
    activePreset && !beforePreset ? activePreset.preview : p;
  const previewProjectRef = useRef(previewProject);
  previewProjectRef.current = previewProject;
  const [audition, setAudition] = useState<{
    time: number;
    playing: boolean;
    end: number;
    loopStart?: number;
  } | null>(null);
  const latest = useRef(p),
    timeRef = useRef(time),
    audio = useRef<AudioPlayer | null>(null),
    saved = useRef(p),
    clipboard = useRef<SettingsClipboard | null>(null),
    assetKeys = useRef(new Map<string, { path: string; kind: string }>());
  const [assetRevision, setAssetRevision] = useState(0);
  const assetListKey = useMemo(
    () =>
      JSON.stringify(p.assets.map(({ id, path, kind }) => [id, path, kind])),
    [p.assets],
  );
  const [graphicsRevision, setGraphicsRevision] = useState(0);
  const moveFrames = useRef<HTMLDetailsElement>(null);
  const graphicsChanged = useCallback(
    () => setGraphicsRevision((value) => value + 1),
    [],
  );
  const previewAssets = useMemo(
    () =>
      Object.fromEntries(
        p.assets
          .filter((asset) => asset.kind !== "audio" && assets[asset.id])
          .map((asset) => [asset.id, assets[asset.id]]),
      ),
    [p.assets, assets],
  );
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
  const clearPresetPreview = useCallback(
    (restore = true) => {
      const origin = presetOrigin.current;
      presetOrigin.current = null;
      setPresetDraft(null);
      setBeforePreset(false);
      stop();
      if (origin !== null && restore) {
        sourceClock.current = origin;
        timeRef.current = origin;
        setTime(origin);
      }
    },
    [stop],
  );
  useLayoutEffect(() => {
    if (presetDraft && !activePreset) clearPresetPreview(!!matchingPreset);
  }, [presetDraft, activePreset, matchingPreset, clearPresetPreview]);
  const seek = useCallback(
    (t: number) => {
      stop();
      setPicked(null);
      const next = Math.max(
        0,
        Math.min(presentationDuration(latest.current, modeRef.current), t),
      );
      timeRef.current = next;
      setTime(next);
      if (modeRef.current === "storyboard") {
        storyClock.current = next;
        const id =
          resolveStoryboardFrame(latest.current, next)?.shot.id ?? null;
        shotIdRef.current = id;
        setShotId(id);
      } else sourceClock.current = next;
    },
    [stop],
  );
  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const mode = modeRef.current;
    const length = presentationDuration(previewProjectRef.current, mode);
    if (loadingAudio || length <= 0) return;
    const moveAudition = mode === "source" ? audition : null;
    if (mode === "storyboard") setAudition(null);
    if (timeRef.current >= (moveAudition?.end ?? length) - 0.001)
      seek(moveAudition?.loopStart ?? 0);
    setPlaying(true);
  }
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
      if (modeRef.current === "source") seek(seq[i].depart);
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
    const ids = new Set(p.moves.map((m) => m.id));
    setChecked((old) => {
      const kept = new Set([...old].filter((id) => ids.has(id)));
      return kept.size === old.size ? old : kept;
    });
  }, [p.id, p.line, p.moves.length]);
  useEffect(() => {
    let alive = true;
    let checkingAssets = false;
    for (const id of assetKeys.current.keys())
      if (!p.assets.some((a) => a.id === id)) {
        assetKeys.current.delete(id);
        audio.current?.clear(id);
        fingerprints.current.delete(id);
        setMissing((previous) => {
          if (!previous.has(id)) return previous;
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        setAssets((previous) => {
          if (!(id in previous)) return previous;
          const next = { ...previous };
          delete next[id];
          return next;
        });
      }
    for (const a of p.assets) {
      const previous = assetKeys.current.get(a.id);
      if (previous?.path === a.path && previous.kind === a.kind) continue;
      const request = { path: a.path, kind: a.kind };
      assetKeys.current.set(a.id, request);
      if (a.kind === "audio") {
        audio.current?.clear(a.id);
        setLoadingAudio((n) => n + 1);
      }
      run(async () => {
        try {
          const url = await window.studio.assetData(a);
          if (
            assetKeys.current.get(a.id) !== request ||
            !latest.current.assets.some(
              (v) => v.id === a.id && v.path === a.path && v.kind === a.kind,
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
            if (!buffer || assetKeys.current.get(a.id) !== request) return;
            if (
              latest.current.assets.some(
                (asset) => asset.id === a.id && asset.path === a.path,
              ) &&
              latest.current.music.asset === a.id &&
              latest.current.music.sourceDuration === 0
            ) {
              const analysis = await analyzeMusicBuffer(buffer);
              const current = latest.current;
              if (
                assetKeys.current.get(a.id) === request &&
                current.music.asset === a.id &&
                current.music.sourceDuration === 0
              )
                edit("Analyze imported music", (p) => {
                  p.music.sourceDuration = buffer.duration;
                  normalizeMusicRange(p.music);
                  updateMusicAnalysis(p, analysis);
                  p.beats = syncMarkers(p).beats;
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
          if (checkingAssets || latest.current.assets.length === 0) return;
          checkingAssets = true;
          try {
            const states = await window.studio.assetStatus(
              latest.current.assets,
            );
            if (!alive) return;
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
            const missingIds = new Set(ids);
            setMissing((previous) =>
              previous.size === missingIds.size &&
              ids.every((id) => previous.has(id))
                ? previous
                : missingIds,
            );
            for (const id of ids) {
              audio.current?.clear(id);
              assetKeys.current.delete(id);
            }
            if (ids.length)
              setAssets((previous) => {
                if (!ids.some((id) => id in previous)) return previous;
                const next = { ...previous };
                for (const id of ids) delete next[id];
                return next;
              });
          } finally {
            checkingAssets = false;
          }
        }),
      4000,
    );
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [assetListKey, assetRevision]);
  useEffect(() => {
    if (!playing) return;
    let alive = true,
      raf = 0;
    const start = timeRef.current;
    run(async () => {
      let origin: number | null;
      try {
        origin = await audio.current!.play(
          previewProjectRef.current,
          start,
          modeRef.current,
          playbackSpeed,
        );
      } catch (error) {
        if (!alive) return;
        stop();
        throw error;
      }
      if (!alive || origin === null) return;
      const startedAt = origin;
      const tick = () => {
        if (!alive) return;
        const t =
          start +
          Math.max(0, ((performance.now() - startedAt) / 1000) * playbackSpeed);
        if (audition && t >= audition.end) {
          if (loopPreview && audition.loopStart !== undefined) {
            timeRef.current = audition.loopStart;
            setTime(audition.loopStart);
            setAudition({ ...audition });
            return;
          }
          setTime(audition.time);
          timeRef.current = audition.time;
          setPlaying(audition.playing);
          setAudition(null);
          return;
        }
        if (
          t >= presentationDuration(previewProjectRef.current, modeRef.current)
        ) {
          setTime(
            presentationDuration(previewProjectRef.current, modeRef.current),
          );
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
  }, [playing, audition, mode, loopPreview, beforePreset, playbackSpeed]);
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
      mode,
      playing,
      assets: previewAssets,
    });
  }, [p, time, playing, previewAssets, mode]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        workspace.patch({ hideLeft: false });
        if (modeRef.current === "source" && tab === "presets") {
          if (presetOrigin.current !== null) clearPresetPreview();
          setTab("game");
        }
        setSearchRequest((n) => n + 1);
        return;
      }
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
      const buttonFocus = (e.target as HTMLElement).closest(
        "button,summary,[role=slider]",
      );
      if (e.code === "Space" && !buttonFocus) {
        e.preventDefault();
        togglePlayback();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        stop();
        setPicked(null);
        e.shiftKey ? redo() : undo();
      }
      if (
        e.shiftKey &&
        ["ArrowRight", "ArrowLeft"].includes(e.key) &&
        !buttonFocus
      ) {
        e.preventDefault();
        seek(stepFrame(timeRef.current, fps, e.key === "ArrowRight" ? 1 : -1));
        return;
      }
      if (
        modeRef.current === "storyboard" &&
        !buttonFocus &&
        ["ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const c = compileStoryboard(latest.current),
          at =
            resolveStoryboardFrame(latest.current, timeRef.current)?.index ?? 0;
        const target =
          c.shots[
            Math.max(
              0,
              Math.min(
                c.shots.length - 1,
                at + (e.key === "ArrowRight" ? 1 : -1),
              ),
            )
          ];
        if (target) seek(target.start);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        addToStoryboard();
        return;
      }
      if (e.key === "ArrowRight" && !buttonFocus)
        select(Math.min(latest.current.moves.length - 1, selected + 1));
      if (e.key === "ArrowLeft" && !buttonFocus)
        select(Math.max(0, selected - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selected,
    loadingAudio,
    checked,
    p,
    fps,
    playing,
    audition,
    tab,
    clearPresetPreview,
  ]);
  function adopted(project: Project, file: string | null) {
    stop();
    replace(project);
    setPath(file);
    setTime(0);
    sourceClock.current = 0;
    storyClock.current = 0;
    const nextMode: PlaybackMode = project.storyboard.shots.length
      ? "storyboard"
      : "source";
    setMode(nextMode);
    modeRef.current = nextMode;
    workspace.preset(nextMode === "storyboard" ? "Storyboard" : "Editing");
    setShotId(project.storyboard.shots[0]?.id ?? null);
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
      const snapshot = latest.current;
      const file = await window.studio.save(snapshot, as);
      if (file) {
        saved.current = snapshot;
        setDirty(latest.current !== snapshot);
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
    kind: Asset["kind"],
    use:
      | "music"
      | "sound"
      | "background"
      | "badge"
      | "player intro"
      | "square intro",
    badgeKind?: string,
    videoTrim?: Asset["videoTrim"],
  ) {
    const projectId = latest.current.id;
    const a = await window.studio.importAsset(kind, videoTrim);
    if (!a || latest.current.id !== projectId) return;
    stop();
    edit("Import " + use, (p) => {
      if (use === "square intro") {
        if (p.assets.length >= 150)
          throw Error("This project already has 150 local assets.");
        p.assets.push(a);
        p.squareIntro.asset = a.id;
        p.lead = Math.max(
          p.lead,
          p.squareIntro.hold +
            p.squareIntro.pullback +
            (p.playerIntro.enabled ? 2 : 0.25),
        );
        return;
      }
      if (use === "player intro") {
        const existing = p.assets.find(
          (asset) => asset.kind === a.kind && asset.path === a.path,
        );
        if (!existing && p.assets.length >= 150)
          throw Error("This project already has 150 local assets.");
        if (!existing) p.assets.push(a);
        p.playerIntro.asset = (existing ?? a).id;
        p.playerIntro.enabled = true;
        if (p.squareIntro.asset)
          p.lead = Math.max(
            p.lead,
            p.squareIntro.hold + p.squareIntro.pullback + 2,
          );
        else if (p.lead === 0) p.lead = 2;
        return;
      }
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
        p.waveformRms = [];
        p.ignoredMusicHits = [];
        p.beats = [];
        p.storyboard.beats = [];
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
    message("Analyzing stereo waveform and music hits…");
    const analysis = await analyzeMusicBuffer(buffer);
    if (
      latest.current.id !== snapshot.id ||
      latest.current.music.asset !== id ||
      audio.current?.buffers.get(id ?? "") !== buffer
    )
      return;
    let count: ReturnType<typeof activeBeats> = [];
    edit("Audio analysis", (p) => {
      p.music.sourceDuration = buffer.duration;
      normalizeMusicRange(p.music);
      updateMusicAnalysis(p, analysis);
      p.beats = syncMarkers(p).beats;
      count = activeBeats(p);
    });
    message(
      `Waveform ready. ${count.length} markers in range, including ${count.filter((b) => b.accent).length} strong hits.`,
    );
  }
  function showLine(next: Project, index: number, time: number) {
    stop();
    if (modeRef.current !== "source") switchMode("source", false);
    if (next !== p) replace(next);
    const id = next.moves[index]?.id;
    selectionAnchor.current = index;
    setSelected(index);
    setChecked(new Set(id ? [id] : []));
    setPicked(null);
    setDrawing(null);
    annotationFrom.current = null;
    setIntroSelected(false);
    sourceClock.current = time;
    timeRef.current = time;
    setTime(time);
  }
  function chooseLine(index: number) {
    run(async () => {
      const next = selectLine(latest.current, index);
      if (next === latest.current) return;
      const ply = Math.max(0, Math.min(selected, next.moves.length - 1));
      showLine(next, ply, segments(next)[ply]?.depart ?? 0);
      message(
        `Showing ${next.lines[index].name} · ${next.moves.length} moves.`,
      );
    });
  }
  function square(s: string) {
    stop();
    const nextUnfinished = segments(p).findIndex(
      (segment) => timeRef.current < segment.land,
    );
    const at = nextUnfinished < 0 ? p.moves.length - 1 : nextUnfinished - 1;
    if (picked && legalMoves(p, at, picked).some((to) => to === s)) {
      try {
        const next = appendMove(p, at, picked, s, promotion);
        const index = at + 1;
        showLine(next, index, segments(next)[index].end);
        message(
          next === p
            ? `Played ${next.moves[index].san} in ${next.lines[next.line].name}.`
            : next.line !== p.line
              ? `Showing ${next.lines[next.line].name}. Switch back using Game line above the board.`
              : `Added ${next.moves[index].san} to ${next.lines[next.line].name}.`,
        );
      } catch (error) {
        message((error as Error).message);
      }
      return;
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
  function switchMode(next: PlaybackMode, applyLayout = true) {
    if (next === modeRef.current) return;
    clearPresetPreview();
    setDrawing(null);
    annotationFrom.current = null;
    if (modeRef.current === "source") sourceClock.current = timeRef.current;
    else storyClock.current = timeRef.current;
    modeRef.current = next;
    setSearchRequest(0);
    setMode(next);
    if (applyLayout)
      workspace.preset(next === "storyboard" ? "Storyboard" : "Editing");
    const at = Math.min(
      presentationDuration(p, next),
      next === "storyboard" ? storyClock.current : sourceClock.current,
    );
    setTime(at);
    timeRef.current = at;
    if (next === "storyboard") {
      const id =
        resolveStoryboardFrame(p, at)?.shot.id ??
        p.storyboard.shots[0]?.id ??
        null;
      setShotId(id);
      shotIdRef.current = id;
    }
  }
  function selectVisualAnnotation(id: string, additive = false) {
    stop();
    const previous = annotationIds.length
      ? annotationIds
      : annotationId
        ? [annotationId]
        : [];
    const next = !id
      ? []
      : additive
        ? previous.includes(id)
          ? previous.filter((v) => v !== id)
          : [...previous, id]
        : [id];
    setAnnotationIds(next);
    setAnnotationId(next.at(-1) ?? "");
    if (!id) return;
    workspace.patch({ hideRight: false });
    requestAnimationFrame(() => {
      // Keep focus on the drag surface; reveal controls in the scrolling inspector.
      if (document.fullscreenElement) return;
      const drawer = document.querySelector<HTMLDetailsElement>(
        modeRef.current === "storyboard"
          ? ".story-annotation-editor"
          : ".annotation-drawer",
      );
      if (drawer) {
        drawer.open = true;
        drawer.querySelector("textarea")?.scrollIntoView({ block: "nearest" });
      }
    });
  }
  function previewStoryShot(id: string) {
    const entry = compileStoryboard(p).shots.find((s) => s.shot.id === id);
    if (!entry) return;
    seek(entry.start);
    setAudition({ time: entry.start, playing: false, end: entry.end });
    setPlaying(true);
  }
  function addToStoryboard(ids?: string[]) {
    const chosen =
      ids ??
      (checked.size
        ? p.moves.filter((m) => checked.has(m.id)).map((m) => m.id)
        : p.moves[selected]
          ? [p.moves[selected].id]
          : []);
    if (!chosen.length) {
      message("Choose source moves to add.");
      return;
    }
    if (p.storyboard.shots.length + chosen.length > 200) {
      message(
        "A storyboard supports up to 200 shots. Remove shots before adding more.",
      );
      return;
    }
    const shots = chosen.map((id) => shotFromMove(p, id));
    stop();
    edit.begin();
    try {
      edit("Add moves to storyboard", (d) => d.storyboard.shots.push(...shots));
    } finally {
      edit.end();
    }
    setShotId(shots[0].id);
    shotIdRef.current = shots[0].id;
    message(
      `${shots.length} ${shots.length === 1 ? "move" : "moves"} added to storyboard. Undo is available.`,
    );
  }
  function addPosition() {
    const sourceTime =
      modeRef.current === "storyboard"
        ? (resolveStoryboardFrame(p, timeRef.current)?.sourceTime ?? 0)
        : timeRef.current;
    const seq = segments(p);
    let index = -1;
    seq.forEach((s, i) => {
      if (s.land <= sourceTime) index = i;
    });
    const shot = shotFromMove(
      p,
      index < 0 ? "@start" : p.moves[index].id,
      "position-hold",
      index < 0 ? "before" : "after",
    );
    stop();
    edit.begin();
    try {
      edit("Add position hold", (d) => d.storyboard.shots.push(shot));
    } finally {
      edit.end();
    }
    setShotId(shot.id);
    shotIdRef.current = shot.id;
    message("Position hold added to storyboard.");
  }
  function openSource(index: number, play = false) {
    if (index === -1) {
      switchMode("source");
      selectIntro();
      return;
    }
    if (!p.moves[index]) return;
    switchMode("source");
    setSelected(index);
    setIntroSelected(false);
    const seg = segments(p)[index];
    seek(seg.start);
    if (play) {
      setAudition({ time: seg.start, playing: false, end: seg.end });
      setPlaying(true);
    }
  }
  const storyEdit = Object.assign(
    (label: string, fn: (draft: Project) => void) => {
      stop();
      edit(label, fn);
    },
    { begin: edit.begin, end: edit.end },
  );
  const annotationEdit = Object.assign(
    (label: string, fn: (draft: Project) => void) => {
      stop();
      edit(label, (d) => {
        if (modeRef.current === "source") {
          fn(d);
          return;
        }
        const target = resolveStoryboardFrame(d, timeRef.current)?.shot.id;
        const shot = d.storyboard.shots.find((s) => s.id === target);
        if (!shot) return;
        const view = {
          ...d,
          annotations: shot.annotations,
          moves: [],
          lead: 0,
          tail: shot.duration,
        };
        fn(view);
        shot.annotations = view.annotations;
      });
    },
    {
      begin: edit.begin,
      end: edit.end,
      annotations: (label: string, change: (layers: Annotation[]) => void) => {
        stop();
        const target =
          modeRef.current === "storyboard"
            ? resolveStoryboardFrame(p, timeRef.current)?.shot.id
            : undefined;
        if (modeRef.current === "storyboard" && !target) return;
        edit.annotations?.(label, change, target);
      },
    },
  );
  const story = mode === "storyboard" ? compileStoryboard(p) : null;
  const currentStory =
    mode === "storyboard" ? resolveStoryboardFrame(p, time) : null;
  const selectedShot =
    p.storyboard.shots.find((s) => s.id === shotId) ?? p.storyboard.shots[0];
  const currentAnnotations =
    mode === "storyboard"
      ? (currentStory?.shot.annotations ?? [])
      : p.annotations;
  const annotationTime =
    mode === "storyboard" ? (currentStory?.localTime ?? 0) : time;
  useEffect(() => {
    if (
      mode === "storyboard" &&
      timeRef.current > presentationDuration(p, mode)
    )
      seek(presentationDuration(p, mode));
    if (shotId && !p.storyboard.shots.some((s) => s.id === shotId))
      setShotId(p.storyboard.shots[0]?.id ?? null);
  }, [p.storyboard]);
  const addQuickCaption = () => {
    try {
      const length =
        modeRef.current === "storyboard"
          ? (currentStory?.shot.duration ?? 0)
          : presentationDuration(p, "source");
      const a = quickCaption(annotationTime, length);
      if (modeRef.current === "storyboard" && currentStory) {
        setShotId(currentStory.shot.id);
        shotIdRef.current = currentStory.shot.id;
      }
      annotationEdit("Add caption at playhead", (d) => d.annotations.push(a));
      selectVisualAnnotation(a.id);
      setAnnotationFocus((n) => n + 1);
    } catch (e) {
      message((e as Error).message);
    }
  };
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
    addToStoryboard,
    chooseLine,
  };
  function selectIntro() {
    workspace.patch({ hideRight: false });
    setIntroSelected(true);
    setChecked(new Set());
    seek(0);
  }
  function playPreset(
    draft: NonNullable<typeof presetDraft>,
    original: boolean,
  ) {
    const window = movePreviewWindow(original ? p : draft.preview, draft.index);
    if (!window) return;
    presetOrigin.current ??= timeRef.current;
    setIntroSelected(false);
    setBeforePreset(original);
    setAudition({
      time: presetOrigin.current,
      playing: false,
      end: window.end,
      loopStart: window.start,
    });
    timeRef.current = window.start;
    setTime(window.start);
    setPlaying(true);
  }
  function inspectMoveEffect(section: string) {
    workspace.patch({ hideRight: false });
    setIntroSelected(false);
    setInspectorRequest({ section, version: Date.now() });
  }
  function previewMove(index = selected, previewIntro = introSelected) {
    if (audition) {
      if (activePreset) {
        clearPresetPreview();
        return;
      }
      timeRef.current = audition.time;
      sourceClock.current = audition.time;
      setTime(audition.time);
      setPlaying(audition.playing);
      setAudition(null);
      return;
    }
    const segment =
      previewIntro && p.lead > 0
        ? { start: 0, end: p.lead }
        : movePreviewWindow(previewProject, index);
    if (!segment) return;
    setAudition({ time, playing, end: segment.end, loopStart: segment.start });
    setTime(segment.start);
    timeRef.current = segment.start;
    setPlaying(true);
  }
  function openExport() {
    clearPresetPreview();
    if (!progressBusy) setExportProgress(null);
    setExportOpen(true);
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
  const misalignedMoves = useMemo(() => {
    const seq = segments(p);
    const beats = new Map(activeBeats(p).map((b) => [b.id, b.time]));
    return p.moves.flatMap((m, i) =>
      m.effect.landingBeat &&
      (!beats.has(m.effect.landingBeat) ||
        Math.abs(beats.get(m.effect.landingBeat)! - seq[i].land) > 0.02)
        ? [i]
        : [],
    );
  }, [p]);
  const end = presentationDuration(p, mode),
    progressBusy =
      !!exportProgress &&
      !["Complete", "Failed", "Cancelled"].includes(exportProgress.phase);
  return (
    <div className="app-shell">
      {memeIndex >= 0 && (
        <dialog
          ref={memeDialog}
          className="meme-dialog"
          aria-labelledby="meme-dialog-heading"
          onClose={() => setMemeMoveId(null)}
        >
          <h2 id="meme-dialog-heading">
            Starting-square meme · {p.moves[memeIndex].san}
          </h2>
          <StartingSquareMeme
            standalone
            project={p}
            index={memeIndex}
            targets={[p.moves[memeIndex]]}
            segment={segments(p)[memeIndex]}
            edit={edit}
            images={previewAssets}
            run={run}
            seek={(time) => {
              setMemeMoveId(null);
              seek(time);
            }}
          />
          <button type="button" onClick={() => setMemeMoveId(null)}>
            Done
          </button>
        </dialog>
      )}
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
              setPicked(null);
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
              setPicked(null);
              redo();
            }}
          >
            <Redo2 size={16} />
          </button>
          <button onClick={() => run(() => window.studio.presentation())}>
            <Monitor size={15} /> Present
          </button>
          <button className="primary" onClick={openExport}>
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
      <WorkspaceBar
        workspace={workspace}
        onPreset={(name) => {
          if (name === "Storyboard") switchMode("storyboard", false);
          if (name === "Editing") switchMode("source", false);
        }}
      />
      <div className="composition-modebar">
        <div className="button-row" role="group" aria-label="Editing mode">
          <button
            aria-label="Full Game mode"
            aria-pressed={mode === "source"}
            onClick={() => switchMode("source")}
          >
            Full Game
          </button>
          <button
            aria-label="Storyboard mode"
            aria-pressed={mode === "storyboard"}
            onClick={() => switchMode("storyboard")}
          >
            Storyboard · {p.storyboard.shots.length} shots
          </button>
        </div>
        <small>
          {mode === "storyboard"
            ? "Output time · edited sequence"
            : "Source time · full legal game"}
        </small>
      </div>
      <div
        className={`workspace flexible ${mode === "storyboard" ? "storyboard-workspace" : ""} ${layout.compact ? "compact-nav" : ""} ${layout.hideLeft ? "left-hidden" : ""} ${layout.hideRight ? "right-hidden" : ""} ${layout.hideTimeline ? "timeline-hidden" : ""}`}
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
          {mode === "storyboard" && (
            <SettingsSearch
              mode={mode}
              focusRequest={searchRequest}
              navigate={setTab}
              revealInspector={() => workspace.patch({ hideRight: false })}
              selectIntro={selectIntro}
            />
          )}
          {mode === "storyboard" && (
            <StorySourcePanel
              p={p}
              selected={selected}
              checked={checked}
              select={select}
              setChecked={setChecked}
              add={addToStoryboard}
              openSource={openSource}
              hold={addPosition}
              audio={
                <StoryMusic
                  p={p}
                  edit={storyEdit}
                  time={time}
                  importMusic={() => run(() => importAsset("audio", "music"))}
                  analyze={() => run(analyzeMusic)}
                />
              }
            />
          )}

          <nav
            className="library-tabs"
            hidden={mode === "storyboard"}
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
          {mode !== "storyboard" && (
            <SettingsSearch
              mode={mode}
              focusRequest={searchRequest}
              navigate={setTab}
              revealInspector={(target) => {
                workspace.patch({ hideRight: false });
                if (target) {
                  setIntroSelected(false);
                  document
                    .querySelector<HTMLButtonElement>(
                      `.inspector .tabs button[data-tab="${target}"]`,
                    )
                    ?.click();
                }
              }}
              selectIntro={selectIntro}
            />
          )}
          <div
            className={
              "library-content" + (tab === "presets" ? " preset-drawer" : "")
            }
            hidden={mode === "storyboard"}
          >
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
                        disabled={!p.moves[selected]}
                        onClick={() => {
                          workspace.patch({ hideRight: false });
                          setIntroSelected(false);
                          setInspectorRequest({
                            section: "effects",
                            version: Date.now(),
                          });
                        }}
                      >
                        Edit selected move’s capture impact →
                      </button>
                    </>
                  )}
                  {category === "presets" ? (
                    <>
                      <button
                        className="preset-close"
                        onClick={() => {
                          clearPresetPreview();
                          setTab("game");
                        }}
                      >
                        Close animation library
                      </button>
                      <PresetBrowser
                        project={p}
                        index={selected}
                        checked={checked}
                        edit={edit}
                        previewActive={!!activePreset}
                        onPausePreview={stop}
                        report={message}
                        before={beforePreset}
                        onBefore={(original) => {
                          if (activePreset) playPreset(activePreset, original);
                        }}
                        onPreview={(effects, index) => {
                          const anchorMoveId = p.moves[selected]?.id;
                          if (!anchorMoveId || mode !== "source") return;
                          const draft = {
                            project: p,
                            anchorMoveId,
                            index,
                            preview: {
                              ...p,
                              moves: p.moves.map((m) => {
                                const effect = effects.get(m.id);
                                return effect ? { ...m, effect } : m;
                              }),
                            },
                          };
                          setPresetDraft(draft);
                          playPreset(draft, false);
                        }}
                        onFineTune={(ids, index, kind) => {
                          setSelected(index);
                          selectionAnchor.current = index;
                          setChecked(new Set(ids));
                          setTab("game");
                          inspectMoveEffect(
                            kind === "movement" || kind === "everything"
                              ? "move"
                              : kind,
                          );
                        }}
                        onCancel={clearPresetPreview}
                      />
                    </>
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
            {mode === "source" && p.lines.length > 1 && (
              <Select
                label="Game line"
                value={String(p.line)}
                options={p.lines.map(
                  (line, i) =>
                    [
                      String(i),
                      `${line.name} (${i === p.line ? p.moves.length : line.sans.length})`,
                    ] as const,
                )}
                onChange={(value) => chooseLine(Number(value))}
              />
            )}
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
              drawing={drawing !== null}
              mode={mode}
              thumbnailPort={thumbnailPort}
              onGraphicsChanged={graphicsChanged}
              onAddMove={() => addToStoryboard()}
              onAddPosition={addPosition}
              onPrepareShotEdit={(id, localTime) => {
                const entry = compileStoryboard(p).shots.find(
                  (s) => s.shot.id === id,
                );
                if (entry) {
                  shotIdRef.current = id;
                  setShotId(id);
                  seek(entry.start + localTime);
                }
              }}
              onReport={message}
              onPause={stop}
              edit={annotationEdit}
              selectedAnnotation={annotationId}
              selectedAnnotations={annotationIds}
              onAddCaption={addQuickCaption}
              onTranscript={() => {
                stop();
                setTranscriptOpen(true);
              }}
              onSelectAnnotation={selectVisualAnnotation}
              seek={seek}
              onEditAnnotation={(id) => {
                stop();
                setAnnotationId(id);
                setAnnotationIds([id]);
                workspace.patch({ hideRight: false });
                setAnnotationFocus((n) => n + 1);
              }}
              playing={playing}
              onToggle={togglePlayback}
              project={previewProject}
              time={time}
              assets={previewAssets}
              onCompositionPoint={(x, y) => {
                if (annotationIds.length > 1) {
                  message(
                    "Drag the selected group or use its layout toolbar. Select one layer for Alt-click placement.",
                  );
                  return;
                }
                const a = currentAnnotations.find((a) => a.id === annotationId);
                if (
                  a &&
                  !a.canvasLocked &&
                  (a.kind === "text" || a.kind === "caption")
                )
                  annotationEdit("Position annotation", (p) => {
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
                  setAnnotationIds([]);
                  annotationFrom.current = sq;
                  message(`Arrow from ${sq}: click destination; Esc cancels.`);
                } else {
                  setDrawing(null);
                  annotationFrom.current = null;
                  const localTime =
                    modeRef.current === "storyboard"
                      ? (resolveStoryboardFrame(p, timeRef.current)
                          ?.localTime ?? 0)
                      : timeRef.current;
                  const a = annotation(kind, localTime);
                  a.from = sq;
                  a.to = sq;
                  a.x = x;
                  a.y = y;
                  annotationEdit("Add board annotation", (p) => {
                    p.annotations.push(a);
                  });
                  setAnnotationId(a.id);
                  setAnnotationIds([a.id]);
                }
              }}
              onSquare={(sq) => {
                if (!drawing) {
                  if (mode === "storyboard") {
                    message(
                      "Use shot annotations to mark the board. Source moves are edited in Full Game mode.",
                    );
                    return;
                  }
                  square(sq);
                  return;
                }
                if (drawing === "arrow" && !annotationFrom.current) {
                  annotationFrom.current = sq;
                  message("Click the arrow destination square.");
                  return;
                }
                const existing = currentAnnotations.find(
                  (a) => a.id === annotationId && a.kind === drawing,
                );
                const a = existing
                  ? structuredClone(existing)
                  : annotation(drawing, annotationTime);
                a.from = annotationFrom.current ?? sq;
                a.to = sq;
                annotationEdit("Draw annotation", (p) => {
                  if (existing)
                    Object.assign(p.annotations.find((v) => v.id === a.id)!, a);
                  else p.annotations.push(a);
                });
                setAnnotationId(a.id);
                setAnnotationIds([a.id]);
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
              <span>
                {sizes[p.format].join(" × ")} · {fps} FPS
              </span>
            </div>
          </div>
          {mode === "source" && !p.moves.length && (
            <div className="source-empty">
              <span>
                Import a game, or click a piece and its destination to enter the
                first move.
              </span>
              <button
                type="button"
                onClick={() => {
                  workspace.patch({ hideLeft: false });
                  setTab("game");
                  requestAnimationFrame(() =>
                    focusSetting(
                      document.querySelector('[data-category="game"]'),
                      "Import a game",
                      "Game text",
                    ),
                  );
                }}
              >
                Import PGN or FEN
              </button>
            </div>
          )}
          {mode === "storyboard" ? (
            <StoryTransport
              p={p}
              time={time}
              playing={playing}
              toggle={togglePlayback}
              seek={seek}
              loading={loadingAudio}
            />
          ) : (
            <>
              {shotId && (
                <button onClick={() => switchMode("storyboard")}>
                  Return to storyboard shot
                </button>
              )}
              <div className="preview-edit-controls">
                {misalignedMoves.length > 0 && (
                  <button
                    onClick={() => {
                      select(misalignedMoves[0]);
                      setInspectorRequest({
                        section: "move",
                        version: Date.now(),
                      });
                    }}
                  >
                    Review {misalignedMoves.length} shifted beat alignment
                    {misalignedMoves.length === 1 ? "" : "s"}
                  </button>
                )}
                <button
                  disabled={
                    loadingAudio > 0 ||
                    (!p.moves.length && !(introSelected && p.lead))
                  }
                  onClick={() => previewMove()}
                >
                  {audition
                    ? "Restore timeline"
                    : introSelected
                      ? "Preview intro"
                      : "Preview this move"}
                </button>
                <label>
                  <input
                    type="checkbox"
                    aria-label="Loop selected move"
                    title="Repeat the selected move preview without changing project timing."
                    aria-description="Repeat the selected move preview without changing project timing."
                    checked={loopPreview}
                    onChange={(e) => setLoopPreview(e.target.checked)}
                  />{" "}
                  Loop
                </label>
                <label>
                  Speed{" "}
                  <select
                    aria-label="Playback speed"
                    title="Change preview video and audio speed together. Export uses project timing."
                    aria-description="Change preview video and audio speed together. Export uses project timing."
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(+e.target.value)}
                  >
                    {[0.25, 0.5, 1, 1.5, 2].map((v) => (
                      <option key={v} value={v}>
                        {v}×
                      </option>
                    ))}
                  </select>
                </label>
                {activePreset && (
                  <button
                    aria-pressed={beforePreset}
                    onClick={() => playPreset(activePreset, !beforePreset)}
                  >
                    {beforePreset ? "Show edited" : "Show original"}
                  </button>
                )}
              </div>
              {!introSelected && (
                <MoveFrames
                  panel={moveFrames}
                  project={previewProject}
                  index={activePreset?.index ?? selected}
                  onTune={activePreset ? undefined : inspectMoveEffect}
                  edit={edit}
                  time={time}
                  playing={playing}
                  fps={fps}
                  port={thumbnailPort}
                  seek={seek}
                  revision={graphicsRevision}
                />
              )}
              <Transport
                p={p}
                selected={selected}
                time={time}
                end={end}
                playing={playing}
                loadingAudio={loadingAudio}
                select={select}
                seek={seek}
                toggle={togglePlayback}
              />
            </>
          )}
          <Splitter
            label="Timeline height"
            vertical
            value={layout.timeline}
            min={120}
            max={520}
            onChange={(timeline) => workspace.patch({ timeline })}
          />
          {mode === "storyboard" ? (
            <StoryTimeline
              playShot={previewStoryShot}
              p={p}
              edit={storyEdit}
              selected={shotId}
              select={(id) => {
                setShotId(id);
                shotIdRef.current = id;
              }}
              seek={seek}
              openSource={openSource}
              exportStory={openExport}
              sourceIds={
                checked.size
                  ? p.moves.filter((m) => checked.has(m.id)).map((m) => m.id)
                  : p.moves[selected]
                    ? [p.moves[selected].id]
                    : []
              }
              report={message}
              time={time}
              thumbnails={thumbnails}
              graphicsRevision={graphicsRevision}
              playing={playing}
            />
          ) : (
            <Timeline
              fps={fps}
              addToStoryboard={addToStoryboard}
              contextSelect={contextSelect}
              clipboard={clipboard}
              report={message}
              preview={(index) => {
                setSelected(index);
                setIntroSelected(false);
                previewMove(index, false);
              }}
              navigate={(category, section, control) => {
                setTab(category);
                workspace.patch({ hideLeft: false });
                setSettingsRequest({
                  category,
                  section,
                  control,
                  serial: Date.now(),
                });
              }}
              inspect={(index, section, annotation) => {
                workspace.patch({ hideRight: false });
                if (section === "meme") {
                  const move = p.moves[index];
                  if (!move) return;
                  contextSelect(index);
                  setPicked(null);
                  setDrawing(null);
                  annotationFrom.current = null;
                  setMemeMoveId(move.id);
                } else if (section === "intro") {
                  selectIntro();
                } else if (section === "annotations") {
                  if (annotation) {
                    setAnnotationId(annotation);
                    setAnnotationIds([annotation]);
                  }
                  setAnnotationFocus((n) => n + 1);
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
          )}
        </main>
        <Splitter
          label="Right inspector width"
          value={layout.right}
          min={240}
          max={540}
          onChange={(right) => workspace.patch({ right })}
        />
        <div className="inspector-host">
          {mode === "storyboard" ? (
            <ShotInspector
              p={p}
              id={selectedShot?.id ?? null}
              edit={storyEdit}
              sourceId={p.moves[selected]?.id ?? null}
              openSource={openSource}
              previewTransition={(id) => {
                const e = compileStoryboard(p).shots.find(
                  (e) => e.shot.id === id,
                );
                if (!e) return;
                stop();
                seek(Math.max(0, e.start - 0.35));
                setPlaying(true);
                setAudition({
                  time: Math.max(0, e.start - 0.35),
                  playing: false,
                  end: Math.min(
                    e.end,
                    e.start + e.shot.transition.duration + 0.35,
                  ),
                });
              }}
              preview={previewStoryShot}
              annotationId={annotationId}
              annotationIds={annotationIds}
              setAnnotationId={selectVisualAnnotation}
              draw={(kind) => {
                const entry = compileStoryboard(p).shots.find(
                  (s) => s.shot.id === shotId,
                );
                if (entry) seek(entry.start);
                setDrawing(kind);
                annotationFrom.current = null;
              }}
            />
          ) : (
            <>
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
                  selectedIds={annotationIds}
                  onSelect={selectVisualAnnotation}
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
                <IntroInspector
                  project={p}
                  edit={edit}
                  images={previewAssets}
                  missing={missing}
                  importPhoto={() =>
                    run(() => importAsset("image", "player intro"))
                  }
                  videoImporting={videoImporting}
                  importVideo={(trim) =>
                    run(async () => {
                      if (videoImporting) return;
                      setVideoImporting(true);
                      try {
                        if (!settings.ffmpeg) {
                          const next = await window.studio.tool("ffmpeg");
                          setSettings(next);
                          if (!next.ffmpeg) return;
                        }
                        await importAsset(
                          "filmstrip",
                          "square intro",
                          undefined,
                          trim,
                        );
                      } finally {
                        setVideoImporting(false);
                      }
                    })
                  }
                  previewIntro={() => {
                    seek(0);
                    setAudition({ time, playing, end: p.lead });
                    setPlaying(true);
                  }}
                />
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
                    images={previewAssets}
                    run={run}
                    project={p}
                    checked={checked}
                    index={selected}
                    edit={edit}
                    onPausePreview={stop}
                    onInspectFrames={() => {
                      const panel = moveFrames.current;
                      if (!panel) return;
                      panel.open = true;
                      panel
                        .querySelector("summary")
                        ?.focus({ preventScroll: true });
                      panel.scrollIntoView({ block: "nearest" });
                    }}
                    onBrowsePresets={() => {
                      workspace.patch({ hideLeft: false });
                      setTab("presets");
                    }}
                    time={time}
                    fps={fps}
                    seek={seek}
                    onGlobalEffects={() => {
                      workspace.patch({ hideLeft: false });
                      setTab("effects");
                    }}
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
            </>
          )}
        </div>
      </div>
      <footer className={"status-bar " + (error ? "error" : "")}>
        <span aria-live="polite">
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
              : p.style.pieceSet === "sculpted"
                ? "Sculpted 3D"
                : "Cburnett"}
        </span>
      </footer>
      {transcriptOpen && (
        <TranscriptPanel
          p={p}
          mode={mode}
          time={time}
          playing={playing}
          edit={edit}
          settings={settings}
          setSettings={setSettings}
          seek={seek}
          toggle={togglePlayback}
          addCaption={addQuickCaption}
          importAudio={() => importAsset("audio", "music")}
          close={() => setTranscriptOpen(false)}
        />
      )}
      {exportOpen && (
        <ExportDialog
          project={p}
          mode={mode}
          index={selected}
          settings={settings}
          missingIds={missing}
          progress={exportProgress}
          fps={fps}
          setFps={setFps}
          close={() => setExportOpen(false)}
          cancel={() => run(() => window.studio.cancelExport())}
          chooseFFmpeg={async () =>
            setSettings(await window.studio.tool("ffmpeg"))
          }
          relinkAssets={() => {
            setExportOpen(false);
            switchMode("source");
            workspace.patch({ hideLeft: false });
            setTab("files");
          }}
          previewPort={thumbnailPort}
          graphicsRevision={graphicsRevision}
          render={(options) => window.studio.export(p, options)}
        />
      )}
    </div>
  );
}
