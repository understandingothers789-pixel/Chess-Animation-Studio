import { useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import type { Edit } from "../state";
import {
  storyTemplates,
  createStoryTemplate,
  type StoryTemplate,
} from "../../core/storyTemplates";
export function TemplatePanel({
  p,
  sourceIds,
  edit,
  select,
  close,
  report,
}: {
  p: Project;
  sourceIds: string[];
  edit: Edit;
  select: (id: string) => void;
  close: () => void;
  report: (s: string) => void;
}) {
  const [kind, setKind] = useState<StoryTemplate>("Puzzle Challenge"),
    [candidate, setCandidate] = useState<StoryboardShot[]>([]),
    [replace, setReplace] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="template-panel" aria-label="Story template preview">
      <div className="button-row">
        <label>
          Story structure
          <select
            aria-label="Story template"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as StoryTemplate);
              setCandidate([]);
              setError("");
            }}
          >
            {storyTemplates.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            try {
              setCandidate(createStoryTemplate(p, kind, sourceIds));
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Preview template
        </button>
        <button onClick={close}>Close templates</button>
      </div>
      <p className="hint">
        Uses {sourceIds.length} selected source moves. Captions are editable
        prompts, not engine assessments.
      </p>
      {error && (
        <p role="alert" className="danger">
          {error}
        </p>
      )}
      {candidate.length > 0 && (
        <>
          <ol className="template-shots">
            {candidate.map((s, i) => (
              <li key={s.id}>
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
              close();
            }}
          >
            Apply template
          </button>
        </>
      )}
    </div>
  );
}
