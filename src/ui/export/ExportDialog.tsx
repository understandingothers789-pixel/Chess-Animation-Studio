import { useState } from "react";
import { sizes, type Project, type Format } from "../../core/project";
import { duration, segments } from "../../core/timeline";
import type { Settings, ExportProgress, ExportOptions } from "../../bridge";
export function ExportDialog({
  project: p,
  index,
  settings,
  missing,
  progress,
  close,
  render,
  cancel,
}: {
  project: Project;
  index: number;
  settings: Settings;
  missing: number;
  progress: ExportProgress | null;
  close: () => void;
  render: (o: ExportOptions) => void;
  cancel: () => void;
}) {
  const end = duration(p),
    [format, setFormat] = useState<Format>(p.format),
    [fps, setFps] = useState(60),
    [range, setRange] = useState("all"),
    [start, setStart] = useState(0),
    [finish, setFinish] = useState(end),
    [resolution, setResolution] = useState(1);
  const segment = segments(p)[index],
    from =
      range === "all" ? 0 : range === "move" ? (segment?.start ?? 0) : start,
    to =
      range === "all" ? end : range === "move" ? (segment?.end ?? end) : finish;
  const [customWidth, setCustomWidth] = useState(1280);
  const [w, h] = sizes[format].map(
    (n) =>
      Math.round(
        (n * (resolution === 0 ? customWidth / sizes[format][0] : resolution)) /
          2,
      ) * 2,
  );
  const busy =
    !!progress && !["Complete", "Failed", "Cancelled"].includes(progress.phase);
  return (
    <div className="modal-backdrop">
      <section
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Export composition"
      >
        <span className="eyebrow">RENDER YOUR COMPOSITION</span>
        <h2>Export video</h2>
        <label>
          Creator preset
          <select
            aria-label="Export preset"
            value={format}
            onChange={(e) => setFormat(e.target.value as Format)}
          >
            <option value="landscape">YouTube Landscape</option>
            <option value="vertical">YouTube Shorts</option>
            <option value="square">Square Social Video</option>
            <option value="square-in-vertical">Square in vertical</option>
          </select>
        </label>
        <label>
          Resolution
          <select
            aria-label="Export resolution"
            value={resolution}
            onChange={(e) => setResolution(+e.target.value)}
          >
            <option value={1}>Full · {sizes[format].join(" × ")}</option>
            <option value={0.5}>Half resolution</option>
            <option value={0}>Custom output width</option>
          </select>
        </label>
        {resolution === 0 && (
          <label>
            Width (px)
            <input
              aria-label="Custom export width"
              type="number"
              min={128}
              max={4096}
              step={2}
              value={customWidth}
              onChange={(e) =>
                setCustomWidth(Math.max(128, Math.min(4096, +e.target.value)))
              }
            />
          </label>
        )}
        <label>
          Frame rate
          <select
            aria-label="Export frame rate"
            value={fps}
            onChange={(e) => setFps(+e.target.value)}
          >
            {[24, 30, 60].map((v) => (
              <option key={v} value={v}>
                {v} FPS
              </option>
            ))}
          </select>
        </label>
        <label>
          Range
          <select
            aria-label="Export range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="all">Entire composition</option>
            <option value="move" disabled={!segment}>
              Selected move
            </option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {range === "custom" && (
          <div className="button-row">
            <label>
              Start (s)
              <input
                aria-label="Export start"
                type="number"
                min={0}
                max={end}
                step={1 / fps}
                value={start}
                onChange={(e) => setStart(+e.target.value)}
              />
            </label>
            <label>
              End (s)
              <input
                aria-label="Export end"
                type="number"
                min={0}
                max={end}
                step={1 / fps}
                value={finish}
                onChange={(e) => setFinish(+e.target.value)}
              />
            </label>
          </div>
        )}
        <p>
          {w} × {h} · {fps} FPS · {Math.max(0, to - from).toFixed(2)}s · MP4 /
          H.264 + AAC
        </p>
        <p className="hint">
          For a thumbnail, use Save PNG above the preview. PNG capture uses the
          full composition resolution.
        </p>
        {progress && (
          <div className="export-progress">
            <progress max={Math.max(1, progress.total)} value={progress.done} />
            <p>
              {progress.phase} · {progress.done}/{progress.total}
            </p>
            {progress.error && <p className="danger">{progress.error}</p>}
            {progress.path && <p className="path">{progress.path}</p>}
          </div>
        )}
        {missing > 0 && (
          <p className="danger">
            Relink {missing} missing assets in Files before exporting.
          </p>
        )}
        {!settings.ffmpeg && (
          <p className="danger">Choose FFmpeg in Files to enable MP4 export.</p>
        )}
        <div className="button-row">
          {busy ? (
            <button onClick={cancel}>Cancel export</button>
          ) : (
            <>
              <button onClick={close}>Close</button>
              <button
                className="primary"
                disabled={
                  w > 4096 ||
                  h > 4096 ||
                  !settings.ffmpeg ||
                  missing > 0 ||
                  from < 0 ||
                  to > end ||
                  to <= from
                }
                onClick={() =>
                  render({
                    format,
                    start: from,
                    end: to,
                    width: w,
                    height: h,
                    fps,
                  })
                }
              >
                Choose output & render
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
