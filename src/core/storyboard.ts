import { annotation, annotationOpacity, type Annotation } from "./annotations";
import { buildGame, type Game } from "./chess";
import {
  compileTimeline,
  evaluate,
  type Frame,
  type CompiledTimeline,
} from "./timeline";
import {
  effect,
  camera,
  uid,
  type Project,
  type StoryboardShot,
  type PlaybackMode,
  type Format,
} from "./project";
import { pasteSettings } from "./editing";
export type CompiledShot = {
  shot: StoryboardShot;
  index: number;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  startIndex: number;
  endIndex: number;
  issue: string | null;
  project: Project;
  game: Game;
  initialCameras: Record<Format, Frame["camera"]>;
};
export type CompiledStoryboard = {
  shots: CompiledShot[];
  duration: number;
  issues: { id: string; message: string }[];
  source: CompiledTimeline;
  game: Game;
};
const cache = new WeakMap<Project, CompiledStoryboard>();
const sourceContexts = new Map<
  string,
  {
    game: Game;
    timeline: CompiledTimeline;
    cameras: Map<string, Record<Format, Frame["camera"]>>;
  }
>();
function sourceContext(p: Project) {
  const key = JSON.stringify({
    fen: p.fen,
    moves: p.moves,
    lead: p.lead,
    tail: p.tail,
    shorts: p.shorts.enabled,
    pulse: p.pulse,
    beats: p.beats,
  });
  let value = sourceContexts.get(key);
  if (!value) {
    value = {
      game: buildGame(p),
      timeline: compileTimeline(p),
      cameras: new Map(),
    };
    sourceContexts.set(key, value);
    while (sourceContexts.size > 4)
      sourceContexts.delete(sourceContexts.keys().next().value!);
  }
  return value;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Compile immutable project snapshots, matching the source timeline cache contract. */
export function compileStoryboard(p: Project): CompiledStoryboard {
  const cached = cache.get(p);
  if (cached) return cached;
  const context = sourceContext(p);
  const timeline = context.timeline,
    game = context.game,
    indices = new Map(p.moves.map((m, i) => [m.id, i]));
  let at = 0;
  const shots = p.storyboard.shots.map((shot, index): CompiledShot => {
    const start = at;
    at = Math.round((at + shot.duration) * 1e9) / 1e9;
    const i = indices.get(shot.source?.startMoveId ?? "") ?? -1,
      j = indices.get(shot.source?.endMoveId ?? "") ?? -1;
    const starting =
      shot.kind === "position-hold" &&
      shot.source?.startMoveId === "@start" &&
      shot.source?.endMoveId === "@start";
    let issue: string | null = null;
    if (shot.kind !== "title-card" && !starting && (i < 0 || j < 0))
      issue = "Source move is missing. Relink or remove this shot.";
    else if (shot.kind === "move-range" && j < i)
      issue = "The source end must follow its start.";
    const a = timeline.segments[i]?.start ?? 0,
      b = timeline.segments[j]?.end ?? 0;
    if (
      !issue &&
      shot.kind === "move-range" &&
      b - a - shot.trimStart - shot.trimEnd < 0.01
    )
      issue = "Trims remove the entire source range.";
    let projection: Project = {
      ...p,
      boardFX: { ...p.boardFX, intro: false },
      introTitle: { ...p.introTitle, enabled: false },
      annotations: shot.annotations,
      evalBar: shot.kind === "title-card" ? false : p.evalBar,
    };
    let shotGame = game;
    const cameraKey = `${i}:${shot.kind === "position-hold" ? shot.source?.position : "before"}`;
    let initialCameras = context.cameras.get(cameraKey);
    if (!initialCameras) {
      initialCameras = Object.fromEntries(
        (Object.keys(p.layouts) as Format[]).map((f) => [
          f,
          evaluate(
            p,
            shot.kind === "position-hold" && shot.source?.position === "after"
              ? (timeline.segments[i]?.finish ?? 0)
              : a,
            game,
            f,
            timeline,
          ).camera,
        ]),
      ) as Record<Format, Frame["camera"]>;
      context.cameras.set(cameraKey, initialCameras);
    }
    if (shot.kind === "move-range") {
      const moves = p.moves.slice(Math.max(0, i), j + 1).map((m) => {
        let e =
          shot.preset === "inherit"
            ? m.effect
            : pasteSettings(m.effect, {
                kind: "movement",
                source: effect(shot.preset),
                format: p.format,
              });
        if (shot.camera) {
          e = { ...e, cameras: { ...e.cameras } };
          for (const f of Object.keys(p.layouts) as Format[])
            e.cameras[f] = { ...shot.camera };
        }
        return { ...m, effect: e };
      });
      projection = {
        ...projection,
        fen: game.steps[i]?.fen ?? p.fen,
        moves,
        lead: 0,
        tail: 0,
      };
      shotGame = {
        initial: game.steps[i]?.before ?? game.initial,
        end: game.steps[j + 1]?.fen ?? game.end,
        steps: game.steps
          .slice(Math.max(0, i), j + 1)
          .map((step, k) => ({ ...step, move: moves[k] })),
      };
      const rate =
        (b - a - shot.trimStart - shot.trimEnd) /
        (shot.duration - shot.preHold - shot.postHold);
      projection.beats = p.storyboard.beats
        .filter((beat) => beat.time >= start && beat.time < at)
        .map((beat) => ({
          ...beat,
          time: shot.trimStart + (beat.time - start - shot.preHold) * rate,
        }));
      if (shot.inheritAnnotations && !issue)
        projection.annotations = [
          ...p.annotations
            .filter(
              (ann) =>
                ann.end > a + shot.trimStart && ann.start < b - shot.trimEnd,
            )
            .map((ann) => ({
              ...ann,
              id: `source-${ann.id}`,
              start: Math.max(
                shot.preHold,
                shot.preHold + (ann.start - a - shot.trimStart) / rate,
              ),
              end: Math.min(
                shot.duration - shot.postHold,
                shot.preHold + (ann.end - a - shot.trimStart) / rate,
              ),
              fade: Math.min(5, ann.fade / rate),
            })),
          ...shot.annotations,
        ];
    } else {
      const after = shot.source?.position === "after",
        step = game.steps[i];
      const fen = step
        ? after
          ? (game.steps[i + 1]?.fen ?? game.end)
          : step.fen
        : p.fen;
      projection = {
        ...projection,
        fen,
        moves: [],
        lead: 0,
        tail: shot.duration,
      };
      shotGame = {
        initial: step ? (after ? step.after : step.before) : game.initial,
        steps: [],
        end: fen,
      };
      if (shot.kind === "position-hold" && shot.inheritAnnotations && !issue) {
        const sourceTime = after ? (timeline.segments[i]?.finish ?? 0) : a;
        projection.annotations = [
          ...p.annotations
            .filter((ann) => annotationOpacity(ann, sourceTime) > 0)
            .map((ann) => ({
              ...ann,
              id: `source-${ann.id}`,
              start: 0,
              end: shot.duration,
              fade: 0,
              entrance: "none" as const,
              exit: "none" as const,
              opacity: annotationOpacity(ann, sourceTime),
            })),
          ...shot.annotations,
        ];
      }
    }
    return {
      shot,
      index,
      start,
      end: at,
      sourceStart: a + shot.trimStart,
      sourceEnd: b - shot.trimEnd,
      startIndex: i,
      endIndex: j,
      issue,
      project: projection,
      game: shotGame,
      initialCameras,
    };
  });
  const result = {
    shots,
    duration: at,
    issues: shots
      .filter((s) => s.issue)
      .map((s) => ({ id: s.shot.id, message: s.issue! })),
    source: timeline,
    game,
  };
  cache.set(p, result);
  return result;
}
export function storyboardDuration(p: Project) {
  return compileStoryboard(p).duration;
}
export function presentationDuration(
  p: Project,
  mode: PlaybackMode = "source",
) {
  return mode === "storyboard"
    ? storyboardDuration(p)
    : compileTimeline(p).duration;
}
export function resolveStoryboardFrame(p: Project, outputTime: number) {
  if (!Number.isFinite(outputTime))
    throw RangeError("Storyboard time must be finite.");
  const compiled = compileStoryboard(p);
  if (!compiled.shots.length) return null;
  const t = clamp(outputTime, 0, compiled.duration),
    entry = compiled.shots.find((s) => t < s.end) ?? compiled.shots.at(-1)!;
  const localTime = clamp(t - entry.start, 0, entry.shot.duration),
    s = entry.shot;
  const active = s.duration - s.preHold - s.postHold;
  const ratio =
    s.kind === "move-range" ? clamp((localTime - s.preHold) / active, 0, 1) : 0;
  const sourceTime =
    s.kind === "move-range"
      ? entry.sourceStart + (entry.sourceEnd - entry.sourceStart) * ratio
      : s.source?.position === "after"
        ? (compiled.source.segments[entry.startIndex]?.finish ?? 0)
        : (compiled.source.segments[entry.startIndex]?.start ?? 0);
  return {
    ...entry,
    outputTime: t,
    localTime,
    sourceTime,
    held:
      s.kind !== "move-range" ||
      localTime < s.preHold ||
      localTime >= s.duration - s.postHold,
    rate:
      s.kind === "move-range"
        ? (entry.sourceEnd - entry.sourceStart) / active
        : 0,
  };
}
/** Return all occurrences, since one source moment may appear repeatedly in a reel. */
export function sourceToStoryboard(p: Project, sourceTime: number) {
  const c = compileStoryboard(p);
  return c.shots.flatMap<{ id: string; time: number; end?: number }>((e) => {
    if (e.issue || e.shot.kind === "title-card") return [];
    if (e.shot.kind === "position-hold") {
      const held =
        e.shot.source?.position === "after"
          ? (c.source.segments[e.startIndex]?.finish ?? 0)
          : (c.source.segments[e.startIndex]?.start ?? 0);
      return Math.abs(sourceTime - held) < 1e-9
        ? [{ id: e.shot.id, time: e.start, end: e.end }]
        : [];
    }
    if (sourceTime < e.sourceStart || sourceTime >= e.sourceEnd) return [];
    return [
      {
        id: e.shot.id,
        time:
          e.start +
          e.shot.preHold +
          ((sourceTime - e.sourceStart) / (e.sourceEnd - e.sourceStart)) *
            (e.shot.duration - e.shot.preHold - e.shot.postHold),
        end: undefined,
      },
    ];
  });
}
export function shotFromMove(
  p: Project,
  id: string,
  kind: StoryboardShot["kind"] = "move-range",
  position: "before" | "after" = "after",
): StoryboardShot {
  if (id === "@start" && kind === "position-hold")
    return {
      ...titleShot(p, "Starting position", 3),
      kind,
      source: {
        startMoveId: "@start",
        endMoveId: "@start",
        position: "before",
      },
      annotations: [],
    };
  const i = p.moves.findIndex((m) => m.id === id);
  if (i < 0) throw Error("Choose a source move.");
  const seg = compileTimeline(p).segments[i];
  return {
    id: uid(),
    name:
      kind === "position-hold"
        ? `Position ${position} ${p.moves[i].san}`
        : p.moves[i].san,
    kind,
    source: { startMoveId: id, endMoveId: id, position },
    duration: kind === "move-range" ? Math.max(0.1, seg.end - seg.start) : 3,
    preHold: 0,
    postHold: 0,
    trimStart: 0,
    trimEnd: 0,
    preset: "inherit",
    camera: null,
    inheritAnnotations: false,
    annotations: [],
  };
}
export function shotCaption(
  p: Project,
  text: string,
  duration: number,
): Annotation {
  return {
    ...annotation("caption", 0),
    text,
    end: duration,
    size:
      p.format === "vertical" || p.format === "square-in-vertical" ? 82 : 54,
    y: p.format === "vertical" ? 0.15 : 0.1,
    entrance: "fade",
    fade: 0.2,
  };
}
export function titleShot(
  p: Project,
  title = "Your chess story",
  duration = 2.5,
): StoryboardShot {
  return {
    id: uid(),
    name: title,
    kind: "title-card",
    source: null,
    duration,
    preHold: 0,
    postHold: 0,
    trimStart: 0,
    trimEnd: 0,
    preset: "inherit",
    camera: { ...camera(), mode: "full" },
    inheritAnnotations: false,
    annotations: [
      {
        ...shotCaption(p, title, duration),
        kind: "text",
        y: 0.45,
        size: p.format === "vertical" ? 110 : 78,
      },
    ],
  };
}
export function resizeShot(shot: StoryboardShot, duration: number) {
  const next = clamp(duration, 0.1, 600);
  shot.duration = next;
  if (shot.preHold + shot.postHold >= next - 0.01) {
    const scale = (next - 0.02) / Math.max(0.001, shot.preHold + shot.postHold);
    shot.preHold *= scale;
    shot.postHold *= scale;
  }
  shot.annotations = shot.annotations.map((a) => ({
    ...a,
    start: Math.min(a.start, Math.max(0, next - 0.05)),
    end: Math.max(0.05, Math.min(a.end, next)),
  }));
}
export function duplicateShot(shot: StoryboardShot): StoryboardShot {
  return {
    ...structuredClone(shot),
    id: uid(),
    name: shot.name.slice(0, 115) + " copy",
    annotations: shot.annotations.map((a) => ({
      ...structuredClone(a),
      id: uid(),
    })),
  };
}
export function reorderShot(
  shots: StoryboardShot[],
  id: string,
  beforeId: string | null,
) {
  const from = shots.findIndex((s) => s.id === id);
  if (from < 0 || beforeId === id) return;
  const [shot] = shots.splice(from, 1);
  const to = beforeId ? shots.findIndex((s) => s.id === beforeId) : -1;
  shots.splice(to < 0 ? shots.length : to, 0, shot);
}
export function validateStoryboardExport(p: Project) {
  const c = compileStoryboard(p);
  if (!c.shots.length) throw Error("Add storyboard shots before exporting.");
  if (c.issues.length) throw Error(c.issues[0].message);
  if (c.duration > 3600)
    throw Error("Storyboard export is limited to one hour.");
  return c;
}
