import { useEffect, useRef, useState } from "react";
import { GraphicsSession } from "./GraphicsSession";
import { Scene } from "./Scene";
import { sizes } from "../core/project";
import type { Project } from "../core/project";
import { duration } from "../core/timeline";
export function Output() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const retry = useRef<() => void>(() => {});
  const canvas = useRef<HTMLCanvasElement>(null),
    role = new URLSearchParams(location.search).get("role");
  useEffect(() => {
    if (role !== "export") {
      const session = new GraphicsSession();
      let alive = true,
        ready = false,
        failed = false,
        raf = 0;
      let assets: Record<string, string> = {};
      let state: {
        project: Project;
        time: number;
        playing: boolean;
        at: number;
      } | null = null;
      const position = () =>
        state
          ? Math.min(
              duration(state.project),
              state.time +
                (state.playing && !failed
                  ? (performance.now() - state.at) / 1000
                  : 0),
            )
          : 0;
      const fail = (e: unknown) => {
        if (!alive) return;
        if (state) {
          state.time = position();
          state.at = performance.now();
        }
        failed = true;
        ready = false;
        setError(e instanceof Error ? e.message : String(e));
      };
      const requested = new Set<string>();
      const syncAssets = async (scene: Scene) => {
        while (alive && session.scene === scene) {
          const snapshot = assets;
          for (const id of requested)
            if (!snapshot[id]) {
              scene.removeAsset(id);
              requested.delete(id);
            }
          try {
            await Promise.all(
              Object.entries(snapshot).map(([id, url]) => {
                requested.add(id);
                return scene.setAsset(id, url, { retries: 2 });
              }),
            );
            if (snapshot === assets) return;
          } catch (e) {
            if (snapshot === assets) throw e;
          }
        }
      };
      const reload = async () => {
        ready = false;
        setError("");
        try {
          const scene = await session.reload(host.current!, assets);
          if (!alive || !scene) return;
          // Catch asset changes received while the replacement scene was loading.
          await syncAssets(scene);
          if (!alive) return;
          if (state) state.at = performance.now();
          failed = false;
          ready = true;
        } catch (e) {
          fail(e);
        }
      };
      retry.current = () => {
        void reload();
      };
      const off = window.studio.onPresentation((s) => {
        state = {
          project: s.project,
          time: s.time,
          playing: s.playing,
          at: performance.now(),
        };
        assets = s.assets;
        const scene = session.scene;
        if (scene && ready)
          void syncAssets(scene).catch((e) => {
            if (session.scene === scene) fail(e);
          });
      });
      const draw = () => {
        if (ready && state && session.scene) {
          try {
            const [w, h] = sizes[state.project.format];
            const scale = Math.min(innerWidth / w, innerHeight / h);
            const canvas = session.scene.renderer.domElement;
            canvas.style.width = w * scale + "px";
            canvas.style.height = h * scale + "px";
            session.scene.render(
              state.project,
              position(),
              Math.max(1, Math.round(w * scale)),
              Math.max(1, Math.round(h * scale)),
            );
          } catch (e) {
            fail(e);
          }
        }
        raf = requestAnimationFrame(draw);
      };
      void reload();
      draw();
      return () => {
        alive = false;
        off();
        cancelAnimationFrame(raf);
        session.dispose();
      };
    }
    const scene = new Scene(canvas.current!);
    let alive = true;
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
  }, [role]);
  return (
    <main className="output">
      {role === "export" ? <canvas ref={canvas} /> : <div ref={host} />}
      {error && (
        <div
          role="alert"
          style={{ position: "absolute", inset: 20, color: "white" }}
        >
          <p>{error}</p>
          <button onClick={() => retry.current()}>Reload graphics</button>
        </div>
      )}
    </main>
  );
}
