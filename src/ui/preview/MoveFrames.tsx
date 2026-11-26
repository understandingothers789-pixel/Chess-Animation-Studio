import { EffectTiming } from "./EffectTiming";
import type { Edit } from "../state";
import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import type { Project } from "../../core/project";
import { stepFrame } from "../../core/timeline";
import { moveEffectTiming, moveFrameStops } from "../movePreview";
import type { ThumbnailPort } from "../storyboard/thumbnails";

export function MoveFrames({
  project,
  panel,
  index,
  time,
  playing,
  fps,
  port,
  seek,
  revision,
  onTune,
  edit,
}: {
  project: Project;
  panel?: Ref<HTMLDetailsElement>;
  index: number;
  time: number;
  playing: boolean;
  fps: number;
  port: ThumbnailPort;
  seek: (time: number) => void;
  revision: number;
  edit?: Edit;
  onTune?: (section: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const timing = useMemo(
    () => moveEffectTiming(project, index),
    [project, index],
  );
  const stops = useMemo(() => moveFrameStops(project, index), [project, index]);
  const [preview, setPreview] = useState<{
    stops: typeof stops;
    revision: number;
    frames: (string | null)[];
  }>();
  const completed = useRef<{ stops: typeof stops; revision: number } | null>(
    null,
  );
  useEffect(() => {
    if (
      completed.current?.stops === stops &&
      completed.current.revision === revision
    )
      return;
    if (!expanded || playing || !stops.length) return;
    const portrait =
      project.format === "vertical" || project.format === "square-in-vertical";
    const width = portrait || project.format === "square" ? 90 : 160;
    const height = portrait ? 160 : 90;
    let cancelled = false,
      attempts = 0,
      timer: ReturnType<typeof setTimeout>;
    const frames: (string | null)[] = [];
    const render = () => {
      if (cancelled) return;
      let frame: string | null = null;
      try {
        frame =
          port.current?.(
            project,
            stops[frames.length].time,
            width,
            height,
            "source",
          ) ?? null;
      } catch {
        // The main preview reports graphics errors and owns recovery.
      }
      if (!frame && ++attempts < 20) {
        timer = setTimeout(render, 100);
        return;
      }
      frames.push(frame);
      attempts = 0;
      setPreview({ stops, revision, frames: [...frames] });
      if (frames.length < stops.length) timer = setTimeout(render, 24);
      else if (frames.every(Boolean)) completed.current = { stops, revision };
    };
    // Wait briefly for slider and key edits to settle before borrowing the renderer.
    timer = setTimeout(render, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [expanded, playing, stops, port, project, revision]);
  if (!stops.length) return null;
  const currentFrames =
    preview?.stops === stops && preview.revision === revision
      ? preview.frames
      : [];
  const start = timing?.segment.start ?? stops[0].time,
    end = stops[stops.length - 1].time;
  const at = Math.max(start, Math.min(end, time));
  const endTime = Math.ceil((end - start) * 1000);
  return (
    <details
      className="move-frames"
      ref={panel}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>Move frames · {project.moves[index].san}</summary>
      {expanded && (
        <div className="move-frames-content">
          <div
            className="move-frame-stops"
            data-extra-frames={stops.length > 4}
          >
            {stops.map(({ label, time: checkpoint }, i) => (
              <button
                key={label}
                type="button"
                onClick={() => seek(checkpoint)}
                className="move-frame-stop"
                aria-label={`View ${label.toLowerCase()} frame`}
                aria-pressed={Math.abs(time - checkpoint) < 0.001}
              >
                {currentFrames[i] ? (
                  <img src={currentFrames[i]!} alt="" />
                ) : (
                  <span className="move-frame-placeholder" aria-hidden="true" />
                )}
                <strong>{label}</strong>
                <span>{(checkpoint - start).toFixed(2)} s</span>
              </button>
            ))}
          </div>
          <div className="move-frame-scrub">
            <button
              type="button"
              disabled={at <= start}
              onClick={() =>
                seek(time > end ? end : Math.max(start, stepFrame(at, fps, -1)))
              }
              aria-label="Previous frame of move"
            >
              − Frame
            </button>
            <input
              type="range"
              aria-label="Scrub selected move"
              aria-description="Seek within this move without changing its duration."
              aria-valuetext={`${(at - start).toFixed(3)} seconds into the move`}
              title="Seek within the selected move"
              min={0}
              max={endTime}
              step={1}
              value={Math.round((at - start) * 1000)}
              onChange={(event) =>
                seek(Math.min(end, start + Number(event.target.value) / 1000))
              }
            />
            <button
              type="button"
              disabled={at >= end}
              onClick={() =>
                seek(
                  time < start ? start : Math.min(end, stepFrame(at, fps, 1)),
                )
              }
              aria-label="Next frame of move"
            >
              + Frame
            </button>
            <output>{(at - start).toFixed(3)} s</output>
          </div>
          {timing && (
            <EffectTiming
              key={project.moves[index].id}
              project={project}
              index={index}
              time={time}
              seek={seek}
              onTune={onTune}
              edit={onTune ? edit : undefined}
            />
          )}
          {playing && !currentFrames.length && (
            <p>Pause playback to refresh the frame previews.</p>
          )}
        </div>
      )}
    </details>
  );
}
