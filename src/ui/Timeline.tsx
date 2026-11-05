import type { AnnotationStyle } from "./commands/annotationCommands";
import {
  timelineCommands,
  type TimelineTarget,
} from "./commands/timelineCommands";
import type { SettingsClipboard } from "../core/editing";
import { TimelineMenu, type MenuAction } from "./timeline/TimelineMenu";
import { ControlGroup } from "./timeline/ControlGroup";
import { MoveClip } from "./timeline/MoveClip";
import { AnnotationRegion } from "./timeline/AnnotationRegion";
import { settingHelp } from "./help";
import { useEffect, useRef, useState } from "react";
import { segments, duration } from "../core/timeline";
import { type Project, type Effect } from "../core/project";
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
  contextSelect,
  seek,
  edit,
  navigate,
  clipboard,
  preview,
  report,
  inspect,
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
  contextSelect: (index: number) => void;
  seek: (t: number) => void;
  edit: Edit;
  clipboard: { current: SettingsClipboard | null };
  navigate: (category: string, section?: string) => void;
  preview: (index: number) => void;
  report: (message: string) => void;
  inspect: (index: number, section: string, annotation?: string) => void;
}) {
  const [menu, setMenu] = useState<TimelineTarget | null>(null);
  useEffect(() => {
    if (
      menu?.id &&
      ((menu.track === "annotation" &&
        !p.annotations.some((a) => a.id === menu.id)) ||
        (menu.track === "music" && !p.beats.some((b) => b.id === menu.id)))
    )
      setMenu(null);
  }, [p.annotations, p.beats]);
  useEffect(() => {
    setMenu(null);
  }, [p]);
  const copied = clipboard;
  const annotationStyle = useRef<AnnotationStyle | null>(null);
  const [zoom, setZoom] = useState(() => {
    const value = Number(localStorage.getItem("studio.timeline.zoom") || "1");
    return Number.isFinite(value) ? Math.max(0.02, Math.min(6, value)) : 1;
  });
  useEffect(() => {
    localStorage.setItem("studio.timeline.zoom", String(zoom));
  }, [zoom]);
  const [hiddenTracks, setHiddenTracks] = useState<string[]>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("studio.timeline.tracks") || "[]",
      );
      return Array.isArray(value)
        ? value.filter((v) =>
            ["camera", "effect", "music", "annotation"].includes(v),
          )
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem(
      "studio.timeline.tracks",
      JSON.stringify(hiddenTracks),
    );
  }, [hiddenTracks]);
  const [snap, setSnap] = useState(
    () => localStorage.getItem("studio.timeline.snap") !== "false",
  );
  useEffect(() => {
    localStorage.setItem("studio.timeline.snap", String(snap));
  }, [snap]);
  const host = useRef<HTMLDivElement>(null),
    length = duration(p),
    seq = segments(p),
    width = Math.max(1, length * 52 * zoom),
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
      const beatTime = snap && !e.altKey ? Math.round(t * 20) / 20 : t;
      edit("Drag beat", (p) => {
        const b = p.beats.find((b) => b.id === id)!;
        b.time = beatTime;
        if (b.sourceTime !== undefined)
          b.sourceTime = beatTime + p.music.trimStart - p.music.offset;
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
  const activeIndex =
    checked.size && !checked.has(p.moves[selected]?.id)
      ? Math.max(
          0,
          p.moves.findIndex((m) => checked.has(m.id)),
        )
      : selected;
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
  const openMenu = (e: React.MouseEvent, trackOverride?: string) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    let track =
      (target.closest("[data-intro]") ? "intro" : trackOverride) ||
      target.closest<HTMLElement>("[data-track]")?.dataset.track ||
      "timeline";
    if (target.closest(".track-labels") && track !== "timeline")
      track = "header:" + track;
    const clip = target.closest<HTMLElement>("[data-move-index]");
    if (!clip && ["move", "camera", "effect"].includes(track))
      track = "header:" + track;
    const r = host.current?.querySelector(".tracks")?.getBoundingClientRect();
    const rawAt =
      r && e.clientX && !target.closest(".track-labels")
        ? Math.max(
            0,
            Math.min(length, ((e.clientX - r.left) / r.width) * length),
          )
        : time;
    const at =
      track === "music" && snap && !e.altKey
        ? Math.min(length, Math.max(0, Math.round(rawAt * 20) / 20))
        : rawAt;
    const index = clip ? Number(clip.dataset.moveIndex) : selected;
    if (clip) contextSelect(index);
    const rect = target.getBoundingClientRect();
    setMenu({
      x: e.clientX || rect.left,
      y: e.clientY || rect.bottom,
      track,
      index,
      at,
      id:
        target.closest<HTMLElement>("[data-annotation-id],[data-beat-id]")
          ?.dataset.annotationId ||
        target.closest<HTMLElement>("[data-beat-id]")?.dataset.beatId,
    });
  };
  const actions = menu
    ? timelineCommands({
        p,
        menu,
        time,
        selected,
        checked,
        edit,
        copied,
        annotationStyle,
        inspect,
        navigate,
        preview,
        report,
        seek,
        viewportWidth: host.current?.clientWidth ?? 760,
        setZoom,
        setSnap,
        snap,
        setHiddenTracks,
        hiddenTracks,
      })
    : [];
  return (
    <section
      className="timeline"
      onContextMenu={openMenu}
      onKeyDown={(e) => {
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))
          openMenu(e as unknown as React.MouseEvent);
      }}
    >
      {menu && (
        <TimelineMenu
          x={menu.x}
          y={menu.y}
          title={
            {
              intro: "Intro & title",
              move: "Move · " + (p.moves[menu.index]?.san ?? "Settings"),
              camera: "Camera · " + (p.moves[menu.index]?.san ?? "Settings"),
              effect:
                "Badges & effects · " +
                (p.moves[menu.index]?.san ?? "Settings"),
              annotation:
                "Annotation · " +
                (p.annotations.find((a) => a.id === menu.id)?.kind ?? "Track"),
              music: "Music & beats",
              timeline: "Timeline",
            }[menu.track] ||
            (menu.track.startsWith("header:")
              ? menu.track.slice(7) + " track"
              : "Timeline")
          }
          execute={(run) => {
            edit.begin();
            try {
              run();
            } finally {
              edit.end();
            }
          }}
          actions={actions}
          close={() => setMenu(null)}
        />
      )}
      <header>
        <div>
          <span className="eyebrow">SEQUENCE</span>
          <small>
            {p.moves.length} moves · {clock(length)}
          </small>
        </div>
        <ControlGroup label="Navigate" name="Timeline navigation" className="">
          {" "}
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
            title="Previous frame"
            aria-label="Previous frame"
            onClick={() => seek(Math.max(0, time - 1 / 60))}
          >
            − Frame
          </button>
          <button
            title="Next frame"
            aria-label="Next frame"
            onClick={() => seek(Math.min(length, time + 1 / 60))}
          >
            + Frame
          </button>
        </ControlGroup>
        <ControlGroup
          label="View"
          name="Timeline view"
          className="timeline-view"
        >
          {" "}
          <button
            onClick={() =>
              setZoom(
                Math.max(
                  0.02,
                  (host.current?.clientWidth ?? 760) / Math.max(1, length * 52),
                ),
              )
            }
          >
            Fit timeline
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
            {["camera", "effect", "annotation", "music"].map((t) => (
              <option key={t} value={t}>
                {hiddenTracks.includes(t) ? "Show" : "Hide"} {t}
              </option>
            ))}
          </select>
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
              min={0.02}
              max={6}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
            />
          </label>
        </ControlGroup>
        <output aria-label="Timeline playhead">{clock(time)}</output>
        <ControlGroup
          label="Behavior"
          name="Timeline editing behavior"
          className="timeline-behavior"
        >
          {" "}
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
        </ControlGroup>
      </header>
      <div className="selection-tools" aria-label="Selection actions">
        <strong>
          {checked.size > 1
            ? `${checked.size} moves selected`
            : (p.moves[selected]?.san ?? "No move")}
        </strong>
        <button
          disabled={!p.moves[selected]}
          onClick={() => preview(activeIndex)}
        >
          Preview
        </button>
        <button
          disabled={!p.moves[selected]}
          onClick={() => navigate("presets")}
        >
          Preset
        </button>
        <button
          disabled={!p.moves[selected]}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({
              x: r.left,
              y: r.bottom,
              track: "move",
              index: activeIndex,
              at: time,
            });
          }}
        >
          Edit / Apply…
        </button>
      </div>
      <div className="timeline-body">
        <div className="track-labels">
          {[
            ["timeline", "TIME"],
            ["move", "MOVES"],
            ["camera", "CAMERA"],
            ["effect", "BADGES / FX"],
            ["annotation", "ANNOTATIONS"],
            ["music", "MUSIC / BEATS"],
          ].map(([track, label]) => (
            <button
              key={track}
              data-track={track}
              hidden={hiddenTracks.includes(track)}
              title={`Open ${label.toLowerCase()} menu`}
              onClick={(e) => openMenu(e, track)}
            >
              {label}
              <span aria-hidden="true">⋯</span>
            </button>
          ))}
        </div>
        <div className="timeline-scroll" ref={host}>
          <div
            className="tracks"
            style={{ width }}
            onPointerDown={(e) => {
              if (e.button !== 0 || (e.target as HTMLElement).closest("button"))
                return;
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) pointer(e);
            }}
            onPointerUp={() => {
              if (dragged.current) edit.end();
              dragged.current = null;
            }}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest("button,[role=slider]"))
                return;
              const lane =
                e.currentTarget.querySelector<HTMLElement>(".music-track");
              const laneRect = lane?.getBoundingClientRect();
              if (
                p.beatsLocked ||
                !laneRect ||
                lane?.hidden ||
                e.clientY < laneRect.top ||
                e.clientY > laneRect.bottom
              )
                return;
              const r = e.currentTarget.getBoundingClientRect(),
                raw = ((e.clientX - r.left) / r.width) * length,
                at = snap && !e.altKey ? Math.round(raw * 20) / 20 : raw;
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
            <div data-track="move" className="move-track">
              {p.lead > 0 && (
                <button
                  data-intro
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
                <MoveClip
                  key={p.moves[i].id}
                  move={p.moves[i]}
                  index={i}
                  left={x(s.start)}
                  width={Math.max(2, x(s.end - s.start) - 2)}
                  pixels={width / length}
                  selected={!introSelected && selected === i}
                  checked={checked.has(p.moves[i].id)}
                  snap={snap}
                  edit={edit}
                  select={select}
                />
              ))}
            </div>
            <div
              data-track="camera"
              className="camera-track"
              hidden={hiddenTracks.includes("camera")}
            >
              {seq.map((s, i) => (
                <button
                  data-move-index={i}
                  key={i}
                  className={
                    !introSelected && selected === i
                      ? "selected"
                      : checked.has(p.moves[i].id)
                        ? "checked"
                        : ""
                  }
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
              data-track="effect"
              className="effect-track"
              hidden={hiddenTracks.includes("effect")}
            >
              {seq.map((s, i) => (
                <button
                  data-move-index={i}
                  key={i}
                  className={
                    !introSelected && selected === i
                      ? "selected"
                      : checked.has(p.moves[i].id)
                        ? "checked"
                        : ""
                  }
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
            <div
              data-track="annotation"
              className="annotation-track"
              hidden={hiddenTracks.includes("annotation")}
            >
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
              data-track="music"
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
                  data-beat-id={b.id}
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
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    if (p.beatsLocked) return;
                    edit.begin();
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
        Right-click a clip or track for options · Drag clip right edge to resize
        · Alt bypasses snapping · Double-click empty music lane to add a beat
      </footer>
    </section>
  );
}
