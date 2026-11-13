import {
  positionText,
  resizeTextWidth,
  textResizeSide,
} from "../../core/captions/manipulation";
import { useRef, useState } from "react";
import type { Annotation } from "../../core/annotations";
import { safeDefaults, safeRect } from "../../core/captions/safeAreas";
import type { Format } from "../../core/project";
import type { Edit } from "../state";
export type TextBounds = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  areaLeft: number;
  areaRight: number;
  scale: number;
  anchorX: number;
};
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
/** Normalized geometry comes from the rendered text, including its entrance scale.
 * Pointer deltas use the transformed output rectangle, so zoom/pan/DPR cancel. */
export function TextComposition({
  format,
  bounds,
  annotations,
  selected,
  disabled,
  select,
  prepare,
  edit,
  report,
}: {
  format: Format;
  bounds: TextBounds[];
  annotations: Annotation[];
  selected: string | null;
  disabled: boolean;
  select: (id: string) => void;
  prepare: () => void;
  edit?: Edit;
  report?: (s: string) => void;
}) {
  const [resizing, setResizing] = useState<{
    id: string;
    side: "left" | "right";
  } | null>(null);
  const drag = useRef<{
    a: Annotation;
    b: TextBounds;
    x: number;
    y: number;
    width: number;
    height: number;
    resize: boolean;
    side: "left" | "right";
  } | null>(null);
  const end = () => {
    if (drag.current) {
      drag.current = null;
      setResizing(null);
      edit?.end();
    }
  };
  return (
    <div className="text-composition" aria-label="Visual text editor">
      {!disabled &&
        bounds.map((b) => {
          const a = annotations.find((a) => a.id === b.id),
            active = selected === b.id,
            side =
              resizing?.id === b.id
                ? resizing.side
                : a
                  ? textResizeSide(a, b)
                  : "right";
          return (
            <div
              key={b.id}
              className={`text-hit ${active ? "text-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Select text: ${a?.text ?? "Inherited source text"}`}
              data-annotation-id={b.id}
              style={{
                left: `${b.left * 100}%`,
                top: `${b.top * 100}%`,
                width: `${(b.right - b.left) * 100}%`,
                height: `${(b.bottom - b.top) * 100}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 || !edit) return;
                e.preventDefault();
                e.stopPropagation();
                if (!a) {
                  report?.(
                    "Text inherited from Source or an outgoing transition is read-only in this shot. Select its owning shot or edit it in Source. You can also disable inheritance and add a local text layer.",
                  );
                  return;
                }
                prepare();
                select(a.id);
                e.currentTarget.focus();
                edit.begin();
                const rect =
                  e.currentTarget.parentElement!.getBoundingClientRect();
                drag.current = {
                  a: structuredClone(a),
                  b,
                  x: e.clientX,
                  y: e.clientY,
                  width: rect.width,
                  height: rect.height,
                  resize: (e.target as HTMLElement).dataset.resize === "true",
                  side,
                };
                if (drag.current.resize) setResizing({ id: a.id, side });
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || !edit) return;
                const dx = (e.clientX - d.x) / d.width,
                  dy = (e.clientY - d.y) / d.height;
                edit(d.resize ? "Resize text area" : "Move text layer", (p) => {
                  const t = p.annotations.find((a) => a.id === d.a.id);
                  if (!t) return;
                  if (d.resize) {
                    const safe = safeRect(
                      100,
                      100,
                      d.a.layout.customMargins
                        ? d.a.layout
                        : safeDefaults(format, d.a.layout.placement),
                    );
                    t.layout.maxWidth = resizeTextWidth(
                      d.a,
                      safe.width / 100,
                      dx,
                      d.b.scale,
                      d.side,
                    );
                    if (t.layout.maxWidth !== d.a.layout.maxWidth) {
                      const change =
                        t.layout.maxWidth -
                        Math.min(d.a.layout.maxWidth, safe.width / 100);
                      // When the aligned edge lies outside the frame, resize
                      // from the reachable opposite edge and move its anchor.
                      t.x = clamp(
                        d.b.anchorX +
                          (d.a.align === "left" && d.side === "left"
                            ? -change
                            : d.a.align === "right" && d.side === "right"
                              ? change
                              : 0),
                      );
                    } else t.x = d.a.x;
                  } else {
                    const safe = safeRect(
                      100,
                      100,
                      d.a.layout.customMargins
                        ? d.a.layout
                        : safeDefaults(format, d.a.layout.placement),
                    );
                    Object.assign(
                      t,
                      positionText(
                        d.b,
                        {
                          left: safe.x / 100,
                          top: safe.y / 100,
                          right: (safe.x + safe.width) / 100,
                          bottom: (safe.y + safe.height) / 100,
                        },
                        dx,
                        dy,
                        d.a.align,
                        !e.altKey,
                      ),
                    );
                  }
                });
              }}
              onPointerUp={end}
              onPointerCancel={end}
              onLostPointerCapture={end}
              onKeyDown={(e) => {
                if (a && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  e.stopPropagation();
                  prepare();
                  select(a.id);
                  return;
                }
                if (
                  !a ||
                  !edit ||
                  !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                )
                  return;
                e.preventDefault();
                e.stopPropagation();
                prepare();
                select(a.id);
                const step = e.shiftKey ? 0.02 : e.altKey ? 0.001 : 0.005;
                edit("Nudge text layer", (p) => {
                  const t = p.annotations.find((v) => v.id === a.id);
                  if (t) {
                    t.x = clamp(
                      t.x +
                        (e.key === "ArrowLeft"
                          ? -step
                          : e.key === "ArrowRight"
                            ? step
                            : 0),
                    );
                    t.y = clamp(
                      t.y +
                        (e.key === "ArrowUp"
                          ? -step
                          : e.key === "ArrowDown"
                            ? step
                            : 0),
                    );
                  }
                });
              }}
            >
              {active && (
                <>
                  <span className="text-layer-label">
                    Text area ·{" "}
                    {Math.round(((b.areaRight - b.areaLeft) / b.scale) * 100)}%
                    width
                  </span>
                  <span
                    className="text-width-box"
                    style={{
                      left: `${((b.areaLeft - b.left) / (b.right - b.left)) * 100}%`,
                      width: `${((b.areaRight - b.areaLeft) / (b.right - b.left)) * 100}%`,
                    }}
                  >
                    <span
                      className={`text-resize ${side === "left" ? "text-resize-left" : ""}`}
                      data-resize="true"
                      title="Resize text width · keeps font size"
                      aria-label="Resize text width"
                    />
                  </span>
                </>
              )}
            </div>
          );
        })}
    </div>
  );
}
