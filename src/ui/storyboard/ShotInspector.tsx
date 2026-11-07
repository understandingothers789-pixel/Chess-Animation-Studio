import { CaptionControls } from "../captions/CaptionControls";
import { useEffect, useMemo, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import { camera, presets } from "../../core/project";
import {
  compileStoryboard,
  resizeShot,
  shotCaption,
} from "../../core/storyboard";
import { annotation } from "../../core/annotations";
import type { Edit } from "../state";
import { Section, Range, Select, Toggle } from "../controls";
import { AnnotationEditor } from "../annotations/AnnotationEditor";
import { presetLabels } from "../presets/catalog";
export function ShotInspector({
  p,
  id,
  edit,
  sourceId,
  openSource,
  preview,
  annotationId,
  setAnnotationId,
  draw,
}: {
  p: Project;
  id: string | null;
  edit: Edit;
  sourceId: string | null;
  openSource: (i: number) => void;
  preview: (id: string) => void;
  annotationId: string | null;
  setAnnotationId: (id: string) => void;
  draw: (kind: "arrow" | "circle" | null) => void;
}) {
  const s = p.storyboard.shots.find((s) => s.id === id),
    entry = compileStoryboard(p).shots.find((e) => e.shot.id === id);
  const [name, setName] = useState(s?.name ?? "");
  useEffect(() => setName(s?.name ?? ""), [s?.id, s?.name]);
  const change = (label: string, fn: (s: StoryboardShot) => void) =>
    edit(label, (d) => {
      const shot = d.storyboard.shots.find((s) => s.id === id);
      if (shot) fn(shot);
    });
  const annotationProject = useMemo(
    () => ({
      ...p,
      annotations: s?.annotations ?? [],
      moves: [],
      lead: 0,
      tail: s?.duration ?? 1,
    }),
    [p, s],
  );
  const annotationEdit = Object.assign(
    (label: string, fn: (draft: Project) => void) =>
      change(label, (shot) => {
        const draft = {
          ...p,
          annotations: structuredClone(shot.annotations),
          moves: [],
          lead: 0,
          tail: shot.duration,
        };
        fn(draft);
        shot.annotations = draft.annotations;
      }),
    { begin: edit.begin, end: edit.end },
  );
  if (!s || !entry)
    return (
      <aside className="shot-inspector">
        <h2>Shot settings</h2>
        <p>Add or select a shot to edit its presentation.</p>
      </aside>
    );
  const caption = s.annotations.find(
      (a) =>
        a.kind === "caption" || (s.kind === "title-card" && a.kind === "text"),
    ),
    cam = s.camera;
  const sourceOptions = p.moves.map(
    (m, i) => [m.id, `${i + 1}. ${m.san}`] as const,
  );
  const captionChange = (field: string, value: any) =>
    change("Shot caption", (shot) => {
      let a = shot.annotations.find(
        (a) =>
          a.kind === "caption" ||
          (shot.kind === "title-card" && a.kind === "text"),
      );
      if (!a) {
        a = shotCaption(p, "", shot.duration);
        shot.annotations.push(a);
      }
      Object.assign(a, { [field]: value });
    });
  return (
    <aside className="shot-inspector" aria-label="Shot settings">
      <span className="eyebrow">
        SHOT {entry.index + 1} · {s.kind}
      </span>
      <h2>{s.name}</h2>
      <p className="hint">
        Output {entry.start.toFixed(2)}–{entry.end.toFixed(2)}s. Source game
        stays unchanged.
      </p>
      <label>
        Shot name
        <input
          aria-label="Shot name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== s.name)
              change("Rename storyboard shot", (s) => {
                s.name = name.trim() || "Untitled shot";
              });
          }}
        />
      </label>
      <button className="primary wide" onClick={() => preview(s.id)}>
        Preview selected shot
      </button>
      <Section title="Shot timing">
        <Range
          label="Shot duration"
          value={s.duration}
          min={0.1}
          max={600}
          step={0.05}
          unit="s"
          onChange={(v) => change("Shot duration", (s) => resizeShot(s, v))}
        />
        {s.kind === "move-range" && (
          <>
            <Range
              label="Pre-move hold"
              value={s.preHold}
              min={0}
              max={Math.min(120, Math.max(0, s.duration - s.postHold - 0.05))}
              step={0.05}
              unit="s"
              onChange={(v) =>
                change("Shot pre-hold", (s) => {
                  s.preHold = v;
                })
              }
            />
            <Range
              label="Post-move hold"
              value={s.postHold}
              min={0}
              max={Math.min(120, Math.max(0, s.duration - s.preHold - 0.05))}
              step={0.05}
              unit="s"
              onChange={(v) =>
                change("Shot post-hold", (s) => {
                  s.postHold = v;
                })
              }
            />
            <Range
              label="Shot trim start"
              value={s.trimStart}
              min={0}
              max={Math.max(
                0.1,
                entry.sourceEnd -
                  entry.sourceStart +
                  s.trimStart +
                  s.trimEnd -
                  0.01,
              )}
              step={0.05}
              unit="s"
              onChange={(v) =>
                change("Shot trim", (s) => {
                  s.trimStart = v;
                })
              }
            />
            <Range
              label="Shot trim end"
              value={s.trimEnd}
              min={0}
              max={Math.max(
                0.1,
                entry.sourceEnd -
                  entry.sourceStart +
                  s.trimStart +
                  s.trimEnd -
                  0.01,
              )}
              step={0.05}
              unit="s"
              onChange={(v) =>
                change("Shot trim", (s) => {
                  s.trimEnd = v;
                })
              }
            />
          </>
        )}
      </Section>
      {s.source && (
        <Section
          title="Source reference"
          status={entry.issue ? "Needs repair" : undefined}
        >
          {entry.issue && (
            <p role="alert" className="danger">
              {entry.issue}
            </p>
          )}
          <Select
            label="Shot source start"
            value={s.source.startMoveId}
            options={[
              ...(s.kind === "position-hold"
                ? [["@start", "Starting position"] as const]
                : []),
              ...sourceOptions,
              ...(s.source.startMoveId !== "@start" &&
              !p.moves.some((m) => m.id === s.source!.startMoveId)
                ? [[s.source.startMoveId, "Missing source"] as const]
                : []),
            ]}
            onChange={(v) =>
              change("Relink shot", (s) => {
                s.source!.startMoveId = v;
                if (s.kind === "position-hold") s.source!.endMoveId = v;
              })
            }
          />
          {s.kind === "move-range" ? (
            <Select
              label="Shot source end"
              value={s.source.endMoveId}
              options={sourceOptions}
              onChange={(v) =>
                change("Shot source range", (s) => {
                  s.source!.endMoveId = v;
                })
              }
            />
          ) : s.source.startMoveId !== "@start" ? (
            <Select
              label="Position to hold"
              value={s.source.position}
              options={[
                ["before", "Before source move"],
                ["after", "After source move"],
              ]}
              onChange={(v) =>
                change("Shot position", (s) => {
                  s.source!.position = v;
                })
              }
            />
          ) : null}
          <button
            disabled={!sourceId}
            onClick={() =>
              change("Repair source reference", (s) => {
                s.source = {
                  startMoveId: sourceId!,
                  endMoveId: sourceId!,
                  position: "after",
                };
                s.trimStart = 0;
                s.trimEnd = 0;
              })
            }
          >
            Relink to selected source move
          </button>
          <button
            disabled={entry.startIndex < 0 || !!entry.issue}
            onClick={() => openSource(entry.startIndex)}
          >
            Open source move
          </button>
        </Section>
      )}
      {s.kind !== "title-card" && (
        <Section title="Shot presentation">
          {s.kind === "move-range" && (
            <Select
              label="Shot animation"
              value={s.preset}
              options={[
                ["inherit", "Inherit source animation"],
                ...presets.map((v) => [v, presetLabels[v]] as const),
              ]}
              onChange={(v) =>
                change("Shot animation", (s) => {
                  s.preset = v;
                })
              }
            />
          )}
          <Select
            label="Shot camera"
            value={cam ? (cam.mode === "full" ? "full" : "manual") : "inherit"}
            options={[
              ["inherit", "Inherit source camera"],
              ["full", "Full board"],
              ["manual", "Manual framing"],
            ]}
            onChange={(v) =>
              change("Shot camera", (s) => {
                s.camera =
                  v === "inherit"
                    ? null
                    : { ...camera(), mode: v as "manual" | "full" };
              })
            }
          />
          {cam &&
            cam.mode !== "full" &&
            (
              [
                ["zoom", "Shot camera zoom", 0.6, 3, 0.05],
                ["x", "Shot camera X", -4, 4, 0.1],
                ["y", "Shot camera Y", -4, 4, 0.1],
                ["rotation", "Shot camera rotation", -35, 35, 1],
                ["tilt", "Shot camera tilt", -25, 25, 1],
              ] as const
            ).map(([k, label, min, max, step]) => (
              <Range
                key={k}
                label={label}
                value={cam[k]}
                min={min}
                max={max}
                step={step}
                onChange={(v) =>
                  change("Shot camera", (s) => {
                    s.camera![k] = v;
                  })
                }
              />
            ))}
          <p className="hint">
            Shot overrides apply to all formats. Inherited cameras retain the
            source's per-format settings.
          </p>
          <Toggle
            label="Include source annotations"
            checked={s.inheritAnnotations}
            onChange={(v) =>
              change("Shot annotation inheritance", (s) => {
                s.inheritAnnotations = v;
              })
            }
          />
        </Section>
      )}
      <Section title="Shot caption">
        <label>
          On-screen caption
          <textarea
            aria-label="Shot caption"
            rows={3}
            maxLength={500}
            value={caption?.text ?? ""}
            placeholder="Explain this moment…"
            onChange={(e) => captionChange("text", e.target.value)}
          />
        </label>
        {caption && (
          <CaptionControls
            a={caption}
            format={p.format}
            patch={(v) =>
              change("Caption layout", (s) => {
                Object.assign(
                  s.annotations.find((a) => a.id === caption.id)!,
                  v,
                );
              })
            }
          />
        )}
        <button disabled={!caption} onClick={() => preview(s.id)}>
          Preview caption
        </button>
        <Range
          label="Caption start"
          min={0}
          max={Math.max(0, (caption?.end ?? s.duration) - 0.05)}
          step={0.05}
          value={caption?.start ?? 0}
          unit="s"
          onChange={(v) => captionChange("start", v)}
        />
        <Range
          label="Caption end"
          min={(caption?.start ?? 0) + 0.05}
          max={s.duration}
          step={0.05}
          value={Math.min(s.duration, caption?.end ?? s.duration)}
          unit="s"
          onChange={(v) => captionChange("end", v)}
        />
        <Select
          label="Caption entrance"
          value={caption?.entrance ?? "fade"}
          options={["fade", "pop", "none"]}
          onChange={(v) => captionChange("entrance", v)}
        />
        <Select
          label="Caption exit"
          value={caption?.exit ?? "fade"}
          options={["fade", "none"]}
          onChange={(v) => captionChange("exit", v)}
        />
      </Section>
      <details className="story-annotation-editor">
        <summary>Arrows, circles and text</summary>
        <AnnotationEditor
          allowBoard={s.kind !== "title-card"}
          project={annotationProject}
          edit={annotationEdit}
          time={0}
          selected={annotationId}
          onSelect={setAnnotationId}
          onDraw={draw}
        />
      </details>
    </aside>
  );
}
