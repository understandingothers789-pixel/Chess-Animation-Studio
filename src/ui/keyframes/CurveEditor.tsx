import { useRef, useState } from "react";
import { curve, clamp, segments } from "../../core/timeline";
import type { Key, Project, Channel } from "../../core/project";
import type { Edit } from "../state";
export function CurveEditor({
  project,
  index,
  channel,
  edit,
  seek,
}: {
  project: Project;
  index: number;
  channel: Channel;
  edit: Edit;
  seek?: (time: number) => void;
}) {
  const keys = project.moves[index].effect.keys[channel] ?? [],
    [selected, select] = useState(0),
    drag = useRef<number | null>(null),
    clipboard = useRef<Key[] | null>(null);
  const fallback = ["scale", "opacity", "cameraZoom"].includes(channel) ? 1 : 0;
  const low = Math.min(0, ...keys.map((k) => k.value)) - 0.25,
    high = Math.max(1, ...keys.map((k) => k.value)) + 0.25;
  const bounds = useRef({ low, high });
  if (drag.current === null) bounds.current = { low, high };
  const y = (value: number) =>
    150 -
    ((value - bounds.current.low) /
      (bounds.current.high - bounds.current.low)) *
      130;
  const point = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      at: clamp((((e.clientX - r.left) / r.width) * 400 - 30) / 350),
      value:
        Math.round(
          (bounds.current.low +
            ((150 - ((e.clientY - r.top) / r.height) * 180) / 130) *
              (bounds.current.high - bounds.current.low)) *
            100,
        ) / 100,
    };
  };
  const path = Array.from(
    { length: 201 },
    (_, i) =>
      `${i ? "L" : "M"}${30 + (i / 200) * 350},${y(curve(keys, i / 200, fallback))}`,
  ).join(" ");
  return (
    <div className="curve-editor">
      <p className="hint">
        {channel} · 0–{project.moves[index].effect.duration.toFixed(2)}s ·
        double-click to add · select a point, then Delete
      </p>
      <svg
        viewBox="0 0 400 180"
        role="group"
        aria-label={`${channel} animation curve`}
        onDoubleClick={(e) => {
          const k = point(e);
          edit("Add curve point", (p) => {
            (p.moves[index].effect.keys[channel] ??= []).push({
              ...k,
              ease: "smooth",
            });
          });
          select(keys.length);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const k = point(e),
            i = drag.current;
          const segment = segments(project)[index];
          seek?.(segment.depart + k.at * project.moves[index].effect.duration);
          edit("Drag curve point", (p) => {
            Object.assign(p.moves[index].effect.keys[channel]![i], k);
          });
        }}
        onPointerUp={() => {
          drag.current = null;
          edit.end();
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          edit.end();
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <path d={`M${30 + t * 350},15V150`} stroke="#344c3c" />
            <text x={30 + t * 350} y={171} fill="#b0c3ab" fontSize="10">
              {t}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#b5da8c" strokeWidth="2" />
        {keys.map((k, i) => (
          <circle
            key={i}
            cx={30 + k.at * 350}
            cy={y(k.value)}
            r={selected === i ? 7 : 5}
            fill={selected === i ? "#f6d38b" : "#b5da8c"}
            tabIndex={0}
            role="button"
            aria-label={`Curve point ${i + 1}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              select(i);
              drag.current = i;
              const segment = segments(project)[index];
              seek?.(
                segment.depart + k.at * project.moves[index].effect.duration,
              );
              edit.begin();
              e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId);
            }}
            onKeyDown={(e) => {
              if (e.key === "Delete") {
                edit("Delete curve point", (p) => {
                  p.moves[index].effect.keys[channel]!.splice(i, 1);
                });
              } else if (e.key.startsWith("Arrow")) {
                e.preventDefault();
                edit("Nudge curve point", (p) => {
                  const key = p.moves[index].effect.keys[channel]![i];
                  key.at = clamp(
                    key.at +
                      (e.key === "ArrowRight"
                        ? 0.01
                        : e.key === "ArrowLeft"
                          ? -0.01
                          : 0),
                  );
                  key.value +=
                    e.key === "ArrowUp"
                      ? 0.1
                      : e.key === "ArrowDown"
                        ? -0.1
                        : 0;
                });
              }
            }}
          />
        ))}
      </svg>
      <div className="button-row">
        <button
          onClick={() => {
            clipboard.current = structuredClone(keys);
          }}
        >
          Copy curve
        </button>
        <button
          onClick={() => {
            if (clipboard.current)
              edit("Paste curve", (p) => {
                p.moves[index].effect.keys[channel] = structuredClone(
                  clipboard.current!,
                );
              });
          }}
        >
          Paste curve
        </button>
        <button
          disabled={!keys.length}
          onClick={() =>
            edit("Delete curve point", (p) => {
              p.moves[index].effect.keys[channel]?.splice(selected, 1);
            })
          }
        >
          Delete point
        </button>
      </div>
    </div>
  );
}
