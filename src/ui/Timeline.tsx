import { useRef } from "react";
import { segments, duration } from "../core/timeline";
import type { Project } from "../core/model";
import { timeLabel } from "./controls";
export function Timeline({
  project,
  time,
  selected,
  onSelect,
  onSeek,
  onAddBeat,
  onMoveBeat,
}: {
  project: Project;
  time: number;
  selected: number;
  onSelect: (i: number) => void;
  onSeek: (t: number) => void;
  onAddBeat: (t: number) => void;
  onMoveBeat: (id: string, t: number) => void;
}) {
  const durationValue = duration(project),
    segs = segments(project),
    body = useRef<HTMLDivElement>(null),
    drag = useRef<string | null>(null),
    width = Math.max(760, durationValue * 30);
  const position = (event: React.PointerEvent) => {
    const rect = body.current!.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(
        durationValue,
        ((event.clientX - rect.left) / width) * durationValue,
      ),
    );
  };
  return (
    <section className="timeline">
      <div className="timeline-heading">
        <strong>SEQUENCE</strong>
        <span>
          {project.moves.length} moves · {timeLabel(durationValue)}
        </span>
        <small>
          Click to seek · double-click audio track to add a beat · drag a beat
          to correct it
        </small>
      </div>
      <div className="timeline-scroll">
        <div className="track-names">
          <span>TIME</span>
          <span>MOVES</span>
          <span>CAMERA</span>
          <span>EFFECTS</span>
          <span>MUSIC / BEATS</span>
        </div>
        <div
          className="track-body"
          ref={body}
          style={{ width, minWidth: width }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            onSeek(position(e));
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) {
              const t = position(e);
              if (drag.current) onMoveBeat(drag.current, t);
              else onSeek(t);
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <div className="ruler">
            {Array.from(
              { length: Math.ceil(durationValue / 2) + 1 },
              (_, i) => (
                <span
                  key={i}
                  style={{ left: ((i * 2) / durationValue) * 100 + "%" }}
                >
                  {timeLabel(i * 2)}
                </span>
              ),
            )}
          </div>
          <div className="track moves-track">
            {segs.map((s) => (
              <button
                key={project.moves[s.index].id}
                className={`move-clip ${s.index === selected ? "selected" : ""}`}
                title={`${s.index + 1}. ${project.moves[s.index].san}`}
                style={{
                  left: (s.start / durationValue) * 100 + "%",
                  width: ((s.end - s.start) / durationValue) * 100 + "%",
                }}
                onClick={() => onSelect(s.index)}
              >
                <b>{project.moves[s.index].san}</b>
                <small>{project.moves[s.index].effect.preset}</small>
              </button>
            ))}
          </div>
          <div className="track camera-track">
            {segs.map((s) => (
              <button
                key={s.index}
                title="Select camera for this move"
                style={{
                  left: (s.start / durationValue) * 100 + "%",
                  width: ((s.end - s.start) / durationValue) * 100 + "%",
                }}
                onClick={() => onSelect(s.index)}
              >
                ↗
              </button>
            ))}
          </div>
          <div className="track effects-track">
            {segs.map((s) => (
              <button
                key={s.index}
                title="Select effects for this move"
                style={{
                  left: (s.departure / durationValue) * 100 + "%",
                  width: ((s.end - s.departure) / durationValue) * 100 + "%",
                }}
                onClick={() => onSelect(s.index)}
              >
                {project.moves[s.index].effect.badge.manual ?? "✧"}
              </button>
            ))}
          </div>
          <div
            className="track audio-track"
            onDoubleClick={(e) =>
              onAddBeat(position(e as unknown as React.PointerEvent))
            }
          >
            <svg preserveAspectRatio="none" viewBox="0 0 1000 44">
              {project.music?.waveform.map((v, i, a) => {
                const m = project.music!,
                  source = (i / a.length) * m.duration;
                if (source < m.trimStart || source > m.trimEnd) return null;
                const x =
                  ((m.offset + source - m.trimStart) / durationValue) * 1000;
                return (
                  <line
                    key={i}
                    x1={x}
                    x2={x}
                    y1={22 - v * 19}
                    y2={22 + v * 19}
                  />
                );
              })}
            </svg>
            {project.beats.map((b) => (
              <button
                key={b.id}
                className={`beat-marker ${b.strong ? "strong" : ""} ${b.selected ? "chosen" : ""}`}
                title={`${b.strong ? "Accent" : "Beat"} ${timeLabel(b.time)} · drag to move`}
                style={{ left: (b.time / durationValue) * 100 + "%" }}
                onPointerDown={(e) => {
                  drag.current = b.id;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  e.stopPropagation();
                }}
                onPointerMove={(e) => {
                  if (drag.current === b.id && e.buttons)
                    onMoveBeat(b.id, position(e));
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(b.time);
                }}
              />
            ))}
          </div>
          <div
            className="playhead"
            style={{ left: (time / durationValue) * 100 + "%" }}
          >
            <i />
          </div>
        </div>
      </div>
    </section>
  );
}
