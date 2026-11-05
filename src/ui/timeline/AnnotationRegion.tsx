import { useRef } from "react";
import type { Annotation } from "../../core/annotations";
import type { Edit } from "../state";
export function AnnotationRegion({
  a,
  pixels,
  edit,
  snap,
  seek,
}: {
  a: Annotation;
  pixels: number;
  edit: Edit;
  snap: boolean;
  seek: (time: number) => void;
}) {
  const drag = useRef<{
    x: number;
    start: number;
    end: number;
    mode: "start" | "end" | "move";
  } | null>(null);
  const begin = (e: React.PointerEvent, mode: "start" | "end" | "move") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    edit.begin();
    drag.current = { x: e.clientX, start: a.start, end: a.end, mode };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const nudge = (edge: "start" | "end", key: string) => {
    if (!["ArrowLeft", "ArrowRight"].includes(key)) return;
    edit("Trim annotation", (p) => {
      const v = p.annotations.find((v) => v.id === a.id)!;
      v[edge] =
        edge === "start"
          ? Math.max(
              0,
              Math.min(
                v.end - 0.05,
                v.start + (key === "ArrowRight" ? 0.05 : -0.05),
              ),
            )
          : Math.max(
              v.start + 0.05,
              v.end + (key === "ArrowRight" ? 0.05 : -0.05),
            );
    });
  };
  return (
    <button
      data-annotation-id={a.id}
      style={{
        left: a.start * pixels,
        width: Math.max(24, (a.end - a.start) * pixels),
      }}
      title={`${a.kind}: ${a.start.toFixed(2)}–${a.end.toFixed(2)}s · drag to move`}
      onClick={() => seek(a.start)}
      onPointerDown={(e) => begin(e, "move")}
      onPointerMove={(e) => {
        e.stopPropagation();
        const d = drag.current;
        if (!d) return;
        let delta = (e.clientX - d.x) / pixels;
        if (snap && !e.altKey) delta = Math.round(delta * 20) / 20;
        edit("Trim annotation", (p) => {
          const v = p.annotations.find((v) => v.id === a.id)!;
          if (d.mode === "move") {
            v.start = Math.max(0, d.start + delta);
            v.end = v.start + d.end - d.start;
          } else if (d.mode === "start")
            v.start = Math.max(0, Math.min(d.end - 0.05, d.start + delta));
          else v.end = Math.max(d.start + 0.05, d.end + delta);
        });
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        drag.current = null;
        edit.end();
      }}
      onLostPointerCapture={() => {
        drag.current = null;
        edit.end();
      }}
    >
      <span
        className="region-edge start"
        role="slider"
        tabIndex={0}
        aria-label={`${a.kind} start time`}
        aria-valuenow={a.start}
        aria-valuemin={0}
        aria-valuemax={a.end}
        onPointerDown={(e) => begin(e, "start")}
        onKeyDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          nudge("start", e.key);
        }}
      >
        ‹
      </span>
      {a.kind === "arrow"
        ? `${a.from} → ${a.to}`
        : a.kind === "circle"
          ? a.from
          : a.text}
      <span
        className="region-edge end"
        role="slider"
        tabIndex={0}
        aria-label={`${a.kind} end time`}
        aria-valuenow={a.end}
        aria-valuemin={a.start}
        aria-valuemax={86400}
        onPointerDown={(e) => begin(e, "end")}
        onKeyDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          nudge("end", e.key);
        }}
      >
        ›
      </span>
    </button>
  );
}
