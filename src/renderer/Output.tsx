import { useEffect, useRef, useState } from "react";
import { SceneRenderer } from "./SceneRenderer";
import { DIMENSIONS, type Project } from "../core/model";
import { duration } from "../core/timeline";

export function ExportOutput() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      window.studio.onExportTask(async ({ project, options, assets }) => {
        let renderer: SceneRenderer | undefined;
        try {
          renderer = new SceneRenderer(canvas.current!);
          // Await decoding so export's first frame includes every bitmap.
          for (const [id, url] of Object.entries(assets))
            await renderer.setAsset(id, url);
          const width = options.width ?? DIMENSIONS[options.format][0],
            height = options.height ?? DIMENSIONS[options.format][1],
            fps = options.fps ?? 60,
            start = options.start ?? 0,
            end = options.end ?? duration(project),
            total = Math.round((end - start) * fps);
          for (let frame = 0; frame < total; frame++) {
            renderer.render(
              project,
              start + frame / fps,
              width,
              height,
              options.format,
            );
            await window.studio.exportFrame(renderer.rgba(), frame);
          }
          await window.studio.exportFinish();
        } catch (e) {
          await window.studio
            .exportFinish((e as Error).message)
            .catch(() => {});
        } finally {
          renderer?.dispose();
        }
      }),
    [],
  );
  return <canvas ref={canvas} />;
}
const imageReady = (url: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("An image asset could not be decoded."));
    image.src = url;
  });
export function PresentationOutput() {
  const canvas = useRef<HTMLCanvasElement>(null),
    state = useRef<{
      project: Project;
      time: number;
      playing: boolean;
      at: number;
    } | null>(null);
  const [waiting, setWaiting] = useState(true);
  useEffect(() => {
    const renderer = new SceneRenderer(canvas.current!),
      loaded = new Map<string, string>();
    let frame = 0;
    const unsub = window.studio.onPresentation((s) => {
      setWaiting(false);
      state.current = { ...s, at: performance.now() };
      for (const id of loaded.keys())
        if (!s.assets[id]) {
          renderer.removeAsset(id);
          loaded.delete(id);
        }
      for (const [id, url] of Object.entries(s.assets))
        if (loaded.get(id) !== url) {
          void renderer.setAsset(id, url).catch(() => {});
          loaded.set(id, url);
        }
    });
    const draw = () => {
      const s = state.current;
      if (s) {
        const time = Math.min(
          duration(s.project),
          s.time + (s.playing ? (performance.now() - s.at) / 1000 : 0),
        );
        const [w, h] = DIMENSIONS[s.project.output],
          scale = Math.min(innerWidth / w, innerHeight / h);
        const element = canvas.current!;
        element.style.width = `${w * scale}px`;
        element.style.height = `${h * scale}px`;
        renderer.render(
          s.project,
          time,
          Math.round(w * scale),
          Math.round(h * scale),
        );
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      unsub();
      cancelAnimationFrame(frame);
      renderer.dispose();
    };
  }, []);
  return (
    <main className="presentation">
      <canvas ref={canvas} />
      {waiting && <p>Waiting for the editor composition…</p>}
    </main>
  );
}
