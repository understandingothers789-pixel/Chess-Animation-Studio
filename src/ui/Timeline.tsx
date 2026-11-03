import { AnnotationRegion } from "./timeline/AnnotationRegion";
import { settingHelp } from "./help";
import { useRef, useState } from "react";
import { segments, duration } from "../core/timeline";
import type { Project } from "../core/project";
import type { Edit } from "./state";
import { clock } from "./controls";
export function Timeline({
  project: p,
  time,
  selected,
  checked,
  introSelected,
  selectIntro,
  select,
  seek,
  edit,
}: {
  project: Project;
  time: number;
  selected: number;
  checked: Set<string>;
  introSelected: boolean;
  selectIntro: () => void;
  select: (
    i: number,
    modifiers?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean },
  ) => void;
  seek: (t: number) => void;
  edit: Edit;
}) {
  const [zoom, setZoom] = useState(1);
  const [hiddenTracks, setHiddenTracks] = useState<string[]>([]);
  const resize = useRef<{
    i: number;
    x: number;
    duration: number;
    scale: number;
  } | null>(null);
  const [snap, setSnap] = useState(true);
  const host = useRef<HTMLDivElement>(null),
    length = duration(p),
    seq = segments(p),
    width = Math.max(760, Math.min(16000, length * 18 * zoom)),
    x = (t: number) => (t / length) * width;
  const events = [
    ...seq.flatMap((s, i) => [
      s.land,
      ...Object.values(p.moves[i].effect.keys).flatMap((keys) =>
        (keys ?? []).map((k) => s.depart + k.at * p.moves[i].effect.duration),
      ),
    ]),
    ...p.annotations.flatMap((a) => [a.start, a.end]),
  ].sort((a, b) => a - b);
  const dragged = useRef<string | null>(null);
  const pointer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.max(
      0,
      Math.min(length, ((e.clientX - r.left) / r.width) * length),
    );
    if (dragged.current) {
      if (p.beatsLocked) return;
      const id = dragged.current;
      edit("Drag beat", (p) => {
        const b = p.beats.find((b) => b.id === id)!;
        b.time = t;
        if (b.sourceTime !== undefined)
          b.sourceTime = t + p.music.trimStart - p.music.offset;
      });
    } else {
      const boundaries = [
        0,
        p.lead,
        length,
        ...seq.flatMap((segment) => [segment.start, segment.end]),
      ];
      const nearest = boundaries.reduce(
        (best, boundary) =>
          Math.abs(boundary - t) < Math.abs(best - t) ? boundary : best,
        boundaries[0],
      );
      seek(
        snap && !e.altKey && (Math.abs(nearest - t) * r.width) / length <= 8
          ? nearest
          : t,
      );
    }
  };
  const sourceLength = p.music.sourceDuration || length,
    wave = p.waveform
      .map((v, i) => {
        const source = (i / p.waveform.length) * sourceLength,
          projectTime = source - p.music.trimStart + p.music.offset;
        return { x: x(projectTime), v };
      })
      .filter(
        (v) =>
          v.x >= x(p.music.offset) &&
          (!p.music.trimEnd ||
            v.x < x(p.music.trimEnd - p.music.trimStart + p.music.offset)),
      );
  return (
    <section className="timeline">
      <header>
        <div>
          <span className="eyebrow">SEQUENCE</span>
          <small>
            {p.moves.length} moves · {clock(length)}
          </small>
        </div>
        <button
          title="Jump to the previous effect, annotation or keyframe"
          onClick={() =>
            seek(events.filter((t) => t < time - 0.001).at(-1) ?? 0)
          }
        >
          Previous event
        </button>
        <button
          title="Jump to the next effect, annotation or keyframe"
          onClick={() => seek(events.find((t) => t > time + 0.001) ?? length)}
        >
          Next event
        </button>
        <button
          onClick={() =>
            setZoom(
              Math.max(
                0.5,
                (host.current?.clientWidth ?? 760) / Math.max(1, length * 18),
              ),
            )
          }
        >
          Fit timeline
        </button>
        <button onClick={() => seek(Math.max(0, time - 1 / 60))}>
          − Frame
        </button>
        <button onClick={() => seek(Math.min(length, time + 1 / 60))}>
          + Frame
        </button>
        <select
          aria-label="Toggle timeline track"
          title="Show or hide a timeline track without changing the composition."
          aria-description="Show or hide a timeline track without changing the composition."
          value=""
          onChange={(e) => {
            const v = e.target.value;
            setHiddenTracks((t) =>
              t.includes(v) ? t.filter((k) => k !== v) : [...t, v],
            );
          }}
        >
          <option value="">Tracks…</option>
          {["camera", "effect", "music"].map((t) => (
            <option key={t} value={t}>
              {hiddenTracks.includes(t) ? "Show" : "Hide"} {t}
            </option>
          ))}
        </select>
        <output aria-label="Timeline playhead">{clock(time)}</output>
        <label title="Lock beat markers to prevent accidental edits">
          <input
            type="checkbox"
            aria-label="Lock beat markers"
            title="Prevent beat marker dragging, keyboard edits and adding markers"
            aria-description="Prevent beat marker dragging, keyboard edits and adding markers"
            checked={p.beatsLocked}
            onChange={(e) =>
              edit("Lock beat markers", (p) => {
                p.beatsLocked = e.target.checked;
              })
            }
          />{" "}
          Lock beats
        </label>
        <label title="Snap the playhead to clip boundaries; hold Alt to temporarily bypass snapping">
          <input
            type="checkbox"
            aria-label="Snap"
            title="Snap the playhead to clip boundaries; hold Alt to temporarily bypass snapping"
            aria-description="Snap the playhead to clip boundaries; hold Alt to temporarily bypass snapping"
            checked={snap}
            onChange={(e) => setSnap(e.target.checked)}
          />{" "}
          Snap
        </label>
        <label>
          Timeline zoom
          <button
            type="button"
            className="control-reset"
            aria-label="Reset Timeline zoom"
            title="Restore default timeline zoom"
            onClick={() => setZoom(1)}
          >
            ↺
          </button>
          <input
            title={settingHelp("Timeline zoom")}
            aria-description={settingHelp("Timeline zoom")}
            aria-label="Timeline zoom"
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(+e.target.value)}
          />
        </label>
      </header>
      <div className="timeline-body">
        <div className="track-labels">
          <span>TIME</span>
          <span>MOVES</span>
          <span hidden={hiddenTracks.includes("camera")}>CAMERA</span>
          <span hidden={hiddenTracks.includes("effect")}>BADGES / FX</span>
          <span>ANNOTATIONS</span>
          <span hidden={hiddenTracks.includes("music")}>MUSIC / BEATS</span>
        </div>
        <div className="timeline-scroll" ref={host}>
          <div
            className="tracks"
            style={{ width }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) pointer(e);
            }}
            onPointerUp={() => {
              dragged.current = null;
            }}
            onDoubleClick={(e) => {
              if (p.beatsLocked) return;
              const r = e.currentTarget.getBoundingClientRect(),
                at = ((e.clientX - r.left) / r.width) * length;
              edit("Add beat", (p) => {
                p.beats.push({
                  id: crypto.randomUUID(),
                  time: at,
                  accent: false,
                  enabled: true,
                });
              });
            }}
          >
            <div className="ruler">
              {Array.from(
                {
                  length: Math.ceil(length / Math.max(1, Math.ceil(5 / zoom))),
                },
                (_, i) => i * Math.max(1, Math.ceil(5 / zoom)),
              ).map((t) => (
                <span key={t} style={{ left: x(t) }}>
                  {clock(t)}
                </span>
              ))}
            </div>
            <div className="move-track">
              {p.lead > 0 && (
                <button
                  aria-label="Select intro clip"
                  title="Edit the opener before the first move"
                  className={introSelected ? "selected" : "intro-clip"}
                  style={{ left: 0, width: Math.max(14, x(p.lead) - 2) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={selectIntro}
                >
                  <strong>Intro</strong>
                  <small>
                    {p.boardFX.intro ? p.boardFX.introPreset : "hold"}
                  </small>
                </button>
              )}
              {seq.map((s, i) => (
                <button
                  key={p.moves[i].id}
                  className={
                    !introSelected && selected === i
                      ? "selected"
                      : checked.has(p.moves[i].id)
                        ? "checked"
                        : ""
                  }
                  style={{
                    left: x(s.start),
                    width: Math.max(14, x(s.end - s.start) - 2),
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(event) => select(i, event)}
                >
                  <span
                    className="clip-resize"
                    role="slider"
                    aria-label={`Duration of ${p.moves[i].san}`}
                    aria-valuemin={0.2}
                    aria-valuemax={30}
                    aria-valuenow={p.moves[i].effect.duration}
                    tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      edit.begin();
                      resize.current = {
                        i,
                        x: e.clientX,
                        duration: p.moves[i].effect.duration,
                        scale: width / length,
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      const d = resize.current;
                      if (!d) return;
                      e.stopPropagation();
                      let value = d.duration + (e.clientX - d.x) / d.scale;
                      if (snap && !e.altKey)
                        value = Math.round(value * 20) / 20;
                      edit("Resize move", (p) => {
                        p.moves[d.i].effect.duration = Math.max(
                          0.2,
                          Math.min(30, value),
                        );
                      });
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      resize.current = null;
                      edit.end();
                    }}
                    onLostPointerCapture={() => {
                      resize.current = null;
                      edit.end();
                    }}
                    onKeyDown={(e) => {
                      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                        e.preventDefault();
                        e.stopPropagation();
                        edit("Resize move", (p) => {
                          p.moves[i].effect.duration = Math.max(
                            0.2,
                            Math.min(
                              30,
                              p.moves[i].effect.duration +
                                (e.key === "ArrowRight" ? 0.05 : -0.05),
                            ),
                          );
                        });
                      }
                    }}
                  >
                    ⋮
                  </span>
                  <strong>{p.moves[i].san}</strong>
                  <small>
                    {p.moves[i].effect.preset}
                    {p.moves[i].effect.jam.enabled ? " · beat" : ""}
                  </small>
                </button>
              ))}
            </div>
            <div
              className="camera-track"
              hidden={hiddenTracks.includes("camera")}
            >
              {seq.map((s, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(event) => select(i, event)}
                  style={{
                    left: x(s.start),
                    width: Math.max(8, x(s.end - s.start) - 3),
                  }}
                >
                  {p.moves[i].effect.cameras[p.format]?.mode ?? "Route"}
                </button>
              ))}
            </div>
            <div
              className="effect-track"
              hidden={hiddenTracks.includes("effect")}
            >
              {seq.map((s, i) => (
                <button
                  key={i}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(event) => select(i, event)}
                  style={{
                    left: x(s.start),
                    width: Math.max(8, x(s.end - s.start) - 3),
                  }}
                >
                  {[
                    p.moves[i].effect.badge.manual,
                    p.moves[i].effect.jam.enabled ? "Spotlight" : "",
                    p.moves[i].effect.keys.opacity?.length ? "Opacity" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Move FX"}
                </button>
              ))}
            </div>
            <div className="annotation-track">
              {p.annotations.map((a) => (
                <AnnotationRegion
                  key={a.id}
                  a={a}
                  pixels={width / length}
                  snap={snap}
                  seek={seek}
                  edit={edit}
                />
              ))}
            </div>
            <div
              className="music-track"
              hidden={hiddenTracks.includes("music")}
            >
              <svg width={width} height={44} aria-label="Music waveform">
                <path
                  d={wave
                    .map(
                      (v) => `M${v.x},${22 - v.v * 18}L${v.x},${22 + v.v * 18}`,
                    )
                    .join("")}
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="1.1"
                />
              </svg>
              {p.beats.map((b) => (
                <div
                  role="slider"
                  title="Drag this beat marker to correct its project time. Arrow keys move it by 0.01 seconds."
                  aria-label={"Beat " + b.time.toFixed(2)}
                  aria-valuenow={b.time}
                  tabIndex={0}
                  key={b.id}
                  className={
                    "beat " +
                    (b.accent ? "accent" : "") +
                    (b.enabled ? "" : " disabled")
                  }
                  style={{ left: x(b.time) }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (p.beatsLocked) return;
                    dragged.current = b.id;
                    (
                      e.currentTarget.parentElement!
                        .parentElement as HTMLElement
                    ).setPointerCapture(e.pointerId);
                  }}
                  onKeyDown={(e) => {
                    if (p.beatsLocked) return;
                    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                      e.preventDefault();
                      edit("Move beat", (p) => {
                        const v = p.beats.find((v) => v.id === b.id)!;
                        v.time = Math.max(
                          0,
                          v.time + (e.key === "ArrowRight" ? 0.01 : -0.01),
                        );
                        if (v.sourceTime !== undefined)
                          v.sourceTime =
                            v.time + p.music.trimStart - p.music.offset;
                      });
                    }
                  }}
                >
                  <span>◆</span>
                </div>
              ))}
            </div>
            <div className="playhead" style={{ left: x(time) }}>
              <span />
            </div>
          </div>
        </div>
      </div>
      <footer>
        Drag clip right edge to resize · Alt bypasses snapping · Double-click
        empty space to add a beat
      </footer>
    </section>
  );
}
