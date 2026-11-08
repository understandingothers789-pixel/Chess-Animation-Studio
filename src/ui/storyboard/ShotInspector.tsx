import { useEffect, useMemo, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import { camera, presets } from "../../core/project";
import {
  compileStoryboard,
  resizeShot,
  shotCaption,
} from "../../core/storyboard";
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
  previewTransition,
}: {
  p: Project;
  id: string | null;
  edit: Edit;
  sourceId: string | null;
  openSource: (i: number) => void;
  preview: (id: string) => void;
  annotationId: string | null;
  setAnnotationId: (id: string) => void;
  previewTransition: (id: string) => void;
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
  const cam = s.camera;
  const sourceOptions = p.moves.map(
    (m, i) => [m.id, `${i + 1}. ${m.san}`] as const,
  );
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
      <details className="story-annotation-editor" open>
        <summary>Text layers and annotations · selected shot</summary>
        {!s.annotations.some(
          (a) => a.kind === "text" || a.kind === "caption",
        ) && (
          <label>
            On-screen caption
            <textarea
              aria-label="Shot caption"
              placeholder="Add an explanation…"
              value=""
              onChange={(e) => {
                const a = shotCaption(p, e.target.value, s.duration);
                change("Add shot caption", (s) => {
                  s.annotations.push(a);
                });
                setAnnotationId(a.id);
              }}
            />
          </label>
        )}
        <AnnotationEditor
          allowBoard={s.kind !== "title-card"}
          project={annotationProject}
          edit={annotationEdit}
          time={0}
          selected={
            (s.annotations.some((a) => a.id === annotationId)
              ? annotationId
              : null) ??
            s.annotations.find((a) => a.kind === "caption" || a.kind === "text")
              ?.id ??
            null
          }
          onSelect={setAnnotationId}
          onDraw={draw}
          textLabel="Shot caption"
        />
      </details>
      {entry.index > 0 && (
        <Section title="Transition into this shot">
          <Select
            label="Transition type"
            value={s.transition.type}
            options={[
              ["cut", "Cut"],
              ["fade-through-black", "Fade through black"],
              ["cross-dissolve", "Cross-dissolve"],
            ]}
            onChange={(type) =>
              change("Shot transition", (s) => {
                s.transition.type = type;
                s.transition.duration =
                  type === "cut"
                    ? 0
                    : Math.min(s.duration, s.transition.duration || 0.5);
              })
            }
          />
          {s.transition.type !== "cut" && (
            <>
              <Range
                label="Transition duration"
                value={s.transition.duration}
                min={0}
                max={Math.min(5, s.duration)}
                step={0.01}
                unit="s"
                onChange={(v) =>
                  change("Transition duration", (s) => {
                    s.transition.duration = v;
                  })
                }
              />
              <Select
                label="Transition easing"
                value={s.transition.easing}
                options={[
                  ["linear", "Linear"],
                  ["smooth", "Smooth"],
                ]}
                onChange={(v) =>
                  change("Transition easing", (s) => {
                    s.transition.easing = v;
                  })
                }
              />
              <button onClick={() => previewTransition(s.id)}>
                Preview transition
              </button>
              <p className="hint">
                Uses the beginning of this shot. Music and shot durations stay
                continuous.
              </p>
            </>
          )}
        </Section>
      )}
      <Section title="Music ducking">
        <Toggle
          label="Lower music during this shot"
          checked={s.musicDucking.enabled}
          onChange={(enabled) =>
            change("Shot music ducking", (s) => {
              s.musicDucking.enabled = enabled;
            })
          }
        />
        {s.musicDucking.enabled && (
          <>
            <Range
              label="Ducked music level"
              value={s.musicDucking.volume * 100}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(v) =>
                change("Shot duck level", (s) => {
                  s.musicDucking.volume = v / 100;
                })
              }
            />
            <Range
              label="Music fade down"
              value={s.musicDucking.fadeDown}
              min={0.01}
              max={5}
              step={0.01}
              unit="s"
              onChange={(fadeDown) =>
                change("Shot duck fade down", (s) => {
                  s.musicDucking.fadeDown = fadeDown;
                })
              }
            />
            <Range
              label="Music fade up"
              value={s.musicDucking.fadeUp}
              min={0.01}
              max={5}
              step={0.01}
              unit="s"
              onChange={(fadeUp) =>
                change("Shot duck fade up", (s) => {
                  s.musicDucking.fadeUp = fadeUp;
                })
              }
            />
            <p className="hint">
              Music only. Adjacent shots transition directly between levels;
              release continues into the following shot.
            </p>
          </>
        )}
      </Section>
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
    </aside>
  );
}
