import { useRef, useState, useMemo, useEffect } from "react";
import type { Project } from "../../core/project";
import { compileStoryboard, resizeShot } from "../../core/storyboard";
import { musicAt, musicVolumeAt, syncMarkers } from "../../core/audio";
import {
  normalizeMusicRange,
  snapTime,
  soundtrackWindow,
  soundtrackGain,
  waveformBins,
} from "../../core/audio/timing";
import type { Edit } from "../state";
export function StoryboardWaveform({
  p,
  edit,
  time,
  seek,
  selected,
  select,
}: {
  p: Project;
  edit: Edit;
  time: number;
  seek: (t: number) => void;
  selected: string | null;
  select: (s: string) => void;
}) {
  const c = compileStoryboard(p),
    [zoom, setZoom] = useState(1),
    [snap, setSnap] = useState(true),
    [scroll, setScroll] = useState(0),
    [width, setWidth] = useState(800),
    [activeBeat, setActiveBeat] = useState<string | null>(null),
    [point, setPoint] = useState<number | null>(null),
    host = useRef<HTMLDivElement>(null),
    drag = useRef<{
      kind: string;
      index: number;
      x: number;
      music: Project["music"];
      beats: Project["storyboard"]["beats"];
    } | null>(null);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const px = Math.min(
      (width / Math.max(1, c.duration)) * zoom,
      30000 / Math.max(1, c.duration),
    ),
    total = Math.max(width, c.duration * px),
    win = soundtrackWindow(p, c.duration),
    beats = p.storyboard.beats,
    targets = [
      ...beats.filter((b) => b.enabled).map((b) => b.time),
      ...c.shots.map((s) => s.start),
      c.duration,
    ],
    bounded = (n: number) => Math.max(0, Math.min(c.duration, n)),
    at = (client: number) =>
      bounded(
        (client -
          host.current!.getBoundingClientRect().left +
          host.current!.scrollLeft) /
          px,
      ),
    bins = useMemo(
      () =>
        waveformBins(
          p.waveform,
          p.music.sourceDuration,
          musicAt(p, scroll / px),
          musicAt(p, (scroll + width) / px),
          Math.ceil(width / 2),
        ),
      [
        p.waveform,
        p.music.sourceDuration,
        p.music.offset,
        p.music.trimStart,
        scroll,
        width,
        px,
      ],
    );
  const patch = (fn: (p: Project) => void) =>
    edit("Soundtrack timing", (p) => {
      fn(p);
      normalizeMusicRange(p.music);
      p.beats = syncMarkers(p).beats;
    });
  const begin = (e: React.PointerEvent, kind: string, index = -1) => {
    e.stopPropagation();
    e.preventDefault();
    edit.begin();
    drag.current = {
      kind,
      index,
      x: at(e.clientX),
      music: structuredClone(p.music),
      beats: structuredClone(beats),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = bounded(
        snapTime(at(e.clientX), snap ? targets : [], 8 / px, e.altKey),
      ),
      delta = t - d.x;
    if (d.kind === "beat")
      edit("Move output beat", (p) => {
        p.storyboard.beats[d.index].time = t;
      });
    else if (d.kind === "volume")
      edit("Move volume point", (p) => {
        const r = host.current!.getBoundingClientRect();
        p.music.volumePoints[d.index] = {
          time: t,
          value: Math.max(0, Math.min(2, (r.top + 126 - e.clientY) / 30)),
        };
      });
    else
      patch((p) => {
        const m = p.music,
          old = d.music,
          source = p.music.sourceDuration;
        if (d.kind === "offset")
          m.offset = Math.max(-3600, Math.min(3600, old.offset + delta));
        if (d.kind === "trimStart") {
          m.trimStart = Math.max(
            0,
            Math.min((old.trimEnd || source) - 0.01, old.trimStart + delta),
          );
          m.offset = old.offset + m.trimStart - old.trimStart;
        }
        if (d.kind === "trimEnd")
          m.trimEnd = Math.max(
            old.trimStart + 0.01,
            Math.min(source, (old.trimEnd || source) + delta),
          );
        if (d.kind === "fadeIn")
          m.fadeIn = Math.max(0, Math.min(30, t - m.offset));
        if (d.kind === "fadeOut")
          m.fadeOut = Math.max(0, Math.min(30, win.end - t));
        p.beats = syncMarkers(p).beats;
      });
  };
  const end = () => {
    if (drag.current) {
      drag.current = null;
      edit.end();
    }
  };
  const handle = (
    kind: string,
    x: number,
    y: number,
    label: string,
    index = -1,
  ) => (
    <rect
      key={label}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={`${(x / px).toFixed(3)}s`}
      x={Math.max(0, Math.min(total - 10, x - 5))}
      y={y}
      width={10}
      height={18}
      rx={2}
      className={`wave-handle ${kind} ${label.startsWith("Accent") ? "accent" : ""}`}
      onPointerDown={(e) => begin(e, kind, index)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const delta = e.key === "ArrowLeft" ? -0.01 : 0.01;
        if (kind === "beat")
          edit("Nudge output beat", (p) => {
            p.storyboard.beats[index].time = bounded(
              p.storyboard.beats[index].time + delta,
            );
          });
        else if (kind === "volume")
          edit("Nudge volume point", (p) => {
            p.music.volumePoints[index].time = bounded(
              p.music.volumePoints[index].time + delta,
            );
          });
        else
          patch((p) => {
            const key = kind as
              | "offset"
              | "trimStart"
              | "trimEnd"
              | "fadeIn"
              | "fadeOut";
            p.music[key] = Math.max(
              key === "offset" ? -3600 : 0,
              Math.min(
                key === "fadeIn" || key === "fadeOut" ? 30 : 3600,
                p.music[key] + delta,
              ),
            );
          });
      }}
    >
      <title>
        {label} · {(x / px).toFixed(3)}s · Alt bypasses snap
      </title>
    </rect>
  );
  const curve = Array.from({ length: Math.ceil(width / 4) }, (_, i) => {
    const t = (scroll + i * 4) / px;
    return `${i ? "L" : "M"}${scroll + i * 4},${126 - soundtrackGain(p, t, c.duration) * 30}`;
  }).join(" ");
  const selectedEntry = c.shots.find((e) => e.shot.id === selected),
    beat = beats.find((b) => b.id === activeBeat);
  const alignEnd = () => {
    if (!selectedEntry) return;
    const nearest = beats
      .filter((b) => b.enabled && b.time > selectedEntry.start + 0.1)
      .sort(
        (a, b) =>
          Math.abs(a.time - selectedEntry.end) -
          Math.abs(b.time - selectedEntry.end),
      )[0];
    if (nearest && nearest.time - selectedEntry.start <= 600)
      edit("Align shot end to beat", (p) =>
        resizeShot(
          p.storyboard.shots[selectedEntry.index],
          nearest.time - selectedEntry.start,
        ),
      );
  };
  return (
    <details
      className="story-waveform"
      aria-label="Storyboard soundtrack editor"
    >
      <summary>Music waveform · trim, fades, automation &amp; beats</summary>
      <div className="wave-tools">
        <strong>Output music</strong>
        <label>
          Zoom{" "}
          <input
            aria-label="Waveform zoom"
            type="range"
            min={1}
            max={8}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
          />
          Snap · Alt bypass
        </label>
        <button
          onClick={() =>
            seek(
              [...beats]
                .filter((b) => b.enabled && b.time < time - 0.001)
                .sort((a, b) => b.time - a.time)[0]?.time ?? 0,
            )
          }
        >
          Previous beat
        </button>
        <button
          onClick={() =>
            seek(
              [...beats]
                .filter((b) => b.enabled && b.time > time + 0.001)
                .sort((a, b) => a.time - b.time)[0]?.time ?? c.duration,
            )
          }
        >
          Next beat
        </button>
        <button
          disabled={!selectedEntry || !beats.some((b) => b.enabled)}
          onClick={alignEnd}
        >
          Align shot end to beat
        </button>
        <button
          onClick={() =>
            edit("Add output beat", (p) => {
              if (p.storyboard.beats.length < 30000)
                p.storyboard.beats.push({
                  id: crypto.randomUUID(),
                  time,
                  enabled: true,
                  accent: false,
                });
            })
          }
        >
          + Beat
        </button>
        <button
          disabled={!p.music.asset}
          onClick={() =>
            edit("Add volume point", (p) => {
              if (p.music.volumePoints.length < 1000)
                p.music.volumePoints.push({
                  time,
                  value: musicVolumeAt(p, time),
                });
            })
          }
        >
          + Volume point
        </button>
      </div>
      <div
        className="wave-scroll"
        ref={host}
        onScroll={(e) => {
          setScroll(e.currentTarget.scrollLeft);
          setWidth(e.currentTarget.clientWidth);
        }}
        onPointerEnter={() => {
          if (host.current) setWidth(host.current.clientWidth);
        }}
      >
        <svg
          width={total}
          height={156}
          aria-label="Music waveform and output ruler"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget)
              seek(
                bounded(
                  snapTime(
                    at(e.clientX),
                    snap ? targets : [],
                    8 / px,
                    e.altKey,
                  ),
                ),
              );
          }}
        >
          {Array.from(
            { length: Math.ceil(width / px) + 2 },
            (_, i) => Math.floor(scroll / px) + i,
          )
            .filter((t) => t <= c.duration)
            .map((t) => (
              <g key={t} pointerEvents="none">
                <line
                  x1={t * px}
                  x2={t * px}
                  y1={0}
                  y2={156}
                  stroke="#37513d"
                />
                <text x={t * px + 3} y={13}>
                  {t}s
                </text>
              </g>
            ))}
          {c.shots
            .filter(
              (e) => e.end * px >= scroll && e.start * px <= scroll + width,
            )
            .map((e) => (
              <g
                key={e.shot.id}
                onClick={() => {
                  select(e.shot.id);
                  seek(e.start);
                }}
              >
                <rect
                  x={e.start * px}
                  y={21}
                  width={Math.max(1, e.shot.duration * px - 1)}
                  height={23}
                  fill={e.shot.id === selected ? "#567341" : "#2c4631"}
                />
                <text x={e.start * px + 5} y={37} pointerEvents="none">
                  {e.index + 1}
                </text>
              </g>
            ))}
          <rect
            x={win.start * px}
            y={49}
            width={Math.max(0, (win.end - win.start) * px)}
            height={76}
            fill="#192e24"
            onClick={(e) =>
              seek(
                bounded(
                  snapTime(
                    at(e.clientX),
                    snap ? targets : [],
                    8 / px,
                    e.altKey,
                  ),
                ),
              )
            }
            onPointerDown={(e) => begin(e, "offset")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
          />
          <path
            pointerEvents="none"
            stroke="#8eaf86"
            d={bins
              .map((v, i) => {
                const x = scroll + i * 2,
                  t = x / px;
                return t >= win.start && t < win.end
                  ? `M${x},${89 - v * 28}v${v * 56}`
                  : "";
              })
              .join(" ")}
          />
          <path pointerEvents="none" stroke="#e5c47c" fill="none" d={curve} />
          {p.beats
            .filter(
              (b) =>
                b.enabled &&
                b.time * px >= scroll &&
                b.time * px <= scroll + width,
            )
            .map((b) => (
              <line
                key={b.id}
                x1={b.time * px}
                x2={b.time * px}
                y1={49}
                y2={130}
                stroke="#8eaf8644"
                pointerEvents="none"
              />
            ))}
          {p.music.asset && (
            <>
              {handle(
                "trimStart",
                win.start * px,
                51,
                "Music source trim start",
              )}
              {handle("trimEnd", win.end * px, 51, "Music source trim end")}
              {handle(
                "fadeIn",
                (win.start + p.music.fadeIn) * px,
                108,
                "Music fade in",
              )}
              {handle(
                "fadeOut",
                (win.end - p.music.fadeOut) * px,
                108,
                "Music fade out",
              )}
            </>
          )}
          {p.music.volumePoints.map((v, i) =>
            v.time * px >= scroll && v.time * px <= scroll + width ? (
              <g key={i} onClick={() => setPoint(i)}>
                {handle(
                  "volume",
                  v.time * px,
                  126 - v.value * 30,
                  "Volume point " + (i + 1),
                  i,
                )}
              </g>
            ) : null,
          )}
          {beats.map((b, i) =>
            b.time * px >= scroll && b.time * px <= scroll + width ? (
              <g
                key={b.id}
                opacity={b.enabled ? 1 : 0.35}
                onClick={() => setActiveBeat(b.id)}
              >
                {handle(
                  "beat",
                  b.time * px,
                  134,
                  `${b.accent ? "Accent" : "Beat"} ${i + 1}`,
                  i,
                )}
              </g>
            ) : null,
          )}
          <line
            x1={time * px}
            x2={time * px}
            y1={0}
            y2={156}
            stroke="#f5e9c8"
            pointerEvents="none"
          />
        </svg>
      </div>
      <p className="hint">
        {p.music.asset
          ? "Drag the green clip to move music. Edge handles trim source audio; gold handles set fades. Gold curve = effective gain (0–2), including fades and mute."
          : "Import a soundtrack in Soundtrack & output beats to see its waveform."}{" "}
        Output {time.toFixed(3)}s · source {musicAt(p, time).toFixed(3)}s
      </p>
      {beat && (
        <div className="wave-tools">
          <label>
            Beat time
            <input
              aria-label="Selected beat time"
              type="number"
              min={0}
              max={c.duration}
              step={0.001}
              value={beat.time}
              onChange={(e) =>
                edit("Beat time", (p) => {
                  p.storyboard.beats.find((b) => b.id === beat.id)!.time =
                    bounded(+e.target.value);
                })
              }
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={beat.enabled}
              onChange={(e) =>
                edit("Enable beat", (p) => {
                  p.storyboard.beats.find((b) => b.id === beat.id)!.enabled =
                    e.target.checked;
                })
              }
            />
            Enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={beat.accent}
              onChange={(e) =>
                edit("Accent beat", (p) => {
                  p.storyboard.beats.find((b) => b.id === beat.id)!.accent =
                    e.target.checked;
                })
              }
            />
            Accent
          </label>
          <button
            onClick={() =>
              edit("Delete output beat", (p) => {
                p.storyboard.beats = p.storyboard.beats.filter(
                  (b) => b.id !== beat.id,
                );
              })
            }
          >
            Delete beat
          </button>
        </div>
      )}
      {point !== null && p.music.volumePoints[point] && (
        <div className="wave-tools">
          <label>
            Point time
            <input
              aria-label="Volume point time"
              type="number"
              min={0}
              max={c.duration}
              step={0.01}
              value={p.music.volumePoints[point].time}
              onChange={(e) =>
                edit("Volume point time", (p) => {
                  p.music.volumePoints[point!].time = bounded(+e.target.value);
                })
              }
            />
          </label>
          <label>
            Gain
            <input
              aria-label="Volume point gain"
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={p.music.volumePoints[point].value}
              onChange={(e) =>
                edit("Volume point gain", (p) => {
                  p.music.volumePoints[point!].value = Math.max(
                    0,
                    Math.min(2, +e.target.value),
                  );
                })
              }
            />
          </label>
          <button
            onClick={() => {
              edit("Delete volume point", (p) => {
                p.music.volumePoints.splice(point!, 1);
              });
              setPoint(null);
            }}
          >
            Delete point
          </button>
          <button
            onClick={() => {
              edit("Reset automation", (p) => {
                p.music.volumePoints = [];
              });
              setPoint(null);
            }}
          >
            Reset automation
          </button>
        </div>
      )}
    </details>
  );
}
