import { annotation } from "../../core/annotations";
import {
  compileStoryboard,
  resolveStoryboardFrame,
} from "../../core/storyboard";
import type { Project, Format, PlaybackMode } from "../../core/project";
import { buildGame, type Game } from "../../core/chess";
import { evaluateRenderFrame } from "./frame";
const emptyCache = new WeakMap<Project, Project>();
export function evaluatePresentationFrame(
  p: Project,
  time: number,
  w: number,
  h: number,
  format: Format = p.format,
  mode: PlaybackMode = "source",
  game?: Game,
) {
  if (mode === "source")
    return evaluateRenderFrame(p, time, w, h, format, game ?? buildGame(p));
  if (!Number.isFinite(time) || time < 0)
    throw RangeError("Invalid storyboard render time.");
  const resolved = resolveStoryboardFrame(p, time);
  if (!resolved || resolved.issue) {
    let empty = emptyCache.get(p);
    const text = resolved?.issue ?? "Add a shot to begin your story";
    if (!empty || empty.annotations[0]?.text !== text) {
      empty = {
        ...p,
        moves: [],
        lead: 0,
        tail: 3600,
        boardFX: { ...p.boardFX, intro: false },
        introTitle: { ...p.introTitle, enabled: false },
        annotations: [
          { ...annotation("caption", 0), text, end: 86400, fade: 0, y: 0.5 },
        ],
      };
      emptyCache.set(p, empty);
    }
    const c = evaluateRenderFrame(empty, time, w, h, format, {
      initial: [],
      steps: [],
      end: p.fen,
    });
    c.authoring = p;
    c.mode = mode;
    c.outputTime = time;
    c.annotationTime = time;
    c.titleCard = true;
    c.short = false;
    c.square = false;
    return c;
  }
  const r = resolved,
    compiled = compileStoryboard(p),
    origin = compiled.source.segments[r.startIndex]?.start ?? 0;
  const evaluationTime =
    r.shot.kind === "move-range"
      ? Math.max(0, r.sourceTime - origin)
      : r.localTime;
  const camera = r.shot.camera;
  const heldCamera =
    r.shot.kind === "move-range"
      ? undefined
      : camera
        ? {
            x: camera.mode === "full" ? 0 : camera.x,
            y: camera.mode === "full" ? 0 : camera.y,
            zoom: camera.mode === "full" ? 1 : camera.zoom,
            tilt: camera.tilt,
            rotation: camera.rotation,
          }
        : { ...r.initialCameras[format] };
  const c = evaluateRenderFrame(
    r.project,
    evaluationTime,
    w,
    h,
    format,
    r.game,
    r.initialCameras[format],
    heldCamera,
  );
  c.authoring = p;
  c.mode = mode;
  c.outputTime = r.outputTime;
  c.annotationTime = r.localTime;
  c.shot = {
    id: r.shot.id,
    index: r.index,
    localTime: r.localTime,
    sourceTime: r.sourceTime,
  };
  c.titleCard = r.shot.kind === "title-card";
  if (r.shot.kind === "position-hold" && !camera) {
    // Framing mode is independent of the legal piece list. A static hold has no
    // projected moves, but must retain the source's game/cropped viewport.
    const source = evaluateRenderFrame(
      p,
      r.sourceTime,
      w,
      h,
      format,
      compiled.game,
      undefined,
      heldCamera,
    );
    c.gameFraming = source.gameFraming;
    c.short = source.short;
    c.square = source.square;
    c.crop = source.crop;
    c.viewH = source.viewH;
    c.viewY = source.viewY;
  }
  if (c.titleCard) {
    c.short = false;
    c.square = false;
    c.gameFraming = false;
    c.crop = null;
    c.viewH = h;
    c.viewY = 0;
  }
  // Source animation clock and soundtrack marker clock are deliberately distinct.
  let pulse = 0;
  if (p.pulse.enabled)
    for (const beat of p.storyboard.beats) {
      if (!beat.enabled || (p.pulse.accentsOnly && !beat.accent)) continue;
      const age = r.outputTime - beat.time;
      if (age >= -p.pulse.attack && age <= p.pulse.decay)
        pulse = Math.max(
          pulse,
          age < 0
            ? 1 + age / p.pulse.attack
            : Math.exp((-age / p.pulse.decay) * 4),
        );
    }
  c.e.pulse = pulse * p.pulse.intensity;
  return c;
}
