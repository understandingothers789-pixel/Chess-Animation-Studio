import {
  arrangeTextGroup,
  groupMembers,
  type GroupAction,
} from "../core/captions/groups";
import { TextComposition, type TextBounds } from "./captions/TextComposition";
import { CaptionGuide } from "./captions/CaptionGuide";
import { compileStoryboard, resolveStoryboardFrame } from "../core/storyboard";
import type { PlaybackMode } from "../core/project";
import type { ThumbnailPort } from "./storyboard/thumbnails";
import {
  annotationCommands,
  type AnnotationStyle,
} from "./commands/annotationCommands";
import type { Edit } from "./state";
import { TimelineMenu, type MenuAction } from "./timeline/TimelineMenu";
import { positionFen } from "./preview/positionFen";
import { segments } from "../core/timeline";
import { ViewportTools, initialViewport } from "./preview/ViewportTools";
import { useCallback, useEffect, useRef, useState } from "react";
import { Scene, ContextLostError } from "../render/Scene";
import { sizes, type Project } from "../core/project";
export function Preview({
  project,
  mode = "source",
  drawing = false,
  thumbnailPort,
  onGraphicsChanged,
  onAddCaption,
  onTranscript,
  onAddMove,
  onAddPosition,
  onPrepareShotEdit,
  time,
  assets,
  onSquare,
  onError,
  onCompositionPoint,
  playing,
  onToggle,
  onContextAnnotation,
  onReport,
  onPause,
  edit,
  onEditAnnotation,
  selectedAnnotation,
  selectedAnnotations = [],
  onSelectAnnotation,
  seek,
}: {
  project: Project;
  mode?: PlaybackMode;
  drawing?: boolean;
  thumbnailPort?: ThumbnailPort;
  onGraphicsChanged: () => void;
  onAddCaption?: () => void;
  onTranscript?: () => void;
  onAddMove?: () => void;
  onAddPosition?: () => void;
  onPrepareShotEdit?: (id: string, localTime: number) => void;
  time: number;
  assets: Record<string, string>;
  onSquare: (square: string) => void;
  onReport?: (message: string) => void;
  onPause?: () => void;
  edit?: Edit;
  onEditAnnotation?: (id: string) => void;
  selectedAnnotation?: string | null;
  selectedAnnotations?: string[];
  onSelectAnnotation?: (id: string, additive?: boolean) => void;
  seek?: (time: number) => void;
  onError: (message: string) => void;
  onContextAnnotation?: (
    square: string,
    kind: "arrow" | "circle" | "text",
    x: number,
    y: number,
  ) => void;
  playing?: boolean;
  onToggle?: () => void;
  onCompositionPoint?: (x: number, y: number) => void;
}) {
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    square: string | null;
    annotation?: string | null;
    storyTime?: number;
    px: number;
    py: number;
  } | null>(null);
  const annotationStyle = useRef<AnnotationStyle | null>(null);
  const [textBounds, setTextBounds] = useState<TextBounds[]>([]);
  const geometryKey = useRef("");
  const [captionGuides, setCaptionGuides] = useState(false);
  const [view, setView] = useState(initialViewport);
  const panDrag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const update = () =>
      setFullscreen(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const fit = () =>
    setView((v) => ({ ...v, zoom: 1, offset: { x: 0, y: 0 }, pan: false }));
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "f" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      ) {
        e.preventDefault();
        setView((v) => ({ ...v, zoom: 1, offset: { x: 0, y: 0 }, pan: false }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    scene = useRef<Scene | null>(null),
    latest = useRef({ project, time, mode, playing }),
    [ready, setReady] = useState(false),
    [assetFailed, setAssetFailed] = useState(false),
    [retry, setRetry] = useState(0),
    [generation, setGeneration] = useState(0),
    [graphicsFailed, setGraphicsFailed] = useState(false);
  latest.current = { project, time, mode, playing };
  const queueDraw = useRef<() => void>(() => {});
  const reportError = useRef(onError);
  reportError.current = onError;
  const click = useRef(onSquare);
  click.current = onSquare;
  useEffect(() => {
    setReady(false);
    const element = canvas.current;
    const container = host.current;
    if (!element || !container) return;
    let renderer: Scene;
    try {
      renderer = new Scene(element);
    } catch (error) {
      reportError.current((error as Error).message);
      setGraphicsFailed(true);
      return;
    }
    setGraphicsFailed(false);
    scene.current = renderer;
    let alive = true;
    let frame: number | null = null;
    let available = false;
    let renderError = "";
    const draw = () => {
      frame = null;
      if (!alive || !available) return;
      const { project, time, mode } = latest.current;
      const [w, h] = sizes[project.format];
      const scale = Math.min(
        container.clientWidth / w,
        container.clientHeight / h,
      );
      const width = Math.max(2, Math.floor(w * scale));
      const height = Math.max(2, Math.floor(h * scale));
      const viewport = element.parentElement!;
      viewport.style.width = element.style.width = width + "px";
      viewport.style.height = element.style.height = height + "px";
      try {
        renderer.render(
          project,
          time,
          Math.round(width * devicePixelRatio),
          Math.round(height * devicePixelRatio),
          project.format,
          mode,
        );
        const bounds = renderer.textGeometry(),
          key = JSON.stringify(bounds);
        if (geometryKey.current !== key) {
          geometryKey.current = key;
          setTextBounds(bounds);
        }
        renderError = "";
      } catch (error) {
        if (error instanceof ContextLostError) {
          available = false;
          setGraphicsFailed(true);
        }
        const message = (error as Error).message;
        if (message !== renderError) reportError.current(message);
        renderError = message;
      }
    };
    const schedule = () => {
      if (alive && available && frame === null)
        frame = requestAnimationFrame(draw);
    };
    queueDraw.current = schedule;
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    window.addEventListener("resize", schedule);
    element.addEventListener("webglcontextlost", schedule);
    void renderer.ready
      .then(() => {
        if (!alive) return;
        available = true;
        setReady(true);
        schedule();
        onGraphicsChanged();
      })
      .catch((error) => {
        if (alive) reportError.current(error.message);
      });
    return () => {
      alive = false;
      if (frame !== null) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      element.removeEventListener("webglcontextlost", schedule);
      queueDraw.current = () => {};
      scene.current = null;
      requested.current.clear();
      renderer.dispose();
    };
  }, [generation, onGraphicsChanged]);
  useEffect(() => {
    queueDraw.current();
  }, [project, time, mode]);

  // Snapshot on the live canvas, then immediately restore its render and picking state.
  const snapshot = useCallback(
    (p: Project, time: number, w: number, h: number, mode: PlaybackMode) => {
      const renderer = scene.current,
        element = canvas.current;
      if (!renderer || !element) return null;
      const current = latest.current;
      const { width, height } = element;
      try {
        renderer.render(p, time, w, h, p.format, mode);
        return element.toDataURL("image/png");
      } finally {
        renderer.render(
          current.project,
          current.time,
          width,
          height,
          current.project.format,
          current.mode,
        );
      }
    },
    [],
  );
  useEffect(() => {
    if (!thumbnailPort || !ready || graphicsFailed) return;
    thumbnailPort.current = (p, time, w, h, mode = "storyboard") =>
      latest.current.playing ? null : snapshot(p, time, w, h, mode);
    return () => {
      thumbnailPort.current = null;
    };
  }, [ready, graphicsFailed, thumbnailPort, generation, snapshot]);
  const requested = useRef(new Set<string>());
  useEffect(() => {
    const renderer = scene.current;
    if (!renderer || !ready || graphicsFailed) return;
    let removed = false;
    for (const id of requested.current)
      if (!assets[id]) {
        renderer.removeAsset(id);
        requested.current.delete(id);
        removed = true;
      }
    if (removed) {
      queueDraw.current();
      onGraphicsChanged();
    }
    setAssetFailed(false);
    let active = true;
    const loads = Object.entries(assets).flatMap(([id, url]) => {
      requested.current.add(id);
      const current = renderer.assetState(id);
      if (current?.state === "ready" && current.url === url) return [];
      return [
        renderer
          .setAsset(id, url, { retries: 2 })
          .then(() => {
            if (active) queueDraw.current();
          })
          .catch((error) => {
            if (active) {
              setAssetFailed(true);
              reportError.current(error.message);
            }
          }),
      ];
    });
    if (loads.length)
      void Promise.all(loads).then(() => {
        if (active) onGraphicsChanged();
      });
    return () => {
      active = false;
    };
  }, [assets, ready, graphicsFailed, retry, onGraphicsChanged]);
  const saveFrame = () => {
    try {
      if (!ready || graphicsFailed) throw Error("Preview is still preparing.");
      const { project, time, mode } = latest.current,
        [w, h] = sizes[project.format];
      const image = snapshot(project, time, w, h, mode);
      if (!image) throw Error("Preview is still preparing.");
      const link = document.createElement("a");
      link.download = `${project.title}-frame.png`;
      link.href = image;
      link.click();
      onReport?.("PNG download started.");
    } catch (error) {
      onError(`Could not save PNG: ${(error as Error).message}`);
    }
  };
  const full = () => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : shell.current?.requestFullscreen();
    void action?.catch(() => onError("Could not change full preview mode."));
  };
  const copyFen = async () => {
    try {
      const { project, time } = latest.current;
      const resolved =
        mode === "storyboard" ? resolveStoryboardFrame(project, time) : null;
      const fen = positionFen(project, resolved?.sourceTime ?? time);
      await navigator.clipboard.writeText(fen);
      onReport?.("FEN copied");
    } catch {
      onError("Could not copy FEN to clipboard.");
    }
  };
  const viewportActions: MenuAction[] = [
    { id: "preview.fit", label: "Fit preview", run: fit },
    { id: "preview.reset", label: "Reset preview zoom / pan", run: fit },
    {
      id: "preview.guides",
      label: "Framing guides",
      children: ["none", "center", "thirds", "safe", "shorts"].map((g) => ({
        id: g,
        label:
          g === "none"
            ? "Hide guides"
            : `${g[0].toUpperCase() + g.slice(1)} guides`,
        checked: view.guides === g,
        run: () => setView((v) => ({ ...v, guides: g })),
      })),
    },
    {
      id: "preview.png",
      label: "Save current frame as PNG",
      run: saveFrame,
      separatorBefore: true,
    },
    {
      disabled:
        mode === "storyboard" &&
        resolveStoryboardFrame(project, time)?.shot.kind === "title-card",
      id: "preview.fen",
      label: "Copy position FEN",
      run: () => {
        void copyFen();
      },
    },
    {
      id: "preview.full",
      label: fullscreen ? "Exit full preview" : "Enter full preview",
      run: full,
    },
  ];
  const storyFrame =
    mode === "storyboard"
      ? resolveStoryboardFrame(project, menu?.storyTime ?? time)
      : null;
  const prepareAnnotation = () => {
    onPause?.();
    if (storyFrame)
      onPrepareShotEdit?.(storyFrame.shot.id, storyFrame.localTime);
  };
  const annotationProject = storyFrame
    ? {
        ...project,
        annotations: storyFrame.shot.annotations,
        moves: [],
        lead: 0,
        tail: storyFrame.shot.duration,
      }
    : project;
  const groupIds = selectedAnnotations.length
    ? selectedAnnotations
    : selectedAnnotation
      ? [selectedAnnotation]
      : [];
  const groupReady = !!groupMembers(
    annotationProject.annotations,
    textBounds,
    groupIds,
  );
  const arrange = (action: GroupAction) => {
    const positions = arrangeTextGroup(
      annotationProject.annotations,
      textBounds,
      groupIds,
      action,
      project.format,
    );
    if (!positions || !edit) {
      onReport?.(
        "Group layout needs visible, unlocked local text with enough room inside its safe areas.",
      );
      return;
    }
    prepareAnnotation();
    edit.begin();
    const change = (layers: import("../core/annotations").Annotation[]) => {
      for (const pos of positions) {
        const a = layers.find((a) => a.id === pos.id);
        if (a) Object.assign(a, { x: pos.x, y: pos.y });
      }
    };
    try {
      if (edit.annotations) edit.annotations("Arrange text group", change);
      else edit("Arrange text group", (p) => change(p.annotations));
    } finally {
      edit.end();
    }
  };
  const boardActions: MenuAction[] =
    menu?.annotation && edit
      ? [
          ...annotationCommands(
            annotationProject,
            menu.annotation,
            storyFrame ? -1 : segments(project).findIndex((s) => s.end >= time),
            storyFrame?.localTime ?? time,
            Object.assign(
              (label: string, change: (p: Project) => void) => {
                prepareAnnotation();
                edit(label, change);
              },
              { begin: edit.begin, end: edit.end },
            ),
            (_i, _s, id) => {
              prepareAnnotation();
              if (id) onEditAnnotation?.(id);
            },
            (t) => seek?.((storyFrame?.start ?? 0) + t),
            annotationStyle,
          ),
          ...viewportActions,
        ]
      : menu?.square
        ? [
            {
              id: "board.arrow",
              label: `Draw arrow from ${menu.square}…`,
              run: () => {
                prepareAnnotation();
                onContextAnnotation?.(menu.square!, "arrow", menu.px, menu.py);
              },
            },
            {
              id: "board.circle",
              label: "Highlight square / add circle",
              run: () => {
                prepareAnnotation();
                onContextAnnotation?.(menu.square!, "circle", menu.px, menu.py);
              },
            },
            {
              id: "board.text",
              label: "Add text callout…",
              run: () => {
                prepareAnnotation();
                onContextAnnotation?.(menu.square!, "text", menu.px, menu.py);
              },
            },
            {
              id: "board.fen",
              label: "Copy position FEN",
              run: () => {
                void copyFen();
              },
              separatorBefore: true,
            },
            { id: "board.png", label: "Capture current frame", run: saveFrame },
            {
              id: "board.view",
              label: "Preview view",
              children: viewportActions.filter(
                (a) => !a.id?.endsWith("fen") && !a.id?.endsWith("png"),
              ),
            },
          ]
        : viewportActions;
  if (mode === "source") {
    if (onAddMove)
      boardActions.push({
        id: "story.add-move",
        label: "Add selected move to storyboard",
        run: onAddMove,
        separatorBefore: true,
      });
    if (onAddPosition)
      boardActions.push({
        id: "story.add-position",
        label: "Add current position to storyboard",
        run: onAddPosition,
      });
  }
  return (
    <div className="preview-shell" ref={shell}>
      {menu && (
        <TimelineMenu
          x={menu.x}
          y={menu.y}
          title={
            menu.annotation
              ? "Annotation"
              : menu.square
                ? `Square ${menu.square}`
                : "Preview view"
          }
          actions={boardActions}
          close={() => setMenu(null)}
          execute={(run) => {
            edit?.begin();
            try {
              run();
            } finally {
              edit?.end();
            }
          }}
        />
      )}
      <ViewportTools
        addCaption={onAddCaption}
        transcript={onTranscript}
        captionGuides={captionGuides}
        onCaptionGuides={() => setCaptionGuides((v) => !v)}
        fullscreen={fullscreen}
        playing={playing}
        toggle={onToggle}
        view={view}
        set={(patch) => setView((v) => ({ ...v, ...patch }))}
        fit={fit}
        full={full}
        png={saveFrame}
      />
      {groupIds.length > 1 && (
        <div
          className="text-group-tools"
          role="toolbar"
          aria-label="Text group layout"
        >
          <span>{groupIds.length} text layers selected</span>
          {(
            [
              ["left", "Align left"],
              ["center", "Align horizontal centers"],
              ["right", "Align right"],
              ["top", "Align top"],
              ["middle", "Align vertical centers"],
              ["bottom", "Align bottom"],
              ["distribute-x", "Distribute horizontally"],
              ["distribute-y", "Distribute vertically"],
            ] as [GroupAction, string][]
          ).map(([action, label]) => (
            <button
              key={action}
              disabled={
                !groupReady ||
                !!playing ||
                (action.startsWith("distribute") && groupIds.length < 3)
              }
              onClick={() => arrange(action)}
            >
              {label}
            </button>
          ))}
          {!groupReady && (
            <span>
              Show and unlock selected layers at the current time to arrange
              them.
            </span>
          )}
        </div>
      )}
      <div
        className="preview-host"
        ref={host}
        onContextMenu={(e) => {
          e.preventDefault();
          const r = canvas.current?.getBoundingClientRect();
          if (!r) return;
          const keyboard = e.button !== 2 && e.clientX === 0 && e.clientY === 0;
          const cx = keyboard ? r.left + r.width / 2 : e.clientX,
            cy = keyboard ? r.top + r.height / 2 : e.clientY;
          const square = scene.current?.pick(cx, cy) ?? null,
            annotation = scene.current?.pickAnnotation(cx, cy);
          setMenu({
            storyTime: mode === "storyboard" ? time : undefined,
            x: cx,
            y: cy,
            square,
            annotation,
            px: Math.max(0, Math.min(1, (cx - r.left) / r.width)),
            py: Math.max(0, Math.min(1, (cy - r.top) / r.height)),
          });
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            setView((v) => ({
              ...v,
              zoom: Math.max(
                0.25,
                Math.min(4, v.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)),
              ),
            }));
          }
        }}
        onPointerDown={(e) => {
          if ((view.pan && e.button === 0) || e.button === 1) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            panDrag.current = {
              x: e.clientX,
              y: e.clientY,
              ox: view.offset.x,
              oy: view.offset.y,
            };
          }
        }}
        onPointerMove={(e) => {
          const d = panDrag.current;
          if (d)
            setView((v) => ({
              ...v,
              offset: { x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y },
            }));
        }}
        onPointerUp={() => {
          panDrag.current = null;
        }}
        onLostPointerCapture={() => {
          panDrag.current = null;
        }}
      >
        <div
          className="composition-viewport"
          style={{
            transform: `translate(${view.offset.x}px,${view.offset.y}px) scale(${view.zoom})`,
          }}
        >
          <canvas
            key={generation}
            aria-label="Chess composition preview"
            ref={canvas}
            data-drawing={drawing || undefined}
            tabIndex={0}
            onClick={(e) => {
              if (e.altKey) {
                const r = e.currentTarget.getBoundingClientRect();
                onCompositionPoint?.(
                  Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                  Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
                );
                return;
              }
              if (view.pan || e.button === 1) return;
              onSelectAnnotation?.("");
              const square = scene.current?.pick(e.clientX, e.clientY);
              if (square) click.current(square);
            }}
          />
          <TextComposition
            format={project.format}
            bounds={textBounds}
            annotations={annotationProject.annotations}
            selected={selectedAnnotation ?? null}
            selectedIds={groupIds}
            disabled={view.pan || !!playing}
            select={(id, additive) => {
              prepareAnnotation();
              onSelectAnnotation?.(id, additive);
            }}
            prepare={prepareAnnotation}
            edit={edit}
            report={onReport}
          />
          <CaptionGuide
            enabled={captionGuides}
            a={
              annotationProject.annotations.find(
                (a) => a.id === selectedAnnotation,
              ) ??
              annotationProject.annotations.find(
                (a) => a.kind === "caption" || a.kind === "text",
              )
            }
            format={project.format}
            edit={groupIds.length > 1 ? undefined : edit}
            prepare={prepareAnnotation}
          />
          {view.guides !== "none" && (
            <div
              className={`framing-guides guide-${view.guides}`}
              aria-label="Editor framing guides"
            >
              <i />
              <i />
              <i />
              <i />
              {view.guides === "shorts" && (
                <span>
                  Approximate social UI safe area · varies by platform
                </span>
              )}
            </div>
          )}
        </div>
        {graphicsFailed && (
          <button onClick={() => setGeneration((value) => value + 1)}>
            Reload graphics
          </button>
        )}
        {assetFailed && (
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry images
          </button>
        )}
        {!ready && !graphicsFailed && (
          <div className="loading">Preparing vector pieces…</div>
        )}
      </div>
    </div>
  );
}
