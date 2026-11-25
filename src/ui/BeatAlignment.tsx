import { activeBeats, strongestBeat } from "../core/beatMarkers";
import { useState } from "react";
import type { Project } from "../core/project";
import { landingDuration } from "../core/audio";
import { segments, moveHold } from "../core/timeline";
import type { Edit } from "./state";
export function BeatAlignment({
  project: p,
  index,
  edit,
}: {
  project: Project;
  index: number;
  edit: Edit;
}) {
  const [offset, setOffset] = useState(0),
    [choice, setChoice] = useState<string | null>(null);
  const move = p.moves[index],
    segment = segments(p)[index];
  if (!move || !segment) return null;
  const beats = activeBeats(p).sort((a, b) => a.time - b.time);
  const reachable = beats.filter(
    (b) =>
      landingDuration(move.effect, segment.depart, b.time + offset) !== null,
  );
  const target = segment.land - offset;
  const nearest = reachable.reduce<(typeof reachable)[number] | undefined>(
    (best, candidate) =>
      !best || Math.abs(candidate.time - target) < Math.abs(best.time - target)
        ? candidate
        : best,
    undefined,
  );
  const strongest = strongestBeat(
    reachable.filter((b) => Math.abs(b.time - target) <= 1.2),
    target,
  );
  const beat = reachable.find((b) => b.id === choice);
  const anchor = beat?.time ?? target;
  let previous: (typeof reachable)[number] | undefined;
  for (const candidate of reachable) {
    if (candidate.time >= anchor - 0.001) break;
    previous = candidate;
  }
  const next = reachable.find((b) => b.time > anchor + 0.001);
  const duration = beat
    ? landingDuration(move.effect, segment.depart, beat.time + offset)
    : null;
  const shift =
    duration === null
      ? 0
      : duration +
        moveHold({ ...move.effect, duration }) -
        move.effect.duration -
        moveHold(move.effect);
  const assigned = beats.find((b) => b.id === move.effect.landingBeat);
  const misaligned =
    move.effect.landingBeat &&
    (!assigned || Math.abs(assigned.time - segment.land) > 0.02);
  return (
    <details>
      <summary>Align landing · active move {move.san}</summary>
      <p>
        {beats.length
          ? `${beats.length} enabled music markers`
          : "Add music beat markers to align a landing."}{" "}
        · landing {segment.land.toFixed(3)} s
      </p>
      {misaligned && (
        <p role="status">
          Landing differs from its assigned beat. Review the alignment after
          timing edits.
        </p>
      )}
      <label>
        Offset from beat (seconds)
        <input
          aria-label="Landing offset seconds"
          title="Move the proposed landing before or after the chosen beat, in seconds."
          aria-description="Move the proposed landing before or after the chosen beat, in seconds."
          type="number"
          step="0.01"
          min="-2"
          max="2"
          value={offset}
          onChange={(e) => {
            const n = e.target.valueAsNumber;
            if (Number.isFinite(n)) setOffset(Math.max(-2, Math.min(2, n)));
          }}
        />
      </label>
      <div className="button-row">
        <button
          disabled={!nearest || move.effect.locked}
          onClick={() => nearest && setChoice(nearest.id)}
        >
          Nearest beat
        </button>
        <button
          disabled={!strongest || move.effect.locked}
          onClick={() => setChoice(strongest!.id)}
        >
          Strongest nearby hit
        </button>
        <button
          disabled={move.effect.locked || !previous}
          onClick={() => previous && setChoice(previous.id)}
        >
          Previous beat
        </button>
        <button
          disabled={move.effect.locked || !next}
          onClick={() => next && setChoice(next.id)}
        >
          Next beat
        </button>
      </div>
      {beat && duration !== null && (
        <>
          <p role="status">
            Proposed landing {(beat.time + offset).toFixed(3)} s · later moves
            shift {shift >= 0 ? "+" : ""}
            {shift.toFixed(3)} s.
          </p>
          <button
            disabled={move.effect.locked}
            onClick={() => {
              edit("Align active move landing", (draft) => {
                const e = draft.moves[index].effect;
                e.duration = duration;
                e.landingBeat = offset === 0 ? beat.id : null;
              });
              setChoice(null);
            }}
          >
            Apply landing alignment
          </button>
        </>
      )}
      {move.effect.locked && <p>Unlock timing to align this move.</p>}
    </details>
  );
}
