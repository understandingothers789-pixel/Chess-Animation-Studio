import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import type { Edit } from "../state";
import {
  storyTemplates,
  createStoryTemplate,
  countdownLengths,
  type CountdownLength,
  type StoryTemplate,
} from "../../core/storyTemplates";
import { ShotThumbnail } from "./ShotThumbnail";
import type { StoryThumbnails } from "./thumbnails";
export function TemplatePanel({
  p,
  sourceIds,
  edit,
  select,
  close,
  report,
  thumbnails,
  graphicsRevision,
  playing,
}: {
  p: Project;
  sourceIds: string[];
  edit: Edit;
  select: (id: string) => void;
  close: () => void;
  report: (s: string) => void;
  thumbnails?: StoryThumbnails;
  graphicsRevision: number;
  playing: boolean;
}) {
  const [kind, setKind] = useState<StoryTemplate>("Puzzle Challenge"),
    [countdown, setCountdown] = useState<CountdownLength>(3),
    [draft, setDraft] = useState<{
      project: Project;
      sourceKey: string;
      shots: StoryboardShot[];
    }>(),
    [replace, setReplace] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);
  const firstMoveOnly =
    kind === "Puzzle Challenge" || kind === "Tactical Breakdown";
  const sourceKey = JSON.stringify(sourceIds);
  const candidate =
    draft?.project === p && draft.sourceKey === sourceKey
      ? draft.shots
      : undefined;
  const preview = useMemo(
    () => candidate && { ...p, storyboard: { shots: candidate, beats: [] } },
    [p, candidate],
  );
  return (
    <dialog
      ref={dialog}
      className="template-panel"
      aria-labelledby="story-template-heading"
      onClose={close}
    >
      <h2 id="story-template-heading">Story templates</h2>
      <div className="button-row">
        <label>
          Story structure
          <select
            aria-label="Story template"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as StoryTemplate);
              setDraft(undefined);
              setError("");
            }}
          >
            {storyTemplates.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {kind === "Puzzle Challenge" && (
          <label>
            Countdown length
            <select
              value={countdown}
              onChange={(e) => {
                setCountdown(Number(e.target.value) as CountdownLength);
                setDraft(undefined);
                setError("");
              }}
            >
              {countdownLengths.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds} seconds
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          onClick={() => {
            try {
              setDraft({
                project: p,
                sourceKey,
                shots: createStoryTemplate(p, kind, sourceIds, countdown),
              });
              setError("");
            } catch (e) {
              setDraft(undefined);
              setError((e as Error).message);
            }
          }}
        >
          Preview template
        </button>
        <button onClick={() => dialog.current?.close()}>Close templates</button>
      </div>
      <p className="hint">
        {firstMoveOnly
          ? "Uses the first selected source move."
          : `Uses ${sourceIds.length} selected source moves.`}{" "}
        You can edit the generated shots and annotations after applying.
      </p>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      {candidate && preview && (
        <>
          <ol className="template-shots">
            {candidate.map((s, i) => (
              <li key={s.id}>
                <ShotThumbnail
                  p={preview}
                  shot={s}
                  service={thumbnails}
                  graphicsRevision={graphicsRevision}
                  playing={playing}
                />
                <strong>
                  {i + 1}. {s.name}
                </strong>
                <span>
                  {s.kind} · {s.duration.toFixed(2)}s
                </span>
              </li>
            ))}
          </ol>
          <p>
            {candidate.length} editable shots ·{" "}
            {candidate.reduce((a, s) => a + s.duration, 0).toFixed(2)}s ·
            preview only
          </p>
          <label>
            <input
              type="checkbox"
              aria-label="Replace existing storyboard"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />{" "}
            Replace existing storyboard
          </label>
          <button
            className="primary"
            disabled={
              candidate.length + (replace ? 0 : p.storyboard.shots.length) > 200
            }
            title={
              candidate.length + (replace ? 0 : p.storyboard.shots.length) > 200
                ? "A storyboard supports up to 200 shots"
                : undefined
            }
            onClick={() => {
              edit.begin();
              try {
                edit("Apply story template", (d) => {
                  if (replace) d.storyboard.shots = structuredClone(candidate);
                  else d.storyboard.shots.push(...structuredClone(candidate));
                });
              } finally {
                edit.end();
              }
              select(candidate[0].id);
              report(
                `${kind}: ${candidate.length} editable shots added. Undo is available.`,
              );
              dialog.current?.close();
            }}
          >
            Apply template
          </button>
        </>
      )}
    </dialog>
  );
}
