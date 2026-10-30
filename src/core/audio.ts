import { duration, segments, clamp } from "./timeline";
import { uid, type Project, type Beat } from "./model";

export function analyzePcm(
  samples: Float32Array,
  sampleRate: number,
): { waveform: number[]; beats: Beat[] } {
  const points = Math.min(
    1800,
    Math.max(1, Math.ceil((samples.length / sampleRate) * 30)),
  );
  const waveform = Array.from({ length: points }, (_, i) => {
    const start = Math.floor((i * samples.length) / points),
      end = Math.floor(((i + 1) * samples.length) / points);
    let peak = 0;
    for (let j = start; j < end; j++)
      peak = Math.max(peak, Math.abs(samples[j]));
    return clamp(peak);
  });
  const hop = Math.round(sampleRate * 0.01),
    window = Math.round(sampleRate * 0.025),
    energies: number[] = [];
  for (let i = 0; i < samples.length; i += hop) {
    let energy = 0;
    for (let j = i; j < Math.min(i + window, samples.length); j++)
      energy += samples[j] ** 2;
    energies.push(Math.sqrt(energy / window));
  }
  const flux = energies.map((v, i) => Math.max(0, v - (energies[i - 1] ?? v)));
  const beats: Beat[] = [];
  let last = -1;
  const sorted = [...flux].sort((a, b) => a - b),
    strong = sorted[Math.floor(sorted.length * 0.96)] ?? 1;
  for (let i = 2; i < flux.length - 2; i++) {
    const mean =
      flux.slice(Math.max(0, i - 40), i + 1).reduce((a, b) => a + b, 0) /
      Math.min(41, i + 1);
    const time = (i * hop) / sampleRate;
    if (
      time - last > 0.24 &&
      flux[i] > 0.006 &&
      flux[i] > mean * 2 &&
      flux[i] >= flux[i - 1] &&
      flux[i] > flux[i + 1]
    ) {
      beats.push({
        id: uid(),
        time,
        strong: flux[i] >= strong,
        selected: true,
      });
      last = time;
    }
  }
  return { waveform, beats };
}
export function alignLandings(
  p: Project,
  selection: "all" | "second" | "fourth" | "selected",
  min = 0.45,
  max = 4,
): { project: Project; changed: number; skipped: number } {
  const beats = p.beats
    .filter(
      (b, i) =>
        selection === "all" ||
        (selection === "second" && i % 2 === 0) ||
        (selection === "fourth" && i % 4 === 0) ||
        (selection === "selected" && b.selected),
    )
    .sort((a, b) => a.time - b.time);
  const next = structuredClone(p);
  let changed = 0,
    skipped = 0;
  for (let i = 0; i < next.moves.length; i++) {
    const e = next.moves[i].effect;
    if (e.locked) continue;
    const s = segments(next)[i],
      target = beats.find(
        (b) =>
          b.time >= s.start + min * e.landing &&
          b.time <= s.start + max * e.landing + 2,
      );
    if (!target) {
      skipped++;
      continue;
    }
    e.duration = clamp((target.time - s.start) / e.landing, min, max);
    e.delay = Math.max(0, target.time - s.start - e.duration * e.landing);
    e.landingBeat = target.id;
    changed++;
  }
  return { project: next, changed, skipped };
}
export function musicTime(p: Project, time: number): number | null {
  if (!p.music || p.music.muted) return null;
  const m = p.music,
    t = time - m.offset + m.trimStart;
  return t >= m.trimStart && t < Math.min(m.trimEnd, m.duration) ? t : null;
}
export function musicGain(p: Project, time: number): number {
  if (!p.music || musicTime(p, time) === null) return 0;
  const m = p.music,
    end = Math.min(m.offset + m.trimEnd - m.trimStart, duration(p));
  return (
    m.volume *
    clamp((time - m.offset) / Math.max(0.001, m.fadeIn)) *
    clamp((end - time) / Math.max(0.001, m.fadeOut))
  );
}
/** Refit explicit beat bindings in legal sequence after a marker/music edit.
 * An impossible early anchor is released, rather than reordering legal moves.
 */
export function syncBeatAnchors(p: Project): number {
  let released = 0;
  for (let i = 0; i < p.moves.length; i++) {
    const e = p.moves[i].effect;
    if (!e.landingBeat) continue;
    const b = p.beats.find((b) => b.id === e.landingBeat),
      s = segments(p)[i];
    if (
      !b ||
      b.time - s.start < 0.15 * e.landing ||
      b.time - s.start > 30 + 8 * e.landing
    ) {
      e.landingBeat = null;
      released++;
      continue;
    }
    e.duration = clamp((b.time - s.start) / e.landing, 0.15, 8);
    e.delay = Math.max(0, b.time - s.start - e.duration * e.landing);
  }
  return released;
}
export function correctBeat(p: Project, id: string, time: number) {
  const b = p.beats.find((b) => b.id === id);
  if (!b) return;
  b.time = clamp(time, 0, 86400);
  if (b.sourceTime !== undefined && p.music && b.assetId === p.music.assetId)
    b.sourceTime = Math.max(0, b.time - p.music.offset + p.music.trimStart);
  p.beats.sort((a, b) => a.time - b.time);
  return syncBeatAnchors(p);
}
