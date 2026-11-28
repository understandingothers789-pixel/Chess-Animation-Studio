import { useMemo, useState } from "react";
import {
  pulseSensitivity,
  selectBoardPulses,
  setPulseOverride,
  type PulseOverride,
} from "../../core/boardPulse";
import { describeHit, outputBeats } from "../../core/beatMarkers";
import type { PlaybackMode, Project } from "../../core/project";
import { firstMatchingIndex } from "../../core/sorted";
import { Select } from "../controls";
import type { Edit } from "../state";

export function PulseOverrideSelect({
  beat,
  mode,
  edit,
}: {
  beat: Pick<Project["beats"][number], "id" | "time" | "pulseOverride">;
  mode: PlaybackMode;
  edit: Edit;
}) {
  return (
    <select
      aria-label={`Dark-square flash at ${beat.time.toFixed(3)}s`}
      title="Always flash overrides sensitivity. Skip keeps this beat available for timing."
      value={beat.pulseOverride ?? "auto"}
      onChange={(event) => {
        const value = event.target.value as PulseOverride;
        edit("Set individual dark-square flash", (draft) =>
          setPulseOverride(draft, mode, beat.id, value),
        );
      }}
    >
      <option value="auto">Auto</option>
      <option value="off">Skip</option>
      <option value="on">Always flash</option>
    </select>
  );
}

const pageSize = 12;
const sensitivityDescriptions = {
  lenient: "Every enabled hit can flash.",
  balanced: "Stronger hits and marked accents can flash.",
  accents: "Only marked accents can flash.",
  strict: "The strongest accents flash at least 0.4 seconds apart.",
};

export function BoardPulseControls({
  p,
  mode,
  time,
  seek,
  edit,
}: {
  p: Project;
  mode: PlaybackMode;
  time: number;
  seek: (time: number) => void;
  edit: Edit;
}) {
  const [page, setPage] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "flashes" | "overrides">("all");
  const sensitivity = pulseSensitivity(p);
  const { markers, selected } = useMemo(
    () => ({
      markers: (mode === "storyboard" ? outputBeats(p) : [...p.beats]).sort(
        (a, b) => a.time - b.time,
      ),
      selected: new Set(selectBoardPulses(p, mode).map((beat) => beat.id)),
    }),
    [p, mode],
  );
  const beats = useMemo(
    () =>
      filter === "all"
        ? markers
        : markers.filter((beat) =>
            filter === "flashes"
              ? selected.has(beat.id)
              : beat.pulseOverride !== undefined,
          ),
    [filter, markers, selected],
  );
  const after = firstMatchingIndex(beats, (beat) => beat.time >= time);
  const previous = beats[after - 1];
  const nearest =
    previous && time - previous.time < (beats[after]?.time ?? Infinity) - time
      ? after - 1
      : after;
  const nearPage = Math.floor(nearest / pageSize);
  const lastPage = Math.max(0, Math.ceil(beats.length / pageSize) - 1);
  const currentPage = Math.min(page ?? nearPage, lastPage);
  const at = currentPage * pageSize;

  return (
    <>
      <Select
        label="Dark-square flash sensitivity"
        value={sensitivity}
        options={[
          ["lenient", "Lenient · all enabled hits"],
          ["balanced", "Balanced · stronger hits"],
          ["accents", "Accents only"],
          ["strict", "Strict · strongest accents"],
        ]}
        optionDescriptions={sensitivityDescriptions}
        onChange={(sensitivity) =>
          edit("Set dark-square flash sensitivity", (draft) => {
            draft.pulse.sensitivity = sensitivity;
            draft.pulse.accentsOnly =
              sensitivity === "accents" || sensitivity === "strict";
          })
        }
      />
      <p className="hint pulse-rule">{sensitivityDescriptions[sensitivity]}</p>
      <details className="pulse-list">
        <summary>
          Edit individual flashes{" "}
          <small>
            · {p.pulse.enabled ? `${selected.size} will flash` : "pulse off"}
          </small>
        </summary>
        {markers.length > 0 && (
          <Select
            label="Show flash markers"
            value={filter}
            options={[
              ["all", "All beats"],
              ["flashes", "Will flash"],
              ["overrides", "Manually edited"],
            ]}
            onChange={(value) => {
              setFilter(value);
              setPage(null);
            }}
          />
        )}
        {beats.length ? (
          <>
            <div className="pulse-pages">
              <button
                aria-label="Previous flash markers"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                ‹
              </button>
              <button onClick={() => setPage(null)}>Near playhead</button>
              <button
                aria-label="Next flash markers"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              >
                ›
              </button>
              <small>
                {at + 1}–{Math.min(at + pageSize, beats.length)} of{" "}
                {beats.length}
              </small>
            </div>
            <ul className="pulse-markers">
              {beats.slice(at, at + pageSize).map((beat, index) => (
                <li key={beat.id} data-nearest={at + index === nearest}>
                  <button
                    onClick={() => seek(beat.time)}
                    title={describeHit(beat)}
                    aria-current={at + index === nearest ? "time" : undefined}
                    aria-label={`Seek to flash marker at ${beat.time.toFixed(3)}s`}
                  >
                    {beat.time.toFixed(3)}s
                  </button>
                  <PulseOverrideSelect beat={beat} mode={mode} edit={edit} />
                  <small data-flash={selected.has(beat.id)}>
                    {p.pulse.enabled
                      ? selected.has(beat.id)
                        ? "Flash"
                        : "Skipped"
                      : selected.has(beat.id)
                        ? "Ready"
                        : "Skipped"}
                  </small>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="hint">
            {markers.length
              ? "No markers match this filter."
              : "Analyze the music or add a beat marker to edit flashes."}
          </p>
        )}
      </details>
    </>
  );
}
