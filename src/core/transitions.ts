import type { Project } from "./project";
import { compileStoryboard } from "./storyboard";
/** Incoming transitions consume the beginning of the destination shot without
 * changing output duration. The previous shot is sampled at its final instant.
 * No recursive transitions or chess-position interpolation is involved. */
export function transitionAt(p: Project, time: number) {
  const c = compileStoryboard(p),
    i = c.shots.findIndex((s) => time >= s.start && time < s.end);
  if (i <= 0) return null;
  const entry = c.shots[i],
    t = entry.shot.transition;
  const duration = Math.min(t.duration, entry.shot.duration);
  if (t.type === "cut" || duration <= 0 || time >= entry.start + duration)
    return null;
  const linear = Math.max(0, Math.min(1, (time - entry.start) / duration));
  const progress =
    t.easing === "smooth" ? linear * linear * (3 - 2 * linear) : linear;
  return {
    type: t.type,
    progress,
    previousTime: Math.max(0, entry.start - 1e-7),
    outgoing:
      t.type === "cross-dissolve"
        ? 1 - progress
        : Math.max(0, 1 - progress * 2),
    incoming:
      t.type === "cross-dissolve" ? progress : Math.max(0, progress * 2 - 1),
  };
}
