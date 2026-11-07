import type { Project } from "../project";
import { automationPoints, musicAt, musicEnd, musicVolumeAt } from "../audio";
export function soundtrackWindow(p: Project, outputEnd: number) {
  return {
    start: Math.max(0, p.music.offset),
    end: Math.max(
      0,
      Math.min(
        outputEnd,
        p.music.offset +
          musicEnd(p, p.music.sourceDuration, outputEnd) -
          p.music.trimStart,
      ),
    ),
  };
}
export function soundtrackGain(p: Project, time: number, outputEnd: number) {
  const source = musicAt(p, time),
    end = musicEnd(p, p.music.sourceDuration, outputEnd),
    elapsed = time - p.music.offset;
  if (
    p.music.muted ||
    elapsed < 0 ||
    source < p.music.trimStart ||
    source >= end
  )
    return 0;
  return (
    musicVolumeAt(p, time) *
    Math.min(1, p.music.fadeIn ? elapsed / p.music.fadeIn : 1) *
    Math.min(1, p.music.fadeOut ? (end - source) / p.music.fadeOut : 1)
  );
}
export function snapTime(
  time: number,
  targets: number[],
  threshold: number,
  bypass = false,
) {
  if (bypass) return time;
  const nearest = targets.reduce(
    (best, t) => (Math.abs(t - time) < Math.abs(best - time) ? t : best),
    Infinity,
  );
  return Math.abs(nearest - time) <= threshold ? nearest : time;
}
/** Aggregate the existing analysis envelope without decoding again. */
export function waveformBins(
  peaks: number[],
  sourceDuration: number,
  start: number,
  end: number,
  count: number,
) {
  if (!peaks.length || sourceDuration <= 0 || count <= 0) return [];
  count = Math.min(2000, Math.floor(count));
  return Array.from({ length: Math.min(2000, Math.floor(count)) }, (_, i) => {
    const a = Math.max(
        0,
        Math.floor(
          ((start + ((end - start) * i) / count) / sourceDuration) *
            peaks.length,
        ),
      ),
      b = Math.min(
        peaks.length,
        Math.max(
          a + 1,
          Math.ceil(
            ((start + ((end - start) * (i + 1)) / count) / sourceDuration) *
              peaks.length,
          ),
        ),
      );
    let value = 0;
    for (let j = a; j < b; j++) value = Math.max(value, peaks[j]);
    return value;
  });
}

/** FFmpeg evaluates this at time t after source trim; origin maps t back to output. */
export function soundtrackGainExpression(
  p: Project,
  start: number,
  end: number,
  trim: number,
) {
  const points = automationPoints(p);
  const origin = Math.max(start, p.music.offset);
  let expr = String(p.music.volume);
  if (points.length) {
    expr = String(points[points.length - 1].value);
    for (let i = points.length - 2; i >= 0; i--) {
      const a = points[i],
        b = points[i + 1];
      if (b.time === a.time) continue;
      expr = `if(lt(t+${origin},${b.time}),${a.value}+(${b.value}-${a.value})*(t+${origin}-${a.time})/${b.time - a.time},${expr})`;
    }
    expr = `if(lt(t+${origin},${points[0].time}),${points[0].value},${expr})`;
  }
  const fadeIn = p.music.fadeIn
    ? `min(1,max(0,(t+${origin - p.music.offset})/${p.music.fadeIn}))`
    : "1";
  const fadeOut = p.music.fadeOut
    ? `min(1,max(0,(${end - trim}-t)/${p.music.fadeOut}))`
    : "1";
  return `(${expr})*(${fadeIn})*(${fadeOut})`;
}
export function normalizeMusicRange(m: Project["music"]) {
  if (m.sourceDuration <= 0) return;
  m.trimStart = Math.max(0, Math.min(m.sourceDuration - 0.001, m.trimStart));
  if (m.trimEnd)
    m.trimEnd = Math.max(
      m.trimStart + 0.001,
      Math.min(m.sourceDuration, m.trimEnd),
    );
}
