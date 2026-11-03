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
}: {
  project: Project;
  time: number;
  assets: Record<string, string>;
  onSquare: (square: string) => void;
  onError: (message: string) => void;
  onCompositionPoint?: (x: number, y: number) => void;
}) {
  const [view, setView] = useState(initialViewport);
  const panDrag = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const fit = () => setView(initialViewport);
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
        setView(initialViewport);
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
  return (
    <div className="preview-shell" ref={shell}>
      <ViewportTools
        view={view}
        set={(patch) => setView((v) => ({ ...v, ...patch }))}
        fit={fit}
        full={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void shell.current?.requestFullscreen();
        }}
        png={() => {
          if (!scene.current || !ready) return;
          const [w, h] = sizes[project.format];
          scene.current.render(project, time, w, h);
          const link = document.createElement("a");
          link.download = `${project.title.replace(/[^a-z0-9]/gi, "-")}-frame.png`;
          link.href = canvas.current!.toDataURL("image/png");
          link.click();
        }}
      />
      <div
        className="preview-host"
        ref={host}
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
          if (view.pan || e.button === 1) {
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
