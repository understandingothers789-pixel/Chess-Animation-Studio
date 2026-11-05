import { useRef, useState } from "react";
import type { Move } from "../../core/project";
import type { Edit } from "../state";
export function MoveClip({
  move,
  index,
  left,
  width,
  pixels,
  selected,
  checked,
  snap,
  edit,
  select,
}: {
  move: Move;
  index: number;
  left: number;
  width: number;
  pixels: number;
  selected: boolean;
  checked: boolean;
  snap: boolean;
  edit: Edit;
  select: (i: number, e: React.MouseEvent) => void;
}) {
  const drag = useRef<{
      x: number;
      duration: number;
      pixels: number;
      active: boolean;
    } | null>(null),
    [resizing, setResizing] = useState(false);
  const [bypass, setBypass] = useState(false);
  const finish = (cancel = false) => {
    const d = drag.current;
    if (d?.active) {
      if (cancel)
        edit("Resize move", (p) => {
          p.moves.find((m) => m.id === move.id)!.effect.duration = d.duration;
        });
      edit.end();
    }
    drag.current = null;
    setResizing(false);
  };
  return (
    <div
      data-move-index={index}
      className={`move-clip ${selected ? "selected" : ""} ${checked ? "checked" : ""} ${resizing ? "resizing" : ""}`}
      style={{ left, width }}
    >
      <button
        className="clip-select"
        aria-pressed={selected || checked}
        title={`${index + 1}. ${move.san} · ${move.effect.preset} · ${move.effect.duration.toFixed(2)}s`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => select(index, e)}
      >
        <strong>
          {move.effect.locked ? "🔒 " : ""}
          {move.san}
        </strong>
        <small>{move.effect.preset}</small>
      </button>
      <span
        className="clip-resize"
        role="slider"
        tabIndex={move.effect.locked ? -1 : 0}
        aria-label={`Duration of ${move.san}`}
        aria-disabled={move.effect.locked}
        aria-valuemin={0.2}
        aria-valuemax={30}
        aria-valuenow={move.effect.duration}
        aria-valuetext={`${move.effect.duration.toFixed(2)} seconds`}
        title="Drag to change move duration."
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if (e.button !== 0 || move.effect.locked) return;
          e.preventDefault();
          e.stopPropagation();
          drag.current = {
            x: e.clientX,
            duration: move.effect.duration,
            pixels,
            active: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          e.stopPropagation();
          const d = drag.current;
          if (!d) return;
          if (!d.active) {
            if (Math.abs(e.clientX - d.x) < 3) return;
            d.active = true;
            edit.begin();
            setResizing(true);
          }
          setBypass(e.altKey);
          let value = d.duration + (e.clientX - d.x) / d.pixels;
          if (snap && !e.altKey) value = Math.round(value * 20) / 20;
          edit("Resize move", (p) => {
            p.moves.find((m) => m.id === move.id)!.effect.duration = Math.max(
              0.2,
              Math.min(30, value),
            );
          });
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          finish();
        }}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish()}
        onKeyDown={(e) => {
          if (move.effect.locked) return;
          if (e.key === "Escape") {
            e.preventDefault();
            finish(true);
          }
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            edit("Resize move", (p) => {
              const m = p.moves.find((m) => m.id === move.id)!;
              m.effect.duration = Math.max(
                0.2,
                Math.min(
                  30,
                  m.effect.duration +
                    (e.key === "ArrowRight" ? 1 : -1) *
                      (e.altKey ? 0.01 : 0.05),
                ),
              );
            });
          }
        }}
      >
        <i aria-hidden="true" />
      </span>
      {resizing && (
        <output className="duration-feedback" role="status">
          {move.san} · {move.effect.duration.toFixed(2)}s
          {snap && !bypass ? " · snap" : ""}
        </output>
      )}
    </div>
  );
}
