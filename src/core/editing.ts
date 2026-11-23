import { Chess } from "chess.js";
import { moveLead } from "./timeline";
import {
  effectSchema,
  settingsKinds,
  type Effect,
  type Project,
  type Format,
} from "./project";
export const timingKeys = [
  "duration",
  "delay",
  "hold",
  "landing",
  "landingBeat",
] as const;
export { settingsKinds };
export type SettingsKind = (typeof settingsKinds)[number];
export const settingsAffectTiming = (kind: SettingsKind) =>
  kind === "timing" ||
  kind === "effects" ||
  kind === "after-effect" ||
  kind === "everything";
const sizeFields = ["scale", "sizeProfile", "sizeReturn", "peak"] as const;
const visualKeys = ["capture", "highlight", "badge", "jam", "light"] as const;
export type SettingsClipboard = {
  kind: SettingsKind;
  source: Effect;
  format: Format;
};
export function preserveLockedTiming(before: Effect, after: Effect) {
  if (!before.locked) return;
  after.jam.enabled = before.jam.enabled;
  after.jam.duration = before.jam.duration;
  after.jam.start = before.jam.start;
  after.after.kind = before.after.kind;
  after.after.delay = before.after.delay;
  after.after.duration = before.after.duration;
  for (const key of timingKeys)
    (after as any)[key] = structuredClone(before[key]);
  const lockedLead = moveLead(before);
  if (moveLead(after) > lockedLead)
    after.preMoveMeme = structuredClone(before.preMoveMeme);
  if (moveLead(after) < lockedLead) after.delay = lockedLead;
}
export function pasteSettings(
  target: Effect,
  clip: SettingsClipboard,
  targetFormat: Format = clip.format,
): Effect {
  const source = effectSchema.parse(clip.source),
    next = structuredClone(target);
  for (const key of Object.keys(source) as (keyof Effect)[]) {
    if (key === "locked" || key === "keys" || key === "cameras") continue;
    const timing = timingKeys.includes(key as any),
      size = sizeFields.includes(key as (typeof sizeFields)[number]),
      visual = visualKeys.includes(key as any);
    if (
      clip.kind === "everything" ||
      (clip.kind === "timing" && timing) ||
      (clip.kind === "effects" && visual) ||
      (clip.kind === "after-effect" && key === "after") ||
      (clip.kind === "size" && size) ||
      (clip.kind === "movement" &&
        !timing &&
        !visual &&
        !size &&
        key !== "after" &&
        key !== "preMoveMeme")
    )
      (next as any)[key] = structuredClone(source[key]);
  }
  if (clip.kind === "size") next.capture.grow = source.capture.grow;
  if (clip.kind === "effects") next.capture.grow = target.capture.grow;
  if (clip.kind === "everything")
    next.cameras = structuredClone(source.cameras);
  if (clip.kind === "camera") {
    if (source.cameras[clip.format])
      next.cameras[targetFormat] = structuredClone(source.cameras[clip.format]);
    else delete next.cameras[targetFormat];
  }
  for (const key of new Set([
    ...Object.keys(target.keys),
    ...Object.keys(source.keys),
  ])) {
    const kind = key.startsWith("camera")
      ? "camera"
      : key === "opacity"
        ? "effects"
        : key === "scale"
          ? "size"
          : "movement";
    if (clip.kind === "everything" || clip.kind === kind) {
      delete (next.keys as any)[key];
      if ((source.keys as any)[key])
        (next.keys as any)[key] = structuredClone((source.keys as any)[key]);
    }
  }
  preserveLockedTiming(target, next);
  return effectSchema.parse(next);
}
/** Apply the same scoped change in the browser, inspector and preview. */
export function applyPresetEffect(
  target: Effect,
  source: Effect,
  format: Format,
  replaceAll = false,
  kind: SettingsKind = "movement",
  preserveKeys = true,
  includePresetSize = true,
) {
  const next = pasteSettings(target, {
    source,
    format,
    kind: replaceAll ? "everything" : kind,
  });
  if (!replaceAll && kind === "movement" && includePresetSize) {
    const size = effectSchema.parse(source);
    next.scale = size.scale;
    next.sizeProfile = size.sizeProfile;
    next.sizeReturn = size.sizeReturn;
    next.peak = size.peak;
    next.capture.grow = size.capture.grow;
    if (size.keys.scale?.length)
      next.keys.scale = structuredClone(size.keys.scale);
    else delete next.keys.scale;
  }
  if (!replaceAll && preserveKeys)
    next.keys = { ...next.keys, ...structuredClone(target.keys) };
  if (replaceAll && !target.locked) next.landingBeat = null;
  return next;
}

const groupCache = new WeakMap<Project, Record<string, string[]>>();
export function moveGroups(p: Project): Record<string, string[]> {
  const cached = groupCache.get(p);
  if (cached) return cached;
  const groups: Record<string, string[]> = {
    "All moves": [],
    "Pawn moves": [],
    "Knight moves": [],
    "Bishop moves": [],
    "Rook moves": [],
    "Queen moves": [],
    "King moves": [],
    Captures: [],
    Checks: [],
    Checkmates: [],
    Promotions: [],
    Castling: [],
  };
  const names: Record<string, string> = {
    p: "Pawn moves",
    n: "Knight moves",
    b: "Bishop moves",
    r: "Rook moves",
    q: "Queen moves",
    k: "King moves",
  };
  const chess = new Chess(p.fen);
  for (const m of p.moves) {
    const result = chess.move(m.san);
    groups["All moves"].push(m.id);
    groups[names[result.piece]].push(m.id);
    if (result.captured) groups.Captures.push(m.id);
    if (chess.isCheck()) groups.Checks.push(m.id);
    if (chess.isCheckmate()) groups.Checkmates.push(m.id);
    if (result.promotion) groups.Promotions.push(m.id);
    if (result.flags.includes("k") || result.flags.includes("q"))
      groups.Castling.push(m.id);
  }
  groupCache.set(p, groups);
  return groups;
}
