import { useRef, useState } from "react";
import type { Annotation } from "../../core/annotations";
import type { Format } from "../../core/project";
import type { Edit } from "../state";
import { safeDefaults, safeRect } from "../../core/captions/safeAreas";
export function CaptionGuide({
  a,
  format,
  edit,
  prepare,
}: {
  a?: Annotation;
  format: Format;
  edit?: Edit;
  prepare: () => void;
}) {
  const [enabled, setEnabled] = useState(false),
    drag = useRef(false);
  if (!a) return null;
  const safe = safeRect(
    100,
    100,
    a.layout.customMargins
      ? a.layout
      : safeDefaults(format, a.layout.placement),
  );
  const end = () => {
    if (drag.current) {
      drag.current = false;
      edit?.end();
    }
  };
  return (
    <>
      <button
        className="caption-guide-toggle"
        aria-pressed={enabled}
        onClick={() => setEnabled((v) => !v)}
      >
        Caption guides
      </button>
      {enabled && (
        <div
          className="caption-guides"
          aria-label="Caption safe area"
          style={{
            left: `${safe.x}%`,
            top: `${safe.y}%`,
            width: `${safe.width}%`,
            height: `${safe.height}%`,
          }}
        >
          <span>
            {a.layout.placement === "social-safe"
              ? "Approximate social safe area · configurable"
              : "Caption safe area"}{" "}
            · drag crosshair to position
          </span>
          <i />
          <b />
        </div>
      )}
      {enabled && edit && (
        <div
          className="caption-position"
          role="slider"
          tabIndex={0}
          aria-label="Drag caption position"
          aria-valuetext={`${a.x.toFixed(2)}, ${a.y.toFixed(2)}`}
          style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            prepare();
            edit.begin();
            drag.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const r = e.currentTarget.parentElement!.getBoundingClientRect();
            const snap = (v: number, lo: number, hi: number) => {
              const n = Math.max(lo, Math.min(hi, v));
              return e.altKey
                ? n
                : ([lo, (lo + hi) / 2, hi].find(
                    (x) => Math.abs(x - n) < 0.015,
                  ) ?? n);
            };
            const x = snap(
                (e.clientX - r.left) / r.width,
                safe.x / 100,
                (safe.x + safe.width) / 100,
              ),
              y = snap(
                (e.clientY - r.top) / r.height,
                safe.y / 100,
                (safe.y + safe.height) / 100,
              );
            edit("Position caption", (d) => {
              const target = d.annotations.find((v) => v.id === a.id);
              if (target) Object.assign(target, { x, y });
            });
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
          onKeyDown={(e) => {
            if (
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            edit("Position caption", (d) => {
              const t = d.annotations.find((v) => v.id === a.id);
              if (t) {
                t.x = Math.max(
                  0,
                  Math.min(
                    1,
                    t.x +
                      (e.key === "ArrowLeft"
                        ? -0.01
                        : e.key === "ArrowRight"
                          ? 0.01
                          : 0),
                  ),
                );
                t.y = Math.max(
                  0,
                  Math.min(
                    1,
                    t.y +
                      (e.key === "ArrowUp"
                        ? -0.01
                        : e.key === "ArrowDown"
                          ? 0.01
                          : 0),
                  ),
                );
              }
            });
          }}
        >
          ✥
        </div>
      )}
    </>
  );
}
