import {
  camera,
  type Project,
  type Effect,
  type Format,
  type Key,
} from "./project";
import { buildGame, xy, type Game, type Piece } from "./chess";
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function ease(t: number, kind = "smooth") {
  t = clamp(t);
  if (kind === "linear") return t;
  if (kind === "soft") return 1 - (1 - t) ** 3;
  if (kind === "accelerate") return t ** 3;
  if (kind === "bounce")
    return t < 0.75
      ? (t / 0.75) ** 2
      : 1 + Math.sin((t - 0.75) * 4 * Math.PI) * 0.06;
  if (kind === "overshoot") {
    const c = 1.15;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  }
  return t * t * (3 - 2 * t);
}
export function curve(keys: Key[] | undefined, u: number, fallback: number) {
  if (!keys?.length) return fallback;
  const k = [...keys].sort((a, b) => a.at - b.at);
  if (u <= k[0].at) return k[0].value;
  for (let i = 1; i < k.length; i++)
    if (u <= k[i].at)
      return mix(
        k[i - 1].value,
        k[i].value,
        ease(
          (u - k[i - 1].at) / Math.max(0.0001, k[i].at - k[i - 1].at),
          k[i].ease,
        ),
      );
  return k.at(-1)!.value;
}
export function sway(u: number, cycles = 1) {
  if (u <= 0 || u >= 1) return 0;
  if (cycles === 0.5) return Math.sin(Math.PI * ease(u));
  const t = (u * cycles) % 1;
  if (t < 0.25) return ease(t * 4);
  if (t < 0.75) return mix(1, -1, ease((t - 0.25) * 2));
  return mix(-1, 0, ease((t - 0.75) * 4));
}
export function segments(p: Project) {
  let at = p.lead;
  return p.moves.map((m, i) => {
    const start = at,
      depart = start + m.effect.delay,
      land = depart + m.effect.duration * m.effect.landing,
      finish = depart + m.effect.duration;
    at = finish + m.effect.hold;
    return { i, start, depart, land, finish, end: at };
  });
}
export function duration(p: Project) {
  return (segments(p).at(-1)?.end ?? p.lead) + p.tail;
}
export function route(from: string, to: string, type: string) {
  if (type === "n") return [from, to];
  const dx = to.charCodeAt(0) - from.charCodeAt(0),
    dy = Number(to[1]) - Number(from[1]);
  if (dx && dy && Math.abs(dx) !== Math.abs(dy)) return [from, to];
  const count = Math.max(Math.abs(dx), Math.abs(dy));
  return Array.from(
    { length: count + 1 },
    (_, i) =>
      String.fromCharCode(from.charCodeAt(0) + Math.sign(dx) * i) +
      (Number(from[1]) + Math.sign(dy) * i),
  );
}
export function badge(m: Project["moves"][number]) {
  const b = m.effect.badge.manual;
  if (b === "none") return null;
  if (b) return b;
  if (m.analysis.book?.state === "found") return "book";
  return m.analysis.engine?.state === "done" ? m.analysis.engine.label : null;
}
export interface Visual extends Piece {
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
export interface Frame {
  time: number;
  index: number;
  u: number;
  pieces: Visual[];
  camera: {
    x: number;
    y: number;
    zoom: number;
    tilt: number;
    rotation: number;
  };
  effect: Effect | null;
  source: string | null;
  destination: string | null;
  path: string[];
  trail: [number, number][];
  glow: number;
  impact: number;
  badge: string | null;
  badgePosition: [number, number] | null;
  pulse: number;
}
function cameraTarget(p: Project, g: Game, i: number, f: Format, end = false) {
  const s = g.steps[i],
    c = s?.move.effect.cameras[f] ?? camera();
  if (!s || c.mode === "full")
    return { x: 0, y: 0, zoom: 1, tilt: c.tilt, rotation: c.rotation };
  const a = xy(s.from),
    b = xy(s.to),
    d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    x:
      c.mode === "manual"
        ? c.x
        : (c.mode === "follow" && end ? b[0] : ((a[0] + b[0]) / 2) * 0.55) +
          c.x,
    y:
      c.mode === "manual"
        ? c.y
        : (c.mode === "follow" && end ? b[1] : ((a[1] + b[1]) / 2) * 0.55) +
          c.y,
    zoom:
      c.mode === "manual"
        ? c.zoom
        : clamp(
            c.zoom +
              (c.mode === "follow" ? 0.25 : 0) -
              Math.max(0, d - 3) * 0.08 -
              c.padding * 0.07,
            0.75,
            2.5,
          ),
    tilt: c.tilt,
    rotation: c.rotation,
  };
}
export function evaluate(
  p: Project,
  time: number,
  g = buildGame(p),
  format = p.format,
): Frame {
  time = clamp(time, 0, duration(p));
  const seq = segments(p);
  let index = seq.findIndex((s) => time < s.end);
  if (index < 0) index = p.moves.length - 1;
  const seg = seq[index],
    step = g.steps[index],
    initial = !step || time < p.lead,
    e = initial ? null : step.move.effect,
    u = e ? clamp((time - seg.depart) / e.duration) : 0;
  let pieces: Visual[] = (initial ? g.initial : step.before).map((v) => ({
    ...v,
    x: xy(v.square)[0],
    y: xy(v.square)[1],
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    scale: 1,
    opacity: 1,
    moving: false,
  }));
  let trail: [number, number][] = [],
    glow = 0,
    impact = 0,
    shown: string | null = null,
    anchor: [number, number] | null = null;
  if (e && step) {
    const v = pieces.find((x) => x.id === step.pieceId)!,
      a = xy(step.from),
      b = xy(step.to),
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1;
    const travel = ease(u / e.landing, e.easing),
      t = curve(
        e.keys.travel,
        u,
        travel +
          e.overshoot *
            Math.sin(Math.PI * clamp(u / e.landing)) *
            Math.sin(Math.PI * 2 * clamp(u / e.landing)),
      );
    const bend = e.path * Math.sin(Math.PI * clamp(t));
    v.x = curve(e.keys.x, u, mix(a[0], b[0], t) - (dy / len) * bend);
    v.y = curve(e.keys.y, u, mix(a[1], b[1], t) + (dx / len) * bend);
    v.z = curve(
      e.keys.z,
      u,
      e.hop * Math.sin(Math.PI * clamp(travel)) * e.intensity,
    );
    const degrees = mix(
      e.rotation * ease(u / e.landing),
      Math.round(e.rotation / 360) * 360,
      ease((u - e.landing) / e.settle),
    );
    for (const axis of ["x", "y", "z"] as const) {
      const ch = ("r" + axis) as "rx" | "ry" | "rz";
      v[ch] =
        (curve(
          e.keys[ch],
          u,
          (e.axis === axis ? degrees : 0) +
            (axis === "z" ? e.sway * sway(u, e.cycles) : 0),
        ) *
          Math.PI) /
        180;
    }
    let growth = Math.sin(Math.PI * clamp(u / (e.peak * 2)));
    if (e.preset === "capture") {
      growth =
        u < e.capture.impact
          ? clamp(
              (u - e.capture.impact + e.capture.expansion) /
                e.capture.expansion,
            )
          : 1 - ease((u - e.capture.impact) / e.capture.returnTime);
      glow = Math.max(0, growth) * e.capture.glow * e.intensity;
      impact = Math.max(0, 1 - Math.abs(u - e.capture.impact) / 0.13);
    }
    v.scale = clamp(
      curve(
        e.keys.scale,
        u,
        1 +
          Math.max(0, growth) *
            ((e.preset === "capture" ? e.capture.grow : e.scale) - 1) *
            e.intensity,
      ),
      0.05,
      4,
    );
    v.opacity = clamp(curve(e.keys.opacity, u, 1));
    v.moving = u > 0 && u < 1;
    if (step.promotion && u >= e.landing) v.type = step.promotion;
    if (step.capturedId) {
      const c = pieces.find((x) => x.id === step.capturedId)!;
      const exit = clamp((u - e.capture.exitAt) / 0.12);
      c.opacity = 1 - exit;
      if (e.capture.exit === "shrink") c.scale = 1 - exit;
      if (e.capture.exit === "drop") c.z = -exit * 2;
    }
    if (step.rook) {
      const r = pieces.find((x) => x.id === step.rook!.id)!,
        a = xy(step.rook.from),
        b = xy(step.rook.to);
      r.x = mix(a[0], b[0], travel);
      r.y = mix(a[1], b[1], travel);
    }
    if (e.highlight.trail && u < 1) {
      trail = Array.from({ length: 22 }, (_, i) => {
        const q = clamp(t - (21 - i) * 0.014),
          bend = e.path * Math.sin(Math.PI * q);
        return [
          mix(a[0], b[0], q) - (dy / len) * bend,
          mix(a[1], b[1], q) + (dx / len) * bend,
        ] as [number, number];
      });
    }
    if (u >= e.badge.start && time <= seg.finish + e.badge.end) {
      shown = badge(step.move);
      anchor = [v.x + e.badge.offsetX, v.y + e.badge.offsetY];
    }
    if (u >= 1) {
      pieces = step.after.map((v) => ({
        ...v,
        x: xy(v.square)[0],
        y: xy(v.square)[1],
        z: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        scale: 1,
        opacity: 1,
        moving: false,
      }));
      glow = 0;
      impact = 0;
    }
  }
  const previous = cameraTarget(p, g, index - 1, format, true),
    target = cameraTarget(p, g, index, format, u >= 1);
  if (e && e.cameras[format]?.mode === "follow") {
    const subject = pieces.find((v) => v.id === step.pieceId);
    if (subject) {
      target.x = subject.x + (e.cameras[format]?.x ?? 0);
      target.y = subject.y + (e.cameras[format]?.y ?? 0);
    }
  }
  if (e) {
    for (const ch of ["cameraX", "cameraY", "cameraZoom"] as const) {
      const k = ch === "cameraX" ? "x" : ch === "cameraY" ? "y" : "zoom";
      target[k] = curve(e.keys[ch], u, target[k]);
    }
  }
  const blend = initial
    ? 0
    : ease(
        (time - seg.start) /
          (e?.cameras[format]?.transition ?? camera().transition),
      );
  const cam = {
    x: mix(previous.x, target.x, blend),
    y: mix(previous.y, target.y, blend),
    zoom: mix(previous.zoom, target.zoom, blend),
    tilt: mix(previous.tilt, target.tilt, blend),
    rotation: mix(previous.rotation, target.rotation, blend),
  };
  let pulse = 0;
  if (p.pulse.enabled)
    for (const b of p.beats) {
      if (!b.enabled || (p.pulse.accentsOnly && !b.accent)) continue;
      const dt = time - b.time;
      if (dt >= -p.pulse.attack && dt <= p.pulse.decay)
        pulse = Math.max(
          pulse,
          dt < 0
            ? 1 + dt / p.pulse.attack
            : Math.exp((-dt / p.pulse.decay) * 4),
        );
    }
  return {
    time,
    index,
    u,
    pieces,
    camera: cam,
    effect: e,
    source: step?.from ?? null,
    destination: step?.to ?? null,
    path: step
      ? route(
          step.from,
          step.to,
          step.before.find((v) => v.id === step.pieceId)!.type,
        )
      : [],
    trail,
    glow,
    impact,
    badge: shown,
    badgePosition: anchor,
    pulse: pulse * p.pulse.intensity,
  };
}
const random = (v: number) => {
  const n = Math.sin(v * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export function particle(i: number, time: number, a: Project["ambient"]) {
  const seed = i + a.seed;
  return {
    x:
      ((random(seed) * 12 +
        Math.sin(time * 0.4 + seed) * a.drift +
        a.direction * time * 0.1 +
        12) %
        12) -
      6,
    y:
      ((random(seed + 41) * 12 - time * a.speed * random(seed + 12) + 1200) %
        12) -
      6,
    z: random(seed + 82) * a.depth,
    size: a.size * (0.6 + random(seed + 3)),
    alpha: a.opacity * (0.3 + 0.7 * random(seed + 5)),
  };
}
