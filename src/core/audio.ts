import { firstMatchingIndex } from "./sorted";
import { activeBeats, beatStrength } from "./beatMarkers";
import { moveHold, moveLead } from "./timeline";
import { type Project } from "./project";
export { analyze } from "./musicAnalysis";
export function musicAt(p: Project, time: number) {
  return p.music.trimStart + time - p.music.offset;
}
export function automationPoints(p: Project) {
  // Last edit at a duplicate timestamp wins, identically in preview and FFmpeg.
  return [
    ...new Map(p.music.volumePoints.map((v) => [v.time, v])).values(),
  ].sort((a, b) => a.time - b.time);
}
export function musicVolumeAt(
  p: Project,
  time: number,
  points = automationPoints(p),
) {
  if (!points.length) return p.music.volume;
  const index = firstMatchingIndex(points, (point) => time <= point.time);
  if (index === 0) return points[0].value;
  if (index === points.length) return points[index - 1].value;
  const a = points[index - 1],
    b = points[index];
  return a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time);
}
/** Effective source endpoint when a continuous soundtrack is capped by output. */
export function musicEnd(
  p: Project,
  sourceLength: number,
  outputDuration: number,
) {
  return Math.min(
    p.music.trimEnd || sourceLength,
    sourceLength,
    p.music.trimStart + outputDuration - p.music.offset,
  );
}
export function gainAt(p: Project, time: number, length: number) {
  const local = time - p.music.offset,
    end = p.music.trimEnd || length,
    remain = end - musicAt(p, time);
  if (p.music.muted || local < 0 || remain <= 0) return 0;
  return (
    musicVolumeAt(p, time) *
    Math.min(
      1,
      p.music.fadeIn ? local / p.music.fadeIn : 1,
      p.music.fadeOut ? remain / p.music.fadeOut : 1,
    )
  );
}
export function syncMarkers(p: Project) {
  return {
    ...p,
    beats: p.beats.map((b) =>
      b.sourceTime === undefined
        ? b
        : {
            ...b,
            time: Math.max(
              0,
              b.sourceTime - p.music.trimStart + p.music.offset,
            ),
          },
    ),
  };
}
export function align(
  p: Project,
  mode: "all" | "alternate" | "fourth" | "accents" | "strong" = "all",
  min = 0.5,
  max = 5,
): { project: Project; aligned: number; skipped: number } {
  const next = structuredClone(p);
  const beats = activeBeats(p)
    .filter((b) => mode !== "accents" || b.accent)
    .sort((a, b) => a.time - b.time)
    .filter((_, i) =>
      mode === "alternate"
        ? i % 2 === 0
        : mode === "fourth"
          ? i % 4 === 0
          : true,
    );
  const byId = new Map(beats.map((b) => [b.id, b]));
  let aligned = 0,
    skipped = 0,
    at = p.lead;
  for (const { effect: e } of next.moves) {
    const depart = at + moveLead(e);
    if (!e.locked) {
      const land = depart + e.duration * e.landing;
      const lower = depart + min * e.landing;
      const upper = depart + max * e.landing;
      const wanted = e.landingBeat ? byId.get(e.landingBeat) : undefined;
      let beat =
        wanted && wanted.time >= lower && wanted.time <= upper
          ? wanted
          : undefined;
      if (!beat && !e.landingBeat) {
        let lo = 0,
          hi = beats.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (beats[mid].time < lower) lo = mid + 1;
          else hi = mid;
        }
        let best = Infinity;
        for (let i = lo; i < beats.length && beats[i].time <= upper; i++) {
          const candidate = beats[i];
          const score =
            Math.abs(candidate.time - land) -
            (mode === "strong" ? beatStrength(candidate) * 0.46 : 0);
          if (score < best) {
            beat = candidate;
            best = score;
          }
        }
      }
      if (beat) {
        e.duration = (beat.time - depart) / e.landing;
        e.landingBeat = beat.id;
        aligned++;
      } else skipped++;
    } else skipped++;
    at = depart + e.duration + moveHold(e);
  }
  return { project: next, aligned, skipped };
}
export function landingDuration(
  effect: Project["moves"][number]["effect"],
  departure: number,
  beatTime: number,
) {
  const requested = (beatTime - departure) / effect.landing;
  return requested >= 0.2 && requested <= 30 ? requested : null;
}
