import { useEffect, useRef, useState } from "react";
import { SceneRenderer } from "../renderer/SceneRenderer";
import { DIMENSIONS, type Project } from "../core/model";
export function Preview({
  project,
  time,
  images,
  onPick,
}: {
  project: Project;
  time: number;
  images: Record<string, string>;
  onPick: (s: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<SceneRenderer | null>(null),
    [error, setError] = useState("");
  const [size, setSize] = useState([800, 450]);
  const oldImages = useRef(new Set<string>());
  useEffect(() => {
    const observer = new ResizeObserver(([e]) =>
      setSize([e.contentRect.width, e.contentRect.height]),
    );
    observer.observe(host.current!);
    try {
      renderer.current = new SceneRenderer(canvas.current!);
    } catch (e) {
      setError((e as Error).message);
    }
    return () => {
      observer.disconnect();
      renderer.current?.dispose();
    };
  }, []);
  const live = useRef({ project, time, w: 1, h: 1 });
  useEffect(() => {
    for (const id of oldImages.current)
      if (!images[id]) renderer.current?.removeAsset(id);
    void Promise.all(
      Object.entries(images).map(([id, url]) =>
        renderer.current?.setAsset(id, url),
      ),
    )
      .then(() => {
        const v = live.current;
        renderer.current?.render(v.project, v.time, v.w, v.h);
      })
      .catch((e) => setError((e as Error).message));
    oldImages.current = new Set(Object.keys(images));
  }, [images]);
  const [width, height] = DIMENSIONS[project.output],
    scale = Math.min((size[0] - 40) / width, (size[1] - 32) / height),
    w = Math.max(1, Math.round(width * scale)),
    h = Math.max(1, Math.round(height * scale));
  live.current = { project, time, w, h };
  useEffect(() => {
    try {
      renderer.current?.render(project, time, w, h);
    } catch (e) {
      setError((e as Error).message);
      window.studio.log("renderer-error", (e as Error).message);
    }
  }, [project, time, w, h]);
  return (
    <div className="preview-host" ref={host}>
      <canvas
        ref={canvas}
        style={{ width: w, height: h }}
        aria-label="Composition preview"
        onClick={(e) => {
          const s = renderer.current?.pick(e.clientX, e.clientY);
          if (s) onPick(s);
        }}
      />
      {error && <div className="preview-error">Renderer: {error}</div>}
      <div className="preview-caption">
        <span className="live-dot" /> EXACT-TIME PREVIEW{" "}
        <span>
          {width} × {height} · 60 FPS
        </span>
      </div>
    </div>
  );
}
