import {
  annotationCommands,
  type AnnotationStyle,
} from "./commands/annotationCommands";
import type { Edit } from "./state";
import { TimelineMenu, type MenuAction } from "./timeline/TimelineMenu";
import { positionFen } from "./preview/positionFen";
import { segments } from "../core/timeline";
import { ViewportTools, initialViewport } from "./preview/ViewportTools";
import { useEffect, useRef, useState } from "react";
import { Scene, ContextLostError } from "../render/Scene";
import { sizes, type Project } from "../core/project";
export function Preview({
  project,
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
  seek,
}: {
  project: Project;
  time: number;
  assets: Record<string, string>;
  onSquare: (square: string) => void;
  onReport?: (message: string) => void;
  onPause?: () => void;
  edit?: Edit;
  onEditAnnotation?: (id: string) => void;
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
    px: number;
    py: number;
  } | null>(null);
  const annotationStyle = useRef<AnnotationStyle | null>(null);
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
    latest = useRef({ project, time }),
    [ready, setReady] = useState(false),
    [assetFailed, setAssetFailed] = useState(false),
    [retry, setRetry] = useState(0),
    [generation, setGeneration] = useState(0),
    [graphicsFailed, setGraphicsFailed] = useState(false);
  latest.current = { project, time };
  const click = useRef(onSquare);
  click.current = onSquare;
  useEffect(() => {
    setReady(false);
    let s: Scene;
    try {
      s = new Scene(canvas.current!);
    } catch (error) {
      onError((error as Error).message);
      setGraphicsFailed(true);
      return;
    }
    setGraphicsFailed(false);
    scene.current = s;
    let alive = true,
      frame = 0,
      available = false,
      renderError = "";
    void s.ready
      .then(() => {
        if (alive) {
          available = true;
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) onError(e.message);
      });
    const draw = () => {
      if (alive && available && host.current) {
        const { project, time } = latest.current,
          [w, h] = sizes[project.format],
          scale = Math.min(
            host.current.clientWidth / w,
            host.current.clientHeight / h,
          ),
          width = Math.max(2, Math.floor(w * scale)),
          height = Math.max(2, Math.floor(h * scale));
        canvas.current!.parentElement!.style.width = width + "px";
        canvas.current!.parentElement!.style.height = height + "px";
        canvas.current!.style.width = width + "px";
        canvas.current!.style.height = height + "px";
        try {
          s.render(
            project,
            time,
            Math.round(width * devicePixelRatio),
            Math.round(height * devicePixelRatio),
          );
          renderError = "";
        } catch (error) {
          if (error instanceof ContextLostError) {
            available = false;
            setGraphicsFailed(true);
          }
          const message = (error as Error).message;
          if (message !== renderError) onError(message);
          renderError = message;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      scene.current = null;
      requested.current.clear();
      s.dispose();
    };
  }, [generation]);
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!scene.current) return;
    for (const id of requested.current)
      if (!assets[id]) {
        scene.current.removeAsset(id);
        requested.current.delete(id);
      }
    setAssetFailed(false);
    let active = true;
    for (const [id, url] of Object.entries(assets)) {
      requested.current.add(id);
      void scene.current.setAsset(id, url, { retries: 2 }).catch((e) => {
        if (active) {
          setAssetFailed(true);
          onError(e.message);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [assets, ready, retry]);
  const saveFrame = () => {
    try {
      if (!scene.current || !ready || !canvas.current)
        throw Error("Preview is still preparing.");
      // Snapshot a single evaluated frame before asking the browser to save it.
      const { project, time } = latest.current,
        [w, h] = sizes[project.format];
      scene.current.render(project, time, w, h);
      const link = document.createElement("a");
      link.download = `${project.title}-frame.png`;
      link.href = canvas.current.toDataURL("image/png");
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
      const fen = positionFen(project, time);
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
  const boardActions: MenuAction[] =
    menu?.annotation && edit
      ? [
          ...annotationCommands(
            project,
            menu.annotation,
            segments(project).findIndex((s) => s.end >= time),
            time,
            Object.assign(
              (label: string, change: (p: Project) => void) => {
                onPause?.();
                edit(label, change);
              },
              { begin: edit.begin, end: edit.end },
            ),
            (_i, _s, id) => {
              onPause?.();
              if (id) onEditAnnotation?.(id);
            },
            (t) => seek?.(t),
            annotationStyle,
          ),
          ...viewportActions,
        ]
      : menu?.square
        ? [
            {
              id: "board.arrow",
              label: `Draw arrow from ${menu.square}…`,
              run: () =>
                onContextAnnotation?.(menu.square!, "arrow", menu.px, menu.py),
            },
            {
              id: "board.circle",
              label: "Highlight square / add circle",
              run: () =>
                onContextAnnotation?.(menu.square!, "circle", menu.px, menu.py),
            },
            {
              id: "board.text",
              label: "Add text callout…",
              run: () =>
                onContextAnnotation?.(menu.square!, "text", menu.px, menu.py),
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
        fullscreen={fullscreen}
        playing={playing}
        toggle={onToggle}
        view={view}
        set={(patch) => setView((v) => ({ ...v, ...patch }))}
        fit={fit}
        full={full}
        png={saveFrame}
      />
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
            aria-label="Chess composition preview"
            ref={canvas}
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
              const square = scene.current?.pick(e.clientX, e.clientY);
              if (square) click.current(square);
            }}
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
