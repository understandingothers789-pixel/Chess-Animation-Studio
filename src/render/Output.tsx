import { useEffect, useRef } from "react";
import { Scene } from "./Scene";
import { sizes } from "../core/project";
import type { Project } from "../core/project";
import { duration } from "../core/timeline";
export function Output() {
  const canvas = useRef<HTMLCanvasElement>(null),
    role = new URLSearchParams(location.search).get("role");
  useEffect(() => {
    const scene = new Scene(canvas.current!);
    let alive = true,
      raf = 0;
    let state: {
      project: Project;
      time: number;
      playing: boolean;
      at: number;
    } | null = null;
    if (role === "export") {
      const off = window.studio.onTask(async ({ project, options, assets }) => {
        try {
          await scene.ready;
          await scene.prepareAssets(assets);
          const [dw, dh] = sizes[options.format],
            w = options.width ?? dw,
            h = options.height ?? dh,
            fps = options.fps ?? 60,
            total = Math.ceil((options.end - options.start) * fps);
          for (let i = 0; i < total && alive; i++) {
            scene.render(
              project,
              options.start + i / fps,
              w,
              h,
              options.format,
            );
            await window.studio.frame(scene.rgba(), i);
          }
          if (alive) await window.studio.finish();
        } catch (e) {
          if (alive)
            await window.studio.finish((e as Error).message).catch(() => {});
        }
      });
      window.studio.workerReady();
      return () => {
        alive = false;
        off();
        scene.dispose();
      };
    }
    let ready = false;
    scene.ready
      .then(() => {
        ready = true;
      })
      .catch(console.error);
    const requested = new Set<string>();
    const off = window.studio.onPresentation((s) => {
      state = {
        project: s.project,
        time: s.time,
        playing: s.playing,
        at: performance.now(),
      };
      for (const id of requested)
        if (!s.assets[id]) {
          scene.removeAsset(id);
          requested.delete(id);
        }
      for (const [id, url] of Object.entries(s.assets))
        if (
          scene.assetState(id)?.url !== url ||
          scene.assetState(id)?.state === "failed"
        ) {
          requested.add(id);
          void scene.setAsset(id, url, { retries: 2 }).catch(console.error);
        }
    });
    const draw = () => {
      if (ready && state) {
        const [w, h] = sizes[state.project.format],
          scale = Math.min(innerWidth / w, innerHeight / h),
          t = Math.min(
            duration(state.project),
            state.time +
              (state.playing ? (performance.now() - state.at) / 1000 : 0),
          );
        canvas.current!.style.width = w * scale + "px";
        canvas.current!.style.height = h * scale + "px";
        scene.render(
          state.project,
          t,
          Math.round(w * scale),
          Math.round(h * scale),
        );
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      alive = false;
      off();
      cancelAnimationFrame(raf);
      scene.dispose();
    };
  }, [role]);
  return (
    <main className="output">
      <canvas ref={canvas} />
    </main>
  );
}
