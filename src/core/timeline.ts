import {
  type Project,
  type Effect,
  type Easing,
  type Keyframe,
  type Format,
  cameraDefault,
} from "./model";
import { buildGame, squareXY, type Game, type PieceState } from "./chess";

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function ease(t: number, e: Easing): number {
  t = clamp(t);
  switch (e) {
    case "smooth":
      return t * t * (3 - 2 * t);
    case "soft-landing":
      return 1 - (1 - t) ** 3;
    case "accelerate":
      return t ** 3;
    case "bounce":
      return t < 0.75
        ? (t / 0.75) ** 2
        : 1 + Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.075;
    case "overshoot": {
      const c = 1.2;
      return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
    }
    default:
      return t;
  }
}
export function curve(
  keys: Keyframe[] | undefined,
  t: number,
  fallback: number,
): number {
  if (!keys?.length) return fallback;
  const k = [...keys].sort((a, b) => a.t - b.t);
  if (t <= k[0].t) return k[0].value;
  const i = k.findIndex((x) => x.t >= t);
  if (i < 0) return k.at(-1)!.value;
  const a = k[i - 1],
    b = k[i];
  return lerp(
    a.value,
    b.value,
    ease((t - a.t) / Math.max(0.00001, b.t - a.t), b.easing),
  );
}
export interface Segment {
  index: number;
  start: number;
  departure: number;
  landing: number;
  end: number;
}
export function segments(p: Project): Segment[] {
  let time = p.leadIn;
  return p.moves.map((m, index) => {
    const start = time,
      departure = start + m.effect.delay,
      landing = departure + m.effect.duration * m.effect.landing;
    time = departure + m.effect.duration + m.effect.hold;
    return { index, start, departure, landing, end: time };
  });
}
export const duration = (p: Project) =>
  (segments(p).at(-1)?.end ?? p.leadIn) + p.tailHold;
export interface RenderPiece extends PieceState {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
  moving: boolean;
}
export interface Evaluation {
  time: number;
  index: number;
  progress: number;
  pieces: RenderPiece[];
  effect: Effect | null;
  from: string | null;
  to: string | null;
  highlights: string[];
  trail: [number, number][];
  glow: number;
  impact: number;
  badge: string | null;
  badgeAt: [number, number] | null;
  camera: {
    x: number;
    y: number;
    zoom: number;
    tilt: number;
    rotation: number;
  };
  pulse: number;
  check: boolean;
  mate: boolean;
}
export function badgeFor(m: Project["moves"][number]): string | null {
  return (
    m.effect.badge.manual ??
    (m.analysis.book?.state === "found"
      ? "book"
      : m.analysis.engine?.state === "done"
        ? m.analysis.engine.label
        : null)
  );
}
export function routeSquares(from: string, to: string, type: string): string[] {
  if (type === "n") return [from, to];
  const dx = to.charCodeAt(0) - from.charCodeAt(0),
    dy = Number(to[1]) - Number(from[1]);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return [from, to];
  const count = Math.max(Math.abs(dx), Math.abs(dy));
  return Array.from(
    { length: count + 1 },
    (_, i) =>
      String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * i) +
      (Number(from[1]) + Math.sign(dy) * i),
  );
}
function target(p: Project, g: Game, i: number, f: Format, end = false) {
  const step = g.steps[i],
    c = step?.move.effect.cameras[f] ?? cameraDefault();
  if (!step || c.mode === "full")
    return { x: 0, y: 0, zoom: 1, tilt: c.tilt, rotation: c.rotation };
  const a = squareXY(step.from),
    b = squareXY(step.to),
    distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const weight =
    c.mode === "route" ? Math.min(1, 0.25 + Math.max(0, c.zoom - 1.2)) : 1;
  const result = {
    x:
      c.mode === "manual"
        ? c.x
        : c.mode === "follow" && end
          ? b[0] + c.x
          : (a[0] + b[0]) * 0.5 * weight + c.x,
    y:
      c.mode === "manual"
        ? c.y
        : c.mode === "follow" && end
          ? b[1] + c.y
          : (a[1] + b[1]) * 0.5 * weight + c.y,
    zoom:
      c.mode === "manual"
        ? c.zoom
        : Math.min(c.zoom, 8 / (distance + 2 + c.padding)),
    tilt: c.tilt,
    rotation: c.rotation,
  };
  if (end) {
    result.x = curve(step.move.effect.keys.cameraX, 1, result.x);
    result.y = curve(step.move.effect.keys.cameraY, 1, result.y);
    result.zoom = clamp(
      curve(step.move.effect.keys.zoom, 1, result.zoom),
      0.5,
      3,
    );
  }
  return result;
}
export function evaluate(
  p: Project,
  time: number,
  game = buildGame(p),
  format: Format = p.output,
): Evaluation {
  time = clamp(time, 0, duration(p));
  const segs = segments(p);
  let index = segs.findIndex((s) => time < s.end);
  if (index < 0) index = p.moves.length - 1;
  const seg = segs[index],
    step = game.steps[index];
  const initial = !seg || time < seg.start;
  const e = initial ? null : step.move.effect;
  const u = e ? clamp((time - seg.departure) / e.duration) : 0;
  const travel = e ? ease(clamp(u / e.landing), e.easing) : 0;
  const base = initial ? game.initial : step.before;
  const pieces: RenderPiece[] = base.map((piece) => {
    const [x, y] = squareXY(piece.square);
    return {
      ...piece,
      x,
      y,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      scale: 1,
      opacity: 1,
      moving: false,
    };
  });
  let trail: [number, number][] = [],
    badgeAt: [number, number] | null = null;
  let impact = 0,
    glow = 0;
  if (e && step) {
    const moving = pieces.find((x) => x.id === step.pieceId)!;
    const a = squareXY(step.from),
      b = squareXY(step.to),
      d = [b[0] - a[0], b[1] - a[1]],
      len = Math.hypot(...d) || 1;
    const t = curve(
      e.keys.travel,
      u,
      travel +
        e.overshoot *
          Math.sin(Math.PI * clamp(u / e.landing)) *
          Math.sin(Math.PI * 2 * clamp(u / e.landing)),
    );
    const path = e.path * Math.sin(Math.PI * clamp(t));
    moving.x = lerp(a[0], b[0], t) - (d[1] / len) * path;
    moving.y = lerp(a[1], b[1], t) + (d[0] / len) * path;
    moving.z = e.hop * Math.sin(Math.PI * clamp(travel)) * e.intensity;
    moving.x = curve(e.keys.positionX, u, moving.x);
    moving.y = curve(e.keys.positionY, u, moving.y);
    moving.z = curve(e.keys.positionZ, u, moving.z);
    const turn = e.rotation * ease(clamp(u / e.landing), "smooth");
    // The settling window restores a stable orientation even for partial turns.
    const settle = ease(clamp((u - e.landing) / e.settle), "smooth");
    const angle =
      (lerp(turn, Math.round(e.rotation / 360) * 360, settle) * Math.PI) / 180;
    moving.rx =
      (curve(
        e.keys.rotationX,
        u,
        e.axis === "x" ? (angle * 180) / Math.PI : 0,
      ) *
        Math.PI) /
      180;
    moving.ry =
      (curve(
        e.keys.rotationY,
        u,
        e.axis === "y" ? (angle * 180) / Math.PI : 0,
      ) *
        Math.PI) /
      180;
    moving.rz =
      (curve(
        e.keys.rotationZ,
        u,
        (e.axis === "z" ? (angle * 180) / Math.PI : 0) +
          e.wiggle *
            Math.sin(travel * Math.PI * 2 * e.frequency) *
            Math.sin(Math.PI * clamp(travel)),
      ) *
        Math.PI) /
      180;
    const peak = e.preset === "capture" ? e.impact : e.peak;
    const grow =
      u < peak
        ? clamp((u - (peak - e.expansion)) / e.expansion)
        : 1 - ease(clamp((u - peak) / Math.max(0.01, 1 - peak)), e.returnEase);
    const shape =
      e.preset === "capture"
        ? grow
        : Math.sin(Math.PI * clamp(u / Math.max(0.01, peak * 2)));
    moving.scale = clamp(
      curve(
        e.keys.scale,
        u,
        1 + (e.scale - 1) * Math.max(0, shape) * e.intensity,
      ),
      0.05,
      5,
    );
    moving.opacity = clamp(curve(e.keys.opacity, u, 1));
    moving.moving = u > 0 && u < 1;
    if (step.promotion && u >= e.landing) moving.type = step.promotion;
    if (step.captureId) {
      const captured = pieces.find((x) => x.id === step.captureId);
      if (captured) captured.opacity = 1 - clamp((u - e.capturedAt) / 0.08);
    }
    if (step.rook) {
      const rook = pieces.find((x) => x.id === step.rook!.id)!;
      const r1 = squareXY(step.rook.from),
        r2 = squareXY(step.rook.to);
      rook.x = lerp(r1[0], r2[0], travel);
      rook.y = lerp(r1[1], r2[1], travel);
    }
    // Keyframes cannot leave a move in an illegal resting position.
    if (u >= 1) {
      for (const v of pieces) {
        const final = step.after.find((x) => x.id === v.id);
        if (!final) {
          v.opacity = 0;
          continue;
        }
        Object.assign(v, final, {
          x: squareXY(final.square)[0],
          y: squareXY(final.square)[1],
          z: 0,
          rx: 0,
          ry: 0,
          rz: 0,
          scale: 1,
          opacity: 1,
          moving: false,
        });
      }
    }
    trail = Array.from({ length: 25 }, (_, i) => {
      const v = (clamp(t) * i) / 24;
      return [
        lerp(a[0], b[0], v) - (d[1] / len) * e.path * Math.sin(Math.PI * v),
        lerp(a[1], b[1], v) + (d[0] / len) * e.path * Math.sin(Math.PI * v),
      ];
    });
    badgeAt = [moving.x + e.badge.x, moving.y + e.badge.y];
    impact = clamp(1 - Math.abs(u - e.impact) / 0.17) * e.intensity;
    glow = impact * e.glow;
  }
  const cam = target(p, game, initial ? -1 : index, format),
    prev = target(p, game, index - 1, format, true);
  if (e && seg) {
    const c = e.cameras[format] ?? cameraDefault();
    const mix = ease(clamp((time - seg.start) / c.transition), "smooth");
    if (c.mode === "follow") {
      const m = pieces.find((x) => x.id === step.pieceId)!;
      cam.x = m.x + c.x;
      cam.y = m.y + c.y;
    }
    cam.x = lerp(prev.x, cam.x, mix);
    cam.y = lerp(prev.y, cam.y, mix);
    cam.zoom = lerp(prev.zoom, cam.zoom, mix);
    cam.tilt = lerp(prev.tilt, cam.tilt, mix);
    cam.rotation = lerp(prev.rotation, cam.rotation, mix);
    cam.x = curve(e.keys.cameraX, u, cam.x);
    cam.y = curve(e.keys.cameraY, u, cam.y);
    cam.zoom = clamp(curve(e.keys.zoom, u, cam.zoom), 0.5, 3);
  }
  let pulse = 0;
  if (p.pulse.enabled)
    for (const b of p.beats) {
      if (
        (p.pulse.selection === "strong" && !b.strong) ||
        (p.pulse.selection === "selected" && !b.selected)
      )
        continue;
      const dt = time - b.time;
      const v =
        dt < 0 ? clamp(1 + dt / p.pulse.attack) : clamp(1 - dt / p.pulse.decay);
      pulse = Math.max(pulse, v * p.pulse.intensity);
    }
  const badge =
    e && u >= e.badge.start && u <= e.badge.end ? badgeFor(step.move) : null;
  return {
    time,
    index: initial ? -1 : index,
    progress: u,
    pieces,
    effect: e,
    from: initial ? null : step.from,
    to: initial ? null : step.to,
    highlights:
      e && e.highlights && u >= e.reveal
        ? e.pathSquares
          ? routeSquares(
              step.from,
              step.to,
              base.find((x) => x.id === step.pieceId)!.type,
            )
          : [step.from, step.to]
        : [],
    trail,
    glow,
    impact,
    badge,
    badgeAt,
    camera: cam,
    pulse,
    check: !!e && u >= e.landing && step.check,
    mate: !!e && u >= e.landing && step.mate,
  };
}
export function particle(
  seed: number,
  i: number,
  time: number,
  p: Project["ambient"],
): { x: number; y: number; z: number; size: number; alpha: number } {
  const random = (k: number) => {
    let n =
      (seed ^ Math.imul(i + 1, 374761393) ^ Math.imul(k, 668265263)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const wrap = (v: number) => ((((v + 8) % 16) + 16) % 16) - 8;
  const angle = (p.direction * Math.PI) / 180;
  return {
    x: wrap(random(1) * 16 - 8 + time * (p.drift + Math.sin(angle) * p.speed)),
    y: wrap(random(2) * 16 - 8 - time * Math.cos(angle) * p.speed),
    z: random(3) * p.depth,
    size: p.size * (0.5 + random(4)),
    alpha: p.opacity * (0.3 + 0.7 * random(5)),
  };
}
