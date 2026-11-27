import { requiredAssetIds } from "../../core/exportAssets";
import { ExportPreview } from "./ExportPreview";
import type { ThumbnailPort } from "../storyboard/thumbnails";
import { ProductionChecks } from "./ProductionChecks";
import { productionChecks } from "../../core/productionChecks";
import { compileStoryboard } from "../../core/storyboard";
import { MAX_EXPORT_DIMENSION } from "../../core/exportOptions";
import { clock } from "../controls";
import { useEffect, useRef, useState } from "react";
import {
  sizes,
  type Project,
  type Format,
  type PlaybackMode,
} from "../../core/project";
import { duration, segments } from "../../core/timeline";
import type { Settings, ExportProgress, ExportOptions } from "../../bridge";
export function ExportDialog({
  project: p,
  index,
  mode = "source",
  settings,
  missingIds,
  progress,
  fps,
  setFps,
  close,
  render,
  cancel,
  chooseFFmpeg,
  relinkAssets,
  previewPort,
  graphicsRevision,
}: {
  project: Project;
  index: number;
  mode?: PlaybackMode;
  settings: Settings;
  missingIds: Set<string>;
  progress: ExportProgress | null;
  fps: number;
  setFps: (fps: number) => void;
  close: () => void;
  render: (o: ExportOptions) => Promise<boolean>;
  chooseFFmpeg: () => Promise<void>;
  relinkAssets: () => void;
  previewPort: ThumbnailPort;
  graphicsRevision: number;
  cancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTime, setPreviewTime] = useState<number>();
  const inspect = (time: number) => {
    setPreviewTime(time);
    setPreviewOpen(true);
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector(".export-preview-section")
        ?.scrollIntoView({ block: "nearest" }),
    );
  };
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function choose(action: () => Promise<unknown>, cancelled = "") {
    setPicking(true);
    setStatus("");
    setFailed(false);
    try {
      if ((await action()) === false) setStatus(cancelled);
    } catch (error) {
      setFailed(true);
      setStatus(
        (error as Error).message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
    } finally {
      setPicking(false);
    }
  }
  const sourceEnd = duration(p),
    story = compileStoryboard(p),
    [format, setFormat] = useState<Format>(p.format),
    [range, setRange] = useState(mode === "storyboard" ? "storyboard" : "all"),
    [start, setStart] = useState(0),
    [finish, setFinish] = useState(sourceEnd),
    [resolution, setResolution] = useState(1);
  const end = range === "storyboard" ? story.duration : sourceEnd;
  const segment = segments(p)[index],
    from =
      range === "storyboard" || range === "all"
        ? 0
        : range === "move"
          ? (segment?.start ?? 0)
          : start,
    to =
      range === "storyboard" || range === "all"
        ? end
        : range === "move"
          ? (segment?.end ?? end)
          : finish;
  const [customWidth, setCustomWidth] = useState(1280);
  const maxWidth =
    Math.floor(
      Math.min(
        MAX_EXPORT_DIMENSION,
        (MAX_EXPORT_DIMENSION * sizes[format][0]) / sizes[format][1],
      ) / 2,
    ) * 2;
  const minWidth =
    Math.ceil(Math.max(64, (64 * sizes[format][0]) / sizes[format][1]) / 2) * 2;
  const [w, h] = sizes[format].map(
    (n) =>
      Math.round(
        (n * (resolution === 0 ? customWidth / sizes[format][0] : resolution)) /
          2,
      ) * 2,
  );
  const outputOptions = {
    mode:
      range === "storyboard" ? ("storyboard" as const) : ("source" as const),
    format,
    start: from,
    end: to,
    width: w,
    height: h,
    fps,
  };
  const needed = requiredAssetIds(p, outputOptions),
    missing = [...missingIds].filter((id) => needed.has(id)).length;
  const blocked = productionChecks(p, outputOptions).some(
    (i) => i.severity === "error",
  );
  const busy =
    !!progress && !["Complete", "Failed", "Cancelled"].includes(progress.phase);
  return (
    <dialog
      ref={dialog}
      className="export-dialog"
      aria-label="Export composition"
      onClose={close}
      onCancel={(e) => {
        if (busy || picking) e.preventDefault();
      }}
    >
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
            min={minWidth}
            max={maxWidth}
            step={2}
            value={customWidth}
            onChange={(e) =>
              setCustomWidth(
                Math.max(minWidth, Math.min(maxWidth, +e.target.value)),
              )
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
          <option value="all">Full Game</option>
          <option value="move" disabled={!segment}>
            Selected move{segment ? ` · ${p.moves[index].san}` : ""}
          </option>
          <option value="custom">Custom source range</option>
          <option value="storyboard" disabled={!story.shots.length}>
            Storyboard · {story.shots.length} shots
          </option>
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
      {range === "storyboard" && (
        <p className="story-export-summary">
          Storyboard · {story.shots.length} shots ·{" "}
          {Math.ceil(Math.max(0, to - from) * fps)} frames
        </p>
      )}
      {range === "storyboard" && story.issues.length > 0 && (
        <p className="danger">
          Repair {story.issues.length} storyboard shots before exporting:{" "}
          {story.issues[0].message}
        </p>
      )}
      <p>
        {w} × {h} · {fps} FPS · {Math.max(0, to - from).toFixed(2)}s · MP4 /
        H.264 + AAC
      </p>
      <p className="hint">
        For a thumbnail, use Save PNG above the preview. PNG capture uses the
        full composition resolution.
      </p>
      <button
        type="button"
        disabled={to <= from}
        aria-expanded={previewOpen}
        onClick={() => setPreviewOpen(!previewOpen)}
      >
        Preview selected export
      </button>
      {previewOpen && to > from && (
        <ExportPreview
          project={p}
          options={outputOptions}
          position={previewTime ?? from}
          seek={setPreviewTime}
          port={previewPort}
          revision={graphicsRevision}
        />
      )}
      <ProductionChecks
        p={p}
        options={outputOptions}
        close={close}
        inspect={inspect}
      />
      {progress && (
        <div className="export-progress">
          <progress max={Math.max(1, progress.total)} value={progress.done} />
          <p>
            {progress.phase} · {progress.done}/{progress.total}
            {progress.etaSeconds !== undefined &&
              progress.done < progress.total &&
              ` · About ${clock(Math.ceil(progress.etaSeconds))} left to render frames`}
          </p>
          {progress.error && <p className="danger">{progress.error}</p>}
          {progress.path && <p className="path">{progress.path}</p>}
          {progress.phase === "Complete" && progress.path && (
            <button
              type="button"
              disabled={picking}
              onClick={() => void choose(() => window.studio.showExport())}
            >
              Open output folder
            </button>
          )}
        </div>
      )}
      {missing > 0 && (
        <div className="button-row">
          <span className="danger">
            {missing} required {missing === 1 ? "file is" : "files are"}{" "}
            missing.
          </span>
          <button
            type="button"
            disabled={busy || picking}
            onClick={relinkAssets}
          >
            Relink in Files
          </button>
        </div>
      )}
      {!settings.ffmpeg && (
        <div className="button-row">
          <span>MP4 export requires FFmpeg.</span>
          <button
            type="button"
            disabled={busy || picking}
            onClick={() => void choose(chooseFFmpeg)}
          >
            Choose FFmpeg…
          </button>
        </div>
      )}
      {status && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "danger" : "hint"}
        >
          {status}
        </p>
      )}
      <div className="button-row">
        {busy ? (
          <button onClick={cancel}>Cancel export</button>
        ) : (
          <>
            <button disabled={picking} onClick={() => dialog.current?.close()}>
              Close
            </button>
            <button
              className="primary"
              disabled={
                blocked ||
                picking ||
                w > MAX_EXPORT_DIMENSION ||
                h > MAX_EXPORT_DIMENSION ||
                w < 64 ||
                h < 64 ||
                (range === "storyboard" && story.issues.length > 0) ||
                !settings.ffmpeg ||
                missing > 0 ||
                from < 0 ||
                to > end ||
                to <= from
              }
              onClick={() =>
                void choose(
                  () => render(outputOptions),
                  "Save dialog cancelled.",
                )
              }
            >
              Choose output & render
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
