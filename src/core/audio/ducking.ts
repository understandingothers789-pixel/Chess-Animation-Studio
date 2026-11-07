import type { Project } from "../project";
export type DuckPoint = { time: number; value: number };
const cache = new WeakMap<Project, DuckPoint[]>();
export function gainOnEnvelope(points: readonly DuckPoint[], time: number) {
  let lo = 0,
    hi = points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (points[mid].time <= time) lo = mid;
    else hi = mid - 1;
  }
  const a = points[lo],
    b = points[lo + 1];
  return !b || time <= a.time
    ? a.value
    : a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
}
/** Immutable project snapshots: output boundaries, never source move timestamps.
 * Each boundary retargets from the gain actually reached. Short shots interrupt
 * ramps continuously; adjacent ducks never recover to 1 between shots. */
export function storyboardDuckEnvelope(p: Project): DuckPoint[] {
  const saved = cache.get(p);
  if (saved) return saved;
  const points: DuckPoint[] = [{ time: 0, value: 1 }];
  let start = 0,
    previousUp = 0.4;
  const target = (at: number, level: number, seconds: number) => {
    const value = gainOnEnvelope(points, at);
    while (points.length > 1 && points.at(-1)!.time >= at) points.pop();
    if (points.at(-1)!.time === at) points.at(-1)!.value = value;
    else points.push({ time: at, value });
    if (Math.abs(value - level) > 1e-12)
      points.push({ time: at + seconds, value: level });
  };
  for (const shot of p.storyboard.shots) {
    const d = shot.musicDucking,
      level = d.enabled ? d.volume : 1,
      current = gainOnEnvelope(points, start);
    target(start, level, level < current ? d.fadeDown : previousUp);
    previousUp = d.fadeUp;
    start = Math.round((start + shot.duration) * 1e9) / 1e9;
  }
  if (p.storyboard.shots.length) target(start, 1, previousUp);
  cache.set(p, points);
  return points;
}
export function storyboardDuckGain(p: Project, time: number) {
  return gainOnEnvelope(storyboardDuckEnvelope(p), Math.max(0, time));
}
/** Same envelope as Web Audio; flat ramp sums avoid deeply nested expressions. */
export function storyboardDuckExpression(p: Project, clock: string) {
  const points = storyboardDuckEnvelope(p),
    terms = [String(points[0].value)];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      delta = b.value - a.value;
    if (Math.abs(delta) > 1e-12)
      terms.push(
        `(${delta})*min(1,max(0,((${clock})-${a.time})/${b.time - a.time}))`,
      );
  }
  return "(" + terms.join("+") + ")";
}
