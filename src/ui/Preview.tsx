import { useEffect, useRef, useState } from "react";
import { Scene, ContextLostError } from "../render/Scene";
import { sizes, type Project } from "../core/project";
export function Preview({
  project,
  time,
  assets,
  onSquare,
  onError,
}: {
  project: Project;
  time: number;
  assets: Record<string, string>;
  onSquare: (square: string) => void;
  onError: (message: string) => void;
}) {
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
    <div className="preview-host" ref={host}>
      <canvas
        aria-label="Chess composition preview"
        ref={canvas}
        onClick={(e) => {
          const square = scene.current?.pick(e.clientX, e.clientY);
          if (square) click.current(square);
        }}
      />
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
  );
}
