import { StoryboardWaveform } from "../audio/StoryboardWaveform";
import { ShotThumbnail } from "./ShotThumbnail";
import type { StoryThumbnails } from "./thumbnails";
import { useRef, useState } from "react";
import type { Project, StoryboardShot } from "../../core/project";
import type { Edit } from "../state";
import {
  compileStoryboard,
  duplicateShot,
  reorderShot,
  resizeShot,
  titleShot,
  shotFromMove,
} from "../../core/storyboard";
import { clock } from "../controls";
import { TemplatePanel } from "./TemplatePanel";
export function StoryTimeline({
  p,
  edit,
  selected,
  select,
  seek,
  openSource,
  exportStory,
  sourceIds,
  report,
  time,
  thumbnails,
  playing,
  playShot,
}: {
  playShot: (id: string) => void;
  p: Project;
  edit: Edit;
  selected: string | null;
  select: (id: string) => void;
  seek: (t: number) => void;
  openSource: (i: number) => void;
  exportStory: () => void;
  sourceIds: string[];
  report: (s: string) => void;
  time: number;
  thumbnails?: StoryThumbnails;
  playing: boolean;
}) {
  const c = compileStoryboard(p),
    [dragging, setDragging] = useState<string | null>(null),
    [over, setOver] = useState<string | null>(null),
    [templates, setTemplates] = useState(false),
    [overview, setOverview] = useState(false);
  const action = (name: string, fn: (p: Project) => void) => {
    edit.begin();
    try {
      edit(name, fn);
    } finally {
      edit.end();
    }
  };
  const add = (shot: StoryboardShot) => {
    if (p.storyboard.shots.length >= 200) {
      report("A storyboard supports up to 200 shots.");
      return;
    }
    action("Add storyboard shot", (d) => d.storyboard.shots.push(shot));
    select(shot.id);
  };
  const duplicate = (id: string) => {
    if (p.storyboard.shots.length >= 200) {
      report("A storyboard supports up to 200 shots.");
      return;
    }
    const i = p.storyboard.shots.findIndex((s) => s.id === id),
      copy = duplicateShot(p.storyboard.shots[i]);
    action("Duplicate storyboard shot", (d) =>
      d.storyboard.shots.splice(i + 1, 0, copy),
    );
    select(copy.id);
  };
  const remove = (id: string) => {
    action("Remove storyboard shot", (d) => {
      d.storyboard.shots = d.storyboard.shots.filter((s) => s.id !== id);
    });
    select(c.shots.find((s) => s.shot.id !== id)?.shot.id ?? "");
  };
  const move = (id: string, dir: number) => {
    const i = p.storyboard.shots.findIndex((s) => s.id === id),
      target = Math.max(0, Math.min(p.storyboard.shots.length - 1, i + dir));
    if (i === target) return;
    action("Reorder storyboard shots", (d) => {
      const [s] = d.storyboard.shots.splice(i, 1);
      d.storyboard.shots.splice(target, 0, s);
    });
  };
  return (
    <section className="story-timeline" aria-label="Storyboard sequence">
      <div className="story-timeline-tools">
        <div>
          <strong>Storyboard sequence</strong>
          <span>
            {c.shots.length} shots · {clock(c.duration)}
          </span>
        </div>
        <button aria-pressed={overview} onClick={() => setOverview((v) => !v)}>
          Fit storyboard timeline
        </button>
        <button onClick={() => add(titleShot(p))}>+ Title card</button>
        <button
          onClick={() =>
            add(
              shotFromMove(
                p,
                sourceIds[0] ?? "@start",
                "position-hold",
                "before",
              ),
            )
          }
        >
          + Position hold
        </button>
        <button
          disabled={!sourceIds.length}
          onClick={() => setTemplates((v) => !v)}
        >
          Story templates
        </button>
        <button
          className="primary"
          disabled={!c.shots.length || !!c.issues.length}
          onClick={exportStory}
        >
          Export storyboard
        </button>
      </div>
      <StoryboardWaveform
        p={p}
        edit={edit}
        time={time}
        seek={seek}
        selected={selected}
        select={select}
      />
      {overview && c.shots.length > 0 && (
        <div className="story-overview" aria-label="Entire storyboard">
          <span>Full sequence</span>
          <div>
            {c.shots.map((e) => (
              <button
                key={e.shot.id}
                style={{ flex: e.shot.duration }}
                title={`${e.index + 1}. ${e.shot.name} · ${e.shot.duration.toFixed(2)}s`}
                aria-label={`Go to shot ${e.index + 1}`}
                aria-current={e.shot.id === selected ? "true" : undefined}
                onClick={() => {
                  select(e.shot.id);
                  seek(e.start);
                  document
                    .querySelector(`[data-shot-id="${e.shot.id}"]`)
                    ?.scrollIntoView({ block: "nearest", inline: "center" });
                }}
              >
                {e.index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
      {templates && (
        <TemplatePanel
          p={p}
          sourceIds={sourceIds}
          edit={edit}
          select={select}
          close={() => setTemplates(false)}
          report={report}
        />
      )}
      {!c.shots.length ? (
        <div className="story-empty">
          <strong>Tell a story from your game</strong>
          <p>
            Select source moves on the left and choose Add. Or begin with a
            title card or position hold.
          </p>
        </div>
      ) : (
        <div
          className="shot-strip"
          aria-label="Storyboard shot cards"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            if (e.target !== e.currentTarget || !dragging) return;
            e.preventDefault();
            action("Reorder storyboard shots", (d) =>
              reorderShot(d.storyboard.shots, dragging, null),
            );
            setDragging(null);
            setOver(null);
          }}
        >
          {c.shots.map((entry) => (
            <ShotCard
              key={entry.shot.id}
              p={p}
              thumbnails={thumbnails}
              isPlaying={playing}
              shot={entry.shot}
              index={entry.index}
              active={entry.shot.id === selected}
              playing={time >= entry.start && time < entry.end}
              issue={entry.issue}
              dragging={dragging === entry.shot.id}
              before={over === entry.shot.id && dragging !== entry.shot.id}
              select={() => select(entry.shot.id)}
              play={() => playShot(entry.shot.id)}
              preview={() => {
                select(entry.shot.id);
                seek(entry.start);
              }}
              duplicate={() => duplicate(entry.shot.id)}
              remove={() => remove(entry.shot.id)}
              move={(dir) => move(entry.shot.id, dir)}
              source={() => openSource(entry.startIndex)}
              dragStart={() => setDragging(entry.shot.id)}
              dragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              dragOver={() => setOver(entry.shot.id)}
              drop={() => {
                if (dragging)
                  action("Reorder storyboard shots", (d) =>
                    reorderShot(d.storyboard.shots, dragging, entry.shot.id),
                  );
                setDragging(null);
                setOver(null);
              }}
              resize={(duration) =>
                action("Resize storyboard shot", (d) =>
                  resizeShot(
                    d.storyboard.shots.find((s) => s.id === entry.shot.id)!,
                    duration,
                  ),
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
function ShotCard({
  p,
  thumbnails,
  isPlaying,
  shot,
  index,
  active,
  playing,
  issue,
  dragging,
  before,
  select,
  preview,
  play,
  duplicate,
  remove,
  move,
  source,
  dragStart,
  dragEnd,
  dragOver,
  drop,
  resize,
}: {
  p: Project;
  thumbnails?: StoryThumbnails;
  isPlaying: boolean;
  shot: StoryboardShot;
  index: number;
  active: boolean;
  playing: boolean;
  issue: string | null;
  dragging: boolean;
  before: boolean;
  select: () => void;
  preview: () => void;
  play: () => void;
  duplicate: () => void;
  remove: () => void;
  move: (d: number) => void;
  source: () => void;
  dragStart: () => void;
  dragEnd: () => void;
  dragOver: () => void;
  drop: () => void;
  resize: (d: number) => void;
}) {
  const drag = useRef<{ x: number; duration: number } | null>(null),
    [draft, setDraft] = useState<number | null>(null);
  return (
    <article
      className={`shot-card ${active ? "selected" : ""} ${playing ? "at-playhead" : ""} ${dragging ? "dragging" : ""} ${before ? "drop-before" : ""}`}
      data-shot-id={shot.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", shot.id);
        e.dataTransfer.effectAllowed = "move";
        dragStart();
      }}
      onDragEnd={dragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        drop();
      }}
      tabIndex={0}
      aria-label={`Shot ${index + 1}: ${shot.name}`}
      onFocus={select}
      onClick={() => {
        select();
        preview();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,textarea,select")) return;
        if (e.altKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
          move(e.key === "ArrowLeft" ? -1 : 1);
        }
        if (e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          remove();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          e.preventDefault();
          e.stopPropagation();
          duplicate();
        }
      }}
    >
      <ShotThumbnail
        p={p}
        shot={shot}
        service={thumbnails}
        playing={isPlaying}
      />
      <div className="shot-card-name">
        <small>{index + 1}</small>
        <strong>{shot.name}</strong>
      </div>
      {index > 0 && shot.transition.type !== "cut" && (
        <button
          className="shot-transition"
          title={`Transition: ${shot.transition.type} · ${shot.transition.duration.toFixed(2)}s · select shot to edit`}
          onClick={(e) => {
            e.stopPropagation();
            select();
          }}
        >
          {shot.transition.type === "cross-dissolve" ? "◩" : "◐"}{" "}
          {shot.transition.duration.toFixed(2)}s
        </button>
      )}
      <span className="shot-duration">
        {(draft ?? shot.duration).toFixed(2)}s
      </span>
      {issue && <strong className="danger">Needs repair</strong>}
      <div className="shot-card-actions">
        <button
          aria-label={`Preview shot ${index + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            play();
          }}
        >
          Preview
        </button>
        <button
          aria-label={`Duplicate shot ${index + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            duplicate();
          }}
        >
          ⧉
        </button>
        <button
          aria-label={`Remove shot ${index + 1}`}
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
        >
          ×
        </button>
      </div>
      <div className="shot-card-actions">
        <button
          aria-label={`Move shot ${index + 1} earlier`}
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            move(-1);
          }}
        >
          ←
        </button>
        <button
          aria-label={`Move shot ${index + 1} later`}
          disabled={index === p.storyboard.shots.length - 1}
          onClick={(e) => {
            e.stopPropagation();
            move(1);
          }}
        >
          →
        </button>
        <button
          disabled={
            !shot.source || shot.source.startMoveId === "@start" || !!issue
          }
          onClick={(e) => {
            e.stopPropagation();
            source();
          }}
        >
          Source
        </button>
      </div>
      <div
        className="shot-resize"
        role="slider"
        tabIndex={0}
        aria-label={`Duration of shot ${index + 1}`}
        aria-valuenow={draft ?? shot.duration}
        aria-valuemin={0.1}
        aria-valuemax={600}
        draggable={false}
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, duration: shot.duration };
          setDraft(shot.duration);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setDraft(
              Math.max(
                0.1,
                Math.min(
                  600,
                  Math.round(
                    (drag.current.duration +
                      (e.clientX - drag.current.x) / 35) *
                      20,
                  ) / 20,
                ),
              ),
            );
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (drag.current && draft !== null) resize(draft);
          drag.current = null;
          setDraft(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
        onKeyDown={(e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
            resize(
              Math.max(
                0.1,
                shot.duration + (e.key === "ArrowRight" ? 0.1 : -0.1),
              ),
            );
          }
        }}
      />
    </article>
  );
}
