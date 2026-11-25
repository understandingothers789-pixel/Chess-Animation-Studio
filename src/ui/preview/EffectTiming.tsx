import {
  activeBeats,
  describeHit,
  strongestBeat,
} from "../../core/beatMarkers";
import { useRef, useState } from "react";
import type { Project } from "../../core/project";
import { moveEffectTiming } from "../movePreview";
import {
  proposeTiming,
  timingFields,
  timingValue,
  type TimingField,
} from "../effectTimingEdit";
import type { Edit } from "../state";
import { Range } from "../controls";

export function EffectTiming({
  project,
  index,
  time,
  seek,
  onTune,
  edit,
}: {
  project: Project;
  index: number;
  time: number;
  seek: (time: number) => void;
  onTune?: (section: string) => void;
  edit?: Edit;
}) {
  const move = project.moves[index];
  const effect = move.effect;
  const committed = moveEffectTiming(project, index)!;
  const [draft, setDraft] = useState<{
    base: Project;
    field: TimingField;
    value: number;
    landing: string | null;
    zoomBeat: string | null;
  }>();
  const drag = useRef<
    { x: number; width: number; duration: number; value: number } | undefined
  >(undefined);
  const active = draft?.base === project && !effect.locked ? draft : undefined;
  const propose =
    active &&
    proposeTiming(
      project,
      index,
      active.field,
      active.value,
      active.landing,
      active.zoomBeat,
    );
  const timing = propose ? moveEffectTiming(propose.next, index)! : committed;
  const begin = (field: TimingField) => ({
    base: project,
    field,
    value: timingValue(effect, field),
    landing: effect.landingBeat,
    zoomBeat: effect.jam.beat ?? null,
  });
  const beats = activeBeats(project);
  const nearbyLanding = strongestBeat(
    beats.filter((b) => {
      const duration = (b.time - timing.segment.depart) / effect.landing;
      return (
        duration >= 0.2 &&
        duration <= 30 &&
        Math.abs(b.time - timing.segment.land) <= 1.2
      );
    }),
    timing.segment.land,
  );
  const zoomWindow = timing.rows.find(
    (row) => row.section === "spotlight",
  )?.window;
  const zoomHits = zoomWindow
    ? beats.filter((b) => b.time >= zoomWindow.start && b.time < zoomWindow.end)
    : [];
  const zoomHit = strongestBeat(
    zoomHits.filter(
      (b) =>
        b.time >= (zoomWindow?.start ?? 0) + 0.08 &&
        b.time <= (zoomWindow?.end ?? 0) - 0.12,
    ),
    timing.segment.land,
  );
  const fieldFor: Partial<Record<string, TimingField>> = {
    meme: "meme",
    move: "move",
    "after-effect": "afterDuration",
    spotlight: "spotlight",
  };
  const setValue = (value: number) => setDraft((d) => d && { ...d, value });
  const { start, end } = timing.segment;
  const percent = (t: number) =>
    `${Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100))}%`;
  return (
    <details className="move-effect-timing">
      <summary>Effect timing</summary>
      <div className="move-effect-rows">
        {timing.rows.map(({ label, section, window }) => {
          const field = fieldFor[section];
          const editable = Boolean(field && edit && !effect.locked && window);
          const detail = window
            ? `${(window.start - start).toFixed(2)}–${(window.end - start).toFixed(2)} s`
            : section === "size"
              ? "Normal size"
              : "Off";
          return (
            <div className="move-effect-row" key={section}>
              <span>
                {label}
                <small>{detail}</small>
              </span>
              <div className="timing-track-wrap">
                <button
                  type="button"
                  className="move-effect-track"
                  disabled={!window}
                  aria-label={`Seek to ${label.toLowerCase()} midpoint`}
                  title={detail}
                  onClick={() => {
                    const actual = committed.rows.find(
                      (row) => row.section === section,
                    )?.window;
                    if (actual) seek((actual.start + actual.end) / 2);
                  }}
                >
                  {window && (
                    <span
                      className="move-effect-band"
                      style={{
                        left: percent(window.start),
                        right: `calc(100% - ${percent(window.end)})`,
                      }}
                    />
                  )}
                  <span
                    className="move-effect-cursor"
                    style={{ left: percent(time) }}
                  />
                </button>
                {editable && field && window && (
                  <button
                    className="timing-handle"
                    type="button"
                    title="Drag to propose a new length"
                    aria-label={`Adjust ${label.toLowerCase()} timing`}
                    style={{
                      left: percent(
                        field === "meme" ? window.start : window.end,
                      ),
                    }}
                    onClick={(event) => {
                      if (event.detail === 0) setDraft(begin(field));
                    }}
                    onPointerDown={(event) => {
                      const row =
                        event.currentTarget.parentElement!.getBoundingClientRect();
                      const next = begin(field);
                      drag.current = {
                        x: event.clientX,
                        width: row.width,
                        duration: end - start,
                        value: next.value,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraft(next);
                    }}
                    onPointerMove={(event) => {
                      const data = drag.current;
                      if (
                        !data ||
                        !event.currentTarget.hasPointerCapture(event.pointerId)
                      )
                        return;
                      const { min, max } = timingFields[field];
                      const delta =
                        ((event.clientX - data.x) / data.width) *
                        data.duration *
                        (field === "meme" ? -1 : 1);
                      setValue(
                        Math.min(
                          max,
                          Math.max(
                            min,
                            Math.round((data.value + delta) * 100) / 100,
                          ),
                        ),
                      );
                    }}
                    onLostPointerCapture={() => {
                      drag.current = undefined;
                    }}
                    onPointerCancel={() => {
                      drag.current = undefined;
                      setDraft(undefined);
                    }}
                  >
                    ⋮
                  </button>
                )}
              </div>
              {onTune && (
                <button
                  type="button"
                  aria-label={`Tune ${label.toLowerCase()}`}
                  onClick={() => onTune(section)}
                >
                  Tune
                </button>
              )}
            </div>
          );
        })}
        {effect.locked && (
          <p className="hint">Timing is locked for this move.</p>
        )}
        {active && (
          <div className="timing-proposal">
            {active.field.startsWith("after") && (
              <select
                aria-label="After-effect timing field"
                value={active.field}
                onChange={(event) =>
                  setDraft({
                    ...active,
                    ...begin(event.target.value as TimingField),
                  })
                }
              >
                <option value="afterDuration">After-effect length</option>
                <option value="afterDelay">After-effect delay</option>
              </select>
            )}
            <Range
              {...timingFields[active.field]}
              label={timingFields[active.field].label}
              value={active.value}
              unit="s"
              onChange={setValue}
            />
            <label>
              Landing beat
              <select
                aria-label="Timing strip landing beat"
                value={active.landing ?? ""}
                onChange={(event) =>
                  setDraft({ ...active, landing: event.target.value || null })
                }
              >
                <option value="">No assignment</option>
                {beats.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.time.toFixed(3)} s · {describeHit(b)}
                  </option>
                ))}
              </select>
            </label>
            {effect.jam.enabled && (
              <label>
                First beat zoom pulse
                <select
                  aria-label="Timing strip beat zoom marker"
                  value={active.zoomBeat ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...active,
                      zoomBeat: event.target.value || null,
                    })
                  }
                >
                  <option value="">Use beat zoom clock</option>
                  {zoomHits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.time.toFixed(3)} s · {describeHit(b)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="button-row">
              <button
                type="button"
                disabled={!nearbyLanding}
                onClick={() =>
                  nearbyLanding &&
                  setDraft({ ...active, landing: nearbyLanding.id })
                }
              >
                Land on strongest nearby hit
              </button>
              {effect.jam.enabled && (
                <button
                  type="button"
                  disabled={!zoomHit}
                  onClick={() =>
                    zoomHit && setDraft({ ...active, zoomBeat: zoomHit.id })
                  }
                >
                  Zoom on strongest hit
                </button>
              )}
            </div>
            <p role="status">
              {propose
                ? `Later moves shift ${propose.shift >= 0 ? "+" : ""}${propose.shift.toFixed(3)} s.`
                : "This timing cannot keep the chosen marker. Adjust the length, choose another beat, or clear the assignment."}
            </p>
            <div className="button-row">
              <button type="button" onClick={() => setDraft(undefined)}>
                Cancel timing edit
              </button>
              <button
                type="button"
                className="primary"
                disabled={!propose}
                onClick={() => {
                  if (!propose || !edit) return;
                  edit.begin();
                  try {
                    edit("Edit move effect timing", (p) => {
                      const target = p.moves.find((m) => m.id === move.id);
                      if (target && !target.effect.locked)
                        target.effect = propose.effect;
                    });
                  } finally {
                    edit.end();
                  }
                  setDraft(undefined);
                }}
              >
                Apply timing
              </button>
            </div>
          </div>
        )}
        {onTune && (
          <button type="button" onClick={() => onTune("timing")}>
            Tune timing &amp; landing
          </button>
        )}
        <p className="hint">
          Drag a handle or focus it and press Enter to propose timing for the
          active move.
        </p>
      </div>
    </details>
  );
}
