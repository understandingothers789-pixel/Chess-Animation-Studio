import { useEffect, useRef, useState } from "react";
import { Scene } from "../render/Scene";
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
    [ready, setReady] = useState(false);
  latest.current = { project, time };
  const click = useRef(onSquare);
  click.current = onSquare;
  useEffect(() => {
    const s = new Scene(canvas.current!);
    scene.current = s;
    let alive = true,
      frame = 0,
      available = false;
    void s.ready
      .then(() => {
        available = true;
        setReady(true);
      })
      .catch((e) => onError(e.message));
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
        s.render(
          project,
          time,
          Math.round(width * devicePixelRatio),
          Math.round(height * devicePixelRatio),
        );
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      scene.current = null;
      s.dispose();
    };
  }, []);
  const loaded = useRef(new Map<string, string>());
  useEffect(() => {
    if (!scene.current) return;
    for (const id of loaded.current.keys())
      if (!assets[id]) {
        scene.current.removeAsset(id);
        loaded.current.delete(id);
      }
    for (const [id, url] of Object.entries(assets))
      if (loaded.current.get(id) !== url) {
        loaded.current.set(id, url);
        void scene.current.setAsset(id, url).catch((e) => onError(e.message));
      }
  }, [assets, ready]);
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
      {!ready && <div className="loading">Preparing vector pieces…</div>}
    </div>
  );
}
