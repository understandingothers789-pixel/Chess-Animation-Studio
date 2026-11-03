import {
  SkipBack,
  ChevronLeft,
  Play,
  Pause,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import type { Project } from "../../core/project";
import { clock } from "../controls";
import { settingHelp } from "../help";
export function Transport({
  p,
  selected,
  time,
  end,
  playing,
  loadingAudio,
  select,
  seek,
  toggle,
}: {
  p: Project;
  selected: number;
  time: number;
  end: number;
  playing: boolean;
  loadingAudio: number;
  select: (index: number) => void;
  seek: (time: number) => void;
  toggle: () => void;
}) {
  return (
    <div className="transport">
      <div className="transport-row">
        <small>
          <kbd>SPACE</kbd>{" "}
          {p.moves[selected]
            ? `Move ${selected + 1} · ${p.moves[selected].san}`
            : "Starting position"}
        </small>
        <div className="transport-buttons">
          <button title="Restart" onClick={() => seek(0)}>
            <SkipBack size={17} />
          </button>
          <button
            title="Previous move"
            onClick={() => select(Math.max(0, selected - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
            className="play-button"
            disabled={loadingAudio > 0}
            onClick={toggle}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <button
            title="Next move"
            onClick={() => select(Math.min(p.moves.length - 1, selected + 1))}
          >
            <ChevronRight size={18} />
          </button>
          <button title="End" onClick={() => seek(end)}>
            <SkipForward size={17} />
          </button>
        </div>
        <small>
          <strong>{clock(time)}</strong> / {clock(end)}
        </small>
      </div>
      <input
        title={settingHelp("Seek composition")}
        aria-description={settingHelp("Seek composition")}
        aria-label="Seek composition"
        type="range"
        min={0}
        max={end}
        step={0.001}
        value={time}
        onChange={(e) => seek(+e.target.value)}
      />
    </div>
  );
}
