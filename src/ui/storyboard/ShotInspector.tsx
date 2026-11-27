import { viewLine } from "../../core/chess";
import { useEffect, useMemo, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import { camera, presets } from "../../core/project";
import {
  compileStoryboard,
  localizeInheritedText,
  replayShot,
  resizeShot,
  shotCaption,
} from "../../core/storyboard";
import type { Edit } from "../state";
import { Section, Range, Select, Toggle } from "../controls";
import { AnnotationEditor } from "../annotations/AnnotationEditor";
import { presetDescriptions, presetLabels } from "../presets/catalog";
export function ShotInspector({
  p,
  id,
  edit,
  sourceId,
  openSource,
  preview,
  selectReplay,
  annotationId,
  annotationIds,
  setAnnotationId,
  draw,
  previewTransition,
}: {
  p: Project;
  id: string | null;
  edit: Edit;
  sourceId: string | null;
  openSource: (i: number, play?: boolean, line?: number) => void;
  preview: (id: string) => void;
  selectReplay: (id: string, at: number) => void;
  annotationId: string | null;
  annotationIds?: string[];
  setAnnotationId: (id: string, additive?: boolean) => void;
  previewTransition: (id: string) => void;
  draw: (kind: "arrow" | "circle" | null) => void;
}) {
  const s = p.storyboard.shots.find((s) => s.id === id),
    entry = compileStoryboard(p).shots.find((e) => e.shot.id === id);
  const [name, setName] = useState(s?.name ?? "");
  const [replayRate, setReplayRate] = useState("0.5");
  const [replayError, setReplayError] = useState("");
  useEffect(() => setReplayError(""), [s?.id, replayRate]);
  useEffect(() => setName(s?.name ?? ""), [s?.id, s?.name]);
  const change = (label: string, fn: (s: StoryboardShot) => void) => {
    if (!id) return;
    if (edit.shot) edit.shot(label, id, fn);
    else
      edit(label, (d) => {
        const shot = d.storyboard.shots.find((s) => s.id === id);
        if (shot) fn(shot);
      });
  };
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
  const sourceMoves = viewLine(p, entry.sourceLine).moves;
  const sourceOptions = sourceMoves.map(
    (m, i) => [m.id, `${i + 1}. ${m.san}`] as const,
  );
  return (
    <aside className="shot-inspector" aria-label="Shot settings">
      <span className="eyebrow">
        SHOT {entry.index + 1} · {s.kind}
      </span>
      <h2>{s.name}</h2>
      {entry.pinIssue && (
        <p role="alert" className="danger">
          {entry.pinIssue}
        </p>
      )}
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
      {s.kind === "move-range" && !entry.issue && (
        <>
          <div className="shot-replay-tools">
            <Select
              label="Replay speed"
              value={replayRate}
              options={[
                ["0.35", "0.35×"],
                ["0.5", "0.5×"],
                ["0.75", "0.75×"],
              ]}
              onChange={setReplayRate}
            />
            <button
              disabled={p.storyboard.shots.length >= 200}
              title={
                p.storyboard.shots.length >= 200
                  ? "A storyboard supports up to 200 shots"
                  : "Insert a replay after this shot at the chosen fraction of its current speed"
              }
              onClick={() => {
                const replay = replayShot(p, entry, Number(replayRate));
                if (!replay) {
                  setReplayError(
                    "This replay is too long. Trim the source or choose a faster speed.",
                  );
                  return;
                }
                edit.begin();
                try {
                  edit("Add slow-motion replay", (d) => {
                    const index = d.storyboard.shots.findIndex(
                      ({ id }) => id === s.id,
                    );
                    if (index >= 0 && d.storyboard.shots.length < 200)
                      d.storyboard.shots.splice(index + 1, 0, replay);
                  });
                } finally {
                  edit.end();
                }
                selectReplay(replay.id, entry.end);
              }}
            >
              Add slow-motion replay
            </button>
          </div>
          {replayError && (
            <p role="alert" className="danger">
              {replayError}
            </p>
          )}
        </>
      )}
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
        {entry.project.annotations.filter(
          (a) =>
            a.id.startsWith("source-") &&
            (a.kind === "text" || a.kind === "caption"),
        ).length > 0 && (
          <details>
            <summary>Inherited source text</summary>
            <p className="hint">
              Make a local copy to edit this shot. The source game stays intact.
              Deleting the copy restores the inherited text.
            </p>
            {entry.project.annotations
              .filter(
                (a) =>
                  a.id.startsWith("source-") &&
                  (a.kind === "text" || a.kind === "caption"),
              )
              .map((a) => (
                <button
                  key={a.id}
                  className="wide"
                  disabled={s.annotations.length >= 50}
                  aria-label={`Make local copy: ${a.text}`}
                  onClick={() => {
                    let localId: string | null = null;
                    edit("Make inherited text local", (draft) => {
                      localId = localizeInheritedText(draft, s.id, a.id);
                    });
                    if (localId) setAnnotationId(localId);
                  }}
                >
                  Make local copy · {a.text}
                </button>
              ))}
          </details>
        )}
        <AnnotationEditor
          allowBoard={s.kind !== "title-card"}
          project={annotationProject}
          edit={annotationEdit}
          time={0}
          selected={
            annotationId === ""
              ? null
              : ((s.annotations.some((a) => a.id === annotationId)
                  ? annotationId
                  : null) ??
                s.annotations.find(
                  (a) => a.kind === "caption" || a.kind === "text",
                )?.id ??
                null)
          }
          selectedIds={annotationIds}
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
            label="Shot source variation"
            value={String(entry.sourceLine)}
            options={p.lines.map((line, i) => [String(i), line.name] as const)}
            onChange={(value) =>
              change("Change shot variation", (shot) => {
                const line = Number(value);
                const moves = viewLine(p, line).moves;
                if (!moves.length || !shot.source) return;
                const rebind = (id: string, at: number) =>
                  id === "@start" || moves.some((m) => m.id === id)
                    ? id
                    : moves[Math.max(0, Math.min(at, moves.length - 1))].id;
                shot.source.startMoveId = rebind(
                  shot.source.startMoveId,
                  entry.startIndex,
                );
                shot.source.endMoveId = rebind(
                  shot.source.endMoveId,
                  entry.endIndex,
                );
                shot.source.line = line;
                shot.trimStart = shot.trimEnd = 0;
              })
            }
          />
          <Select
            label="Shot source start"
            value={s.source.startMoveId}
            options={[
              ...(s.kind === "position-hold"
                ? [["@start", "Starting position"] as const]
                : []),
              ...sourceOptions,
              ...(s.source.startMoveId !== "@start" &&
              !sourceMoves.some((m) => m.id === s.source!.startMoveId)
                ? [[s.source.startMoveId, "Missing source"] as const]
                : []),
            ]}
            onChange={(v) =>
              change("Relink shot", (s) => {
                s.source!.startMoveId = v;
                s.source!.line = entry.sourceLine;
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
                  line: p.line,
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
            onClick={() =>
              openSource(entry.startIndex, false, entry.sourceLine)
            }
          >
            Open source move
          </button>
        </Section>
      )}
      {s.kind === "opening" && (
        <Section title="Opening content">
          <p>
            This shot uses the shared opening from Full Game → Intro clip.
            Change its duration above, or edit the video and player reveal in
            the Intro inspector.
          </p>
          {p.squareIntro.asset &&
            s.duration <
              p.squareIntro.hold +
                p.squareIntro.pullback +
                (p.playerIntro.enabled ? 0.5 : 0) && (
              <p className="hint">
                Lengthen this shot to give the pullback and player reveal room
                to finish.
              </p>
            )}
          <button type="button" onClick={() => openSource(-1)}>
            Edit shared intro
          </button>
        </Section>
      )}
      {s.kind !== "title-card" && s.kind !== "opening" && (
        <Section title="Shot presentation">
          <p>
            Animation ·{" "}
            {s.preset === "inherit"
              ? "Inherited from source moves"
              : "Local to this shot"}
            . Camera ·{" "}
            {s.camera ? "Local to this shot" : "Inherited from source moves"}.
          </p>
          <p>
            Use Open source move for detailed effects. Source edits affect every
            shot that inherits those settings.
          </p>
          {s.kind === "position-hold" && (
            <>
              <Toggle
                label="Show player intro"
                checked={s.showPlayerIntro ?? false}
                onChange={(v) =>
                  change("Shot player intro", (shot) => {
                    shot.showPlayerIntro = v;
                  })
                }
              />
              {s.showPlayerIntro && !p.playerIntro.asset && (
                <p className="hint">
                  Choose a player photo in Full Game → Intro.
                </p>
              )}
            </>
          )}
          {s.kind === "move-range" && (
            <Select
              label="Shot animation"
              optionDescriptions={presetDescriptions}
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
