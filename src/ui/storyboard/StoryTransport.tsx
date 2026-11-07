import type { Project } from "../../core/project";
import {
  compileStoryboard,
  resolveStoryboardFrame,
} from "../../core/storyboard";
import { clock } from "../controls";
export function StoryTransport({
  p,
  time,
  playing,
  toggle,
  seek,
  loading,
}: {
  p: Project;
  time: number;
  playing: boolean;
  toggle: () => void;
  seek: (t: number) => void;
  loading: number;
}) {
  const c = compileStoryboard(p),
    frame = resolveStoryboardFrame(p, time),
    i = frame?.index ?? 0;
  return (
    <div className="transport story-transport">
      <div className="transport-row">
        <small>
          <strong>STORYBOARD</strong> ·{" "}
          {c.shots.length ? `Shot ${i + 1} of ${c.shots.length}` : "No shots"}
        </small>
        <div className="transport-buttons">
          <button aria-label="Restart storyboard" onClick={() => seek(0)}>
            ↤
          </button>
          <button
            aria-label="Previous shot"
            disabled={!c.shots.length}
            onClick={() => seek(c.shots[Math.max(0, i - 1)].start)}
          >
            ‹
          </button>
          <button
            className="play-button"
            aria-label={playing ? "Pause storyboard" : "Play storyboard"}
            disabled={!c.shots.length || loading > 0}
            onClick={toggle}
          >
            {playing ? "Pause" : "Play storyboard"}
          </button>
          <button
            aria-label="Next shot"
            disabled={!c.shots.length}
            onClick={() =>
              seek(c.shots[Math.min(c.shots.length - 1, i + 1)].start)
            }
          >
            ›
          </button>
        </div>
        <small>
          <strong>{clock(time)}</strong> / {clock(c.duration)} · output time
        </small>
      </div>
      <input
        aria-label="Seek storyboard"
        title="Storyboard output time"
        type="range"
        min={0}
        max={Math.max(0.001, c.duration)}
        step={0.001}
        value={time}
        onChange={(e) => seek(+e.target.value)}
      />
    </div>
  );
}
