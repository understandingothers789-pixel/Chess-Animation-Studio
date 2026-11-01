import * as T from "three";
import type { Project } from "../../core/project";
export function cycleColor(
  base: string,
  rainbow: Project["pulse"]["rainbow"],
  time: number,
) {
  const colors = rainbow.colors.filter((_, i) => rainbow.active[i]);
  if (!rainbow.enabled || !colors.length) return new T.Color(base);
  const pos = ((((time / rainbow.duration) % 1) + 1) % 1) * colors.length;
  const i = Math.floor(pos),
    t = pos - i,
    smooth = t * t * (3 - 2 * t);
  return new T.Color(colors[i]).lerp(
    new T.Color(colors[(i + 1) % colors.length]),
    smooth,
  );
}
