import { useEffect, useId, useMemo, useRef, useState } from "react";
import { importPgn } from "../../core/chess";
import {
  blank,
  camera,
  effect,
  presets,
  type Preset,
  type Project,
} from "../../core/project";
import { duration } from "../../core/timeline";
import { Scene } from "../../render/Scene";
import { presetDescriptions, presetLabels } from "./catalog";
import "./preset-preview.css";

const pixels = 360;

export function PresetPreview({
  initial,
  style,
  onApply,
  onClose,
}: {
  initial: Preset;
  style: Project["style"];
  onApply?: (preset: Preset) => void;
  onClose: () => void;
}) {
  const [selected, select] = useState(initial);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Scene | null>(null);
  const currentTime = useRef(0);
  const id = useId();

  const demo = useMemo(() => {
    const p = importPgn(
      blank(),
      '[FEN "7k/8/8/4q3/8/5N2/8/1K6 w - - 0 1"] 1. Nxe5',
    );
    p.style = { ...style, coordinates: false };
    p.format = "square";
    p.lead = 0.22;
    p.tail = 0.32;
    p.boardFX.intro = false;
    p.ambient.enabled = false;
    p.moves[0].effect = effect(selected);
    p.moves[0].effect.cameras.square = {
      ...camera(),
      mode: "manual",
      x: 1,
      y: -0.25,
      zoom: 1.65,
    };
    return p;
  }, [style, selected]);
  const end = useMemo(() => duration(demo), [demo]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let mounted = true;
    let scene: Scene | undefined;
    try {
      scene = new Scene(canvas.current!);
      renderer.current = scene;
      scene.ready.then(
        () => {
          if (mounted) setReady(true);
        },
        () => {
          if (mounted) setError(true);
        },
      );
    } catch {
      setError(true);
    }
    return () => {
      mounted = false;
      renderer.current = null;
      scene?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!ready || error) return;
    const scene = renderer.current!;
    const draw = () => {
      try {
        scene.render(demo, currentTime.current, pixels, pixels);
        return true;
      } catch {
        setError(true);
        return false;
      }
    };
    if (!draw() || !playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      if (elapsed >= 1000 / 30 - 1) {
        last = now;
        currentTime.current =
          (currentTime.current + Math.min(100, elapsed) / 1000) % end;
        if (!draw()) return;
        setTime(currentTime.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [demo, end, playing, ready, error]);

  function seek(next: number) {
    currentTime.current = next;
    setTime(next);
    if (ready && !error) {
      try {
        renderer.current?.render(demo, next, pixels, pixels);
      } catch {
        setError(true);
      }
    }
  }

  return (
    <dialog
      ref={dialog}
      className="preset-preview"
      aria-labelledby={id}
      onClose={onClose}
    >
      <header className="preset-preview-header">
        <h2 id={id}>Move preset preview</h2>
        <button type="button" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </header>
      <div className="preset-preview-body">
        <div
          className="preset-preview-list"
          role="group"
          aria-label="Move presets"
        >
          {presets.map((value) => (
            <div key={value} className="preset-preview-choice">
              <button
                type="button"
                aria-pressed={selected === value}
                aria-describedby={id + value}
                onClick={() => {
                  if (selected === value) return;
                  currentTime.current = 0;
                  setTime(0);
                  select(value);
                }}
              >
                {presetLabels[value]}
              </button>
              <span role="tooltip" id={id + value}>
                {presetDescriptions[value]}
              </span>
            </div>
          ))}
        </div>
        <div className="preset-preview-stage">
          <strong>{presetLabels[selected]}</strong>
          <p>{presetDescriptions[selected]}</p>
          <div className="preset-preview-board">
            <canvas ref={canvas} aria-label="Example chess animation" />
            {(error || !ready) && (
              <p role="status">
                {error
                  ? "Animation preview is unavailable."
                  : "Loading preview…"}
              </p>
            )}
          </div>
          <div className="preset-preview-transport">
            <button
              type="button"
              disabled={!ready || error}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? "Pause demo" : "Play demo"}
            </button>
            <button
              type="button"
              disabled={!ready || error}
              onClick={() => seek(0)}
            >
              Restart
            </button>
            <input
              type="range"
              aria-label="Scrub preset demo"
              min={0}
              max={end}
              step={0.01}
              value={time}
              disabled={!ready || error}
              onChange={(event) => {
                setPlaying(false);
                seek(Number(event.target.value));
              }}
            />
          </div>
          <footer className="preset-preview-footer">
            <small>Example capture using the built-in preset.</small>
            {onApply && (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  dialog.current?.close();
                  onApply(selected);
                }}
              >
                Apply movement
              </button>
            )}
          </footer>
        </div>
      </div>
    </dialog>
  );
}
