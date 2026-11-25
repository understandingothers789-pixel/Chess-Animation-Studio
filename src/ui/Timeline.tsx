import {
  activeBeats,
  beatInMusic,
  describeHit,
  setBeatTime,
} from "../core/beatMarkers";
import { BulkEditPanel } from "./timeline/BulkEditPanel";
import type { AnnotationStyle } from "./commands/annotationCommands";
import {
  timelineCommands,
  type TimelineTarget,
} from "./commands/timelineCommands";
import type { SettingsClipboard, SettingsKind } from "../core/editing";
import { TimelineMenu, type MenuAction } from "./timeline/TimelineMenu";
import { ControlGroup } from "./timeline/ControlGroup";
import { MoveClip } from "./timeline/MoveClip";
import { AnnotationRegion } from "./timeline/AnnotationRegion";
import { settingHelp } from "./help";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  afterEffectWindow,
  compileTimeline,
  memeWindow,
  spotlightStart,
  spotlightPeaks,
  stepFrame,
} from "../core/timeline";
import { type Project, type Effect } from "../core/project";
import type { Edit } from "./state";
import { clock } from "./controls";
export function Timeline({
  project: p,
  fps,
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
  addToStoryboard,
}: {
  project: Project;
  fps: number;
  addToStoryboard?: (ids: string[]) => void;
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
  navigate: (category: string, section?: string, control?: string) => void;
  preview: (index: number) => void;
  report: (message: string) => void;
  inspect: (index: number, section: string, annotation?: string) => void;
}) {
  const [bulk, setBulk] = useState<{
    sourceId: string;
    kind: SettingsKind;
  } | null>(null);
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
  useEffect(() => {
    setBulk(null);
  }, [p.id]);
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
    { duration: length, segments: seq } = compileTimeline(p),
    width = Math.max(1, length * 52 * zoom),
    pixels = length > 0 ? width / length : 0,
    x = (t: number) => t * pixels;
  const cues = useMemo(() => {
    const active = introSelected ? undefined : seq[selected];
    if (!active) return [];
    const effect = p.moves[active.i].effect;
    const markers = [
      { label: "Departure", time: active.depart, detail: "" },
      { label: "Landing", time: active.land, detail: "" },
    ];
    const meme = memeWindow(effect, active);
    if (meme)
      markers.push({ label: "Meme starts", time: meme.start, detail: "" });
    if (effect.jam.enabled) {
      const start = spotlightStart(effect, active);
      for (const peak of spotlightPeaks(p, effect, start))
        markers.push({
          label: "Zoom beat",
          time: peak.time,
          detail: peak.clock,
        });
      markers.push({
        label: "Spotlight end",
        time: start + effect.jam.duration,
        detail: "",
      });
    }
    const after = afterEffectWindow(effect, active);
    if (after)
      markers.push(
        { label: "After-effect start", time: after.start, detail: "" },
        {
          label: "After-effect peak",
          time: (after.start + after.end) / 2,
          detail: "",
        },
        { label: "After-effect end", time: after.end, detail: "" },
      );
    return markers;
  }, [introSelected, p, selected, seq]);
  const events = useMemo(
    () =>
      [
        ...cues.map((cue) => cue.time),
        ...seq.flatMap((s, i) => [
          s.land,
          ...Object.values(p.moves[i].effect.keys).flatMap((keys) =>
            (keys ?? []).map(
              (k) => s.depart + k.at * p.moves[i].effect.duration,
            ),
          ),
        ]),
        ...p.annotations.flatMap((a) => [a.start, a.end]),
      ].sort((a, b) => a - b),
    [cues, p, seq],
  );
  const boundaries = useMemo(
    () => [
      0,
      p.lead,
      length,
      ...seq.flatMap((segment) => [segment.start, segment.end, segment.land]),
      ...activeBeats(p).map((beat) => beat.time),
      ...cues.map((cue) => cue.time),
    ],
    [cues, length, p, seq],
  );
  const dragged = useRef<string | null>(null);
  const pointer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
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
        setBeatTime(p, b, beatTime);
      });
    } else {
      const nearest = boundaries.reduce(
        (best, boundary) =>
          Math.abs(boundary - t) < Math.abs(best - t) ? boundary : best,
        boundaries[0],
      );
      seek(
        snap &&
          !e.altKey &&
          length > 0 &&
          (Math.abs(nearest - t) * r.width) / length <= 8
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
  const [waveformPath, rmsPath] = useMemo(() => {
    const sourceLength = p.music.sourceDuration || length;
    const trimEnd = p.music.trimEnd || Infinity;
    return [p.waveform, p.waveformRms].map((bins) =>
      bins
        .map((value, i) => {
          const source = ((i + 0.5) / bins.length) * sourceLength;
          if (source < p.music.trimStart || source >= trimEnd) return "";
          const x = (source - p.music.trimStart + p.music.offset) * pixels;
          return `M${x},${22 - value * 18}L${x},${22 + value * 18}`;
        })
        .join(""),
    );
  }, [length, p.music, p.waveform, p.waveformRms, pixels]);
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
    const keyboard =
      e.type === "keydown" ||
      (e.button !== 2 && e.clientX === 0 && e.clientY === 0);
    setMenu({
      x: keyboard ? rect.left : e.clientX,
      y: keyboard ? rect.bottom : e.clientY,
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
        addToStoryboard,
        bulk: (sourceId, kind) => setBulk({ sourceId, kind }),
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
            onClick={() => seek(Math.max(0, stepFrame(time, fps, -1)))}
          >
            − Frame
          </button>
          <button
            title="Next frame"
            aria-label="Next frame"
            onClick={() => seek(Math.min(length, stepFrame(time, fps, 1)))}
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
          <label title="Snap the playhead to beats and clip events; hold Alt to temporarily bypass snapping">
            <input
              type="checkbox"
              aria-label="Snap"
              title="Snap the playhead to beats and clip events; hold Alt to temporarily bypass snapping"
              aria-description="Snap the playhead to beats and clip events; hold Alt to temporarily bypass snapping"
              checked={snap}
              onChange={(e) => setSnap(e.target.checked)}
            />{" "}
            Snap
          </label>
        </ControlGroup>
      </header>
      {bulk && (
        <BulkEditPanel
          project={p}
          sourceId={bulk.sourceId}
          initialKind={bulk.kind}
          checked={checked}
          edit={edit}
          report={report}
          close={() => setBulk(null)}
        />
      )}
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
          onClick={() => inspect(activeIndex, "move")}
        >
          Edit
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
          More actions…
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
              {cues.map((cue, index) => (
                <button
                  key={index}
                  className="move-timing-marker"
                  style={{ left: x(cue.time) }}
                  title={`${cue.label} at ${cue.time.toFixed(3)} s${cue.detail ? " · " + cue.detail : ""}`}
                  aria-label={`${cue.label} at ${cue.time.toFixed(3)} seconds`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => seek(cue.time)}
                >
                  ◆
                </button>
              ))}
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
                  pixels={pixels}
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
                    p.moves[i].effect.preMoveMeme ? "Meme" : "",
                    p.moves[i].effect.jam.enabled ? "Spotlight" : "",
                    p.moves[i].effect.after.kind !== "none"
                      ? "After effect"
                      : "",
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
                  pixels={pixels}
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
                  d={waveformPath}
                  stroke="currentColor"
                  fill="none"
                  strokeWidth="1.1"
                  opacity={rmsPath ? 0.55 : 1}
                />
                {rmsPath && (
                  <path
                    d={rmsPath}
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="1.25"
                  />
                )}
              </svg>
              {p.beats
                .filter((b) => beatInMusic(p, b))
                .map((b) => (
                  <div
                    data-beat-id={b.id}
                    role="slider"
                    title={`${describeHit(b)}${b.strength === undefined ? "" : ` · strength ${Math.round(b.strength * 100)}%`}. Drag or use arrow keys to adjust.`}
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
                          setBeatTime(
                            p,
                            v,
                            v.time + (e.key === "ArrowRight" ? 0.01 : -0.01),
                          );
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
