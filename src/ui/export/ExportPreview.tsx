import { useEffect, useMemo, useState } from "react";
import type { Project } from "../../core/project";
import type { ExportOptions } from "../../bridge";
import type { ThumbnailPort } from "../storyboard/thumbnails";
import { buildGame } from "../../core/chess";
import { compileStoryboard } from "../../core/storyboard";
import { compileTimeline } from "../../core/timeline";
import { squareVideoEnd } from "../../core/introVideo";
import { safeDefaults, safeRect } from "../../core/captions/safeAreas";
import { clock } from "../controls";

export function ExportPreview({
  project,
  options,
  position,
  seek,
  port,
  revision,
}: {
  project: Project;
  options: ExportOptions & { width: number; height: number };
  position: number;
  seek: (time: number) => void;
  port: ThumbnailPort;
  revision: number;
}) {
  const { start, end, width, height, format, fps = 60, mode } = options;
  const prepared = useMemo(() => ({ ...project, format }), [project, format]);
  const count = Math.max(1, Math.ceil((end - start) * fps));
  const frame = Math.max(
    0,
    Math.min(count - 1, Math.round((position - start) * fps)),
  );
  const at = start + frame / fps;
  const [guides, setGuides] = useState(false);
  const [image, setImage] = useState<{
    project: Project;
    at: number;
    w: number;
    h: number;
    mode: ExportOptions["mode"];
    value: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    setFailed(false);
    function draw() {
      try {
        const value = port.current?.(prepared, at, width, height, mode);
        if (value) {
          setImage({ project: prepared, at, w: width, h: height, mode, value });
          return;
        }
        if (++attempt < 12) {
          timer = setTimeout(draw, 120);
          return;
        }
      } catch {
        // The app reports graphics recovery separately.
      }
      setFailed(true);
    }
    timer = setTimeout(draw, 90);
    return () => clearTimeout(timer);
  }, [prepared, at, width, height, mode, port, revision, retry]);
  const moments = useMemo(() => {
    const source = compileTimeline(project);
    const captures =
      mode === "storyboard"
        ? compileStoryboard(project).shots.flatMap((shot) => {
            const length = shot.sourceEnd - shot.sourceStart;
            if (shot.issue || shot.shot.kind !== "move-range" || length <= 0)
              return [];
            const active =
              shot.shot.duration - shot.shot.preHold - shot.shot.postHold;
            return shot.game.steps.flatMap((step, index) => {
              if (!step.capturedId) return [];
              const seg = shot.sourceTimeline.segments[shot.startIndex + index];
              const t =
                seg.depart +
                step.move.effect.duration * step.move.effect.capture.impact;
              return t >= shot.sourceStart && t < shot.sourceEnd
                ? [
                    shot.start +
                      shot.shot.preHold +
                      ((t - shot.sourceStart) * active) / length,
                  ]
                : [];
            });
          })
        : buildGame(project).steps.flatMap((step, i) => {
            if (!step.capturedId) return [];
            return [
              source.segments[i].depart +
                step.move.effect.duration * step.move.effect.capture.impact,
            ];
          });
    const capture = captures
      .filter((t) => t >= start && t < end)
      .sort((a, b) => a - b)[0];
    const opening =
      mode === "storyboard"
        ? compileStoryboard(project).shots.find(
            (s) => s.shot.kind === "opening" && s.start < end && s.end > start,
          )
        : undefined;
    const introProject =
      opening?.project ?? (mode === "storyboard" ? null : project);
    const introStart = opening?.start ?? 0;
    const intro =
      introProject &&
      introProject.lead > 0 &&
      introStart + introProject.lead > start
        ? introStart +
          (introProject.playerIntro.enabled && introProject.playerIntro.asset
            ? (squareVideoEnd(introProject) + introProject.lead) / 2
            : Math.min(0.7, introProject.lead / 2))
        : undefined;
    return { capture, intro };
  }, [project, mode, start, end]);
  const safe = safeRect(
    100,
    100,
    safeDefaults(
      format,
      format === "vertical" || format === "square-in-vertical"
        ? "social-safe"
        : "standard",
    ),
  );
  const ready =
    image?.project === prepared &&
    image?.w === width &&
    image?.h === height &&
    image?.mode === mode &&
    image?.at === at;
  return (
    <section
      className="export-preview-section"
      aria-label="Selected export preview"
    >
      <div
        className="export-preview-frame"
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(100%, ${Math.round((320 * width) / height)}px)`,
        }}
      >
        {ready && <img src={image.value} alt="Selected export frame" />}
        {!ready && (
          <small>
            {failed ? "Preview frame unavailable" : "Preparing frame…"}
          </small>
        )}
        {guides && (
          <div
            className="caption-guides"
            aria-label="Export caption safe area"
            style={{
              left: `${safe.x}%`,
              top: `${safe.y}%`,
              width: `${safe.width}%`,
              height: `${safe.height}%`,
            }}
          />
        )}
      </div>
      {failed && (
        <button type="button" onClick={() => setRetry((n) => n + 1)}>
          Retry preview
        </button>
      )}
      <label className="export-preview-scrub">
        Frame · {clock(at)}
        <input
          type="range"
          aria-label="Scrub selected export"
          min={0}
          max={count - 1}
          step={1}
          value={frame}
          onChange={(event) => seek(start + Number(event.target.value) / fps)}
        />
      </label>
      <div className="button-row">
        <button type="button" onClick={() => seek(start)}>
          Start
        </button>
        {moments.intro !== undefined && (
          <button
            type="button"
            onClick={() => seek(Math.max(start, moments.intro!))}
          >
            Intro
          </button>
        )}
        {moments.capture !== undefined && (
          <button type="button" onClick={() => seek(moments.capture!)}>
            First capture
          </button>
        )}
        <button type="button" onClick={() => seek(start + (count - 1) / fps)}>
          Ending
        </button>
        <button
          type="button"
          aria-pressed={guides}
          onClick={() => setGuides(!guides)}
        >
          Caption safe area
        </button>
      </div>
    </section>
  );
}
