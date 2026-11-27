import { activeBeats } from "./beatMarkers";
import type { Effect, Project } from "./project";
import {
  afterEffectWindow,
  moveHold,
  moveLead,
  spotlightPeaks,
  spotlightStart,
} from "./timeline";

export const pinEvents = ["landing", "capture", "zoom", "after"] as const;
export type PinEvent = (typeof pinEvents)[number];
export const pinLabels: Record<PinEvent, string> = {
  landing: "Piece landing",
  capture: "Capture impact",
  zoom: "First beat zoom peak",
  after: "After-effect start",
};

export function beatEventTime(
  p: Project,
  e: Effect,
  depart: number,
  event: PinEvent,
) {
  const land = depart + e.duration * e.landing;
  const finish = depart + e.duration;
  if (event === "landing") return land;
  if (event === "capture") return depart + e.duration * e.capture.impact;
  if (event === "after") return afterEffectWindow(e, { finish })?.start;
  const start = spotlightStart(e, { land, finish });
  return spotlightPeaks(p, e, start)[0]?.time;
}

export function reconcileBeatPins(p: Project): Project {
  const byId = new Map(activeBeats(p).map((beat) => [beat.id, beat.time]));
  if (!byId.size) return p;
  const reconcile = (moves: Project["moves"]) => {
    let cursor = p.lead;
    let changed = false;
    const next = moves.map((move) => {
      const old = move.effect;
      const depart = cursor + moveLead(old);
      let e = old;
      const landing = byId.get(old.landingBeat ?? "");
      const duration =
        landing === undefined ? old.duration : (landing - depart) / old.landing;
      if (
        !old.locked &&
        duration >= 0.2 &&
        duration <= 30 &&
        Math.abs(duration - old.duration) > 1e-8
      )
        e = { ...e, duration };
      const contact = byId.get(old.capture.beat ?? "");
      const impact =
        contact === undefined
          ? old.capture.impact
          : (contact - depart) / e.duration;
      if (
        !old.locked &&
        impact >= 0.2 &&
        impact <= 0.95 &&
        Math.abs(impact - old.capture.impact) > 1e-8
      )
        e = { ...e, capture: { ...e.capture, impact, exitAt: impact } };
      const after = byId.get(old.after.beat ?? "");
      const delay =
        after === undefined ? old.after.delay : after - depart - e.duration;
      if (
        !old.locked &&
        delay >= 0 &&
        delay <= 3 &&
        Math.abs(delay - old.after.delay) > 1e-8
      )
        e = { ...e, after: { ...e.after, delay } };
      cursor = depart + e.duration + moveHold(e);
      if (e === old) return move;
      changed = true;
      return { ...move, effect: e };
    });
    return changed ? next : moves;
  };
  const moves = reconcile(p.moves);
  let lines = p.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === p.line || !line.moves) continue;
    const next = reconcile(line.moves);
    if (next === line.moves) continue;
    if (lines === p.lines) lines = [...lines];
    lines[i] = { ...line, moves: next };
  }
  return moves === p.moves && lines === p.lines ? p : { ...p, moves, lines };
}
