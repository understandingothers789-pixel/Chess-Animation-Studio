import { uid, type Project } from "./project";
import type { MusicAnalysis } from "./musicAnalysis";

export type Beat = Project["beats"][number];

export function beatInMusic(p: Project, beat: Pick<Beat, "sourceTime">) {
  if (beat.sourceTime === undefined) return true;
  const { trimStart, trimEnd, offset, sourceDuration } = p.music;
  return (
    beat.sourceTime >= trimStart &&
    (!(trimEnd || sourceDuration) ||
      beat.sourceTime < (trimEnd || sourceDuration)) &&
    beat.sourceTime - trimStart + offset >= 0
  );
}

export function activeBeats(p: Project) {
  return p.beats.filter((beat) => beat.enabled && beatInMusic(p, beat));
}

export function beatStrength(b: { accent: boolean; strength?: number }) {
  return b.accent
    ? Math.max(0.8, b.strength ?? 1)
    : (b.strength ?? 0.35) * 0.72;
}

export function strongestBeat<
  T extends { accent: boolean; strength?: number; time: number },
>(candidates: T[], near: number) {
  return candidates.reduce<T | undefined>((best, beat) => {
    if (!best) return beat;
    const difference = beatStrength(beat) - beatStrength(best);
    return difference > 0 ||
      (difference === 0 &&
        Math.abs(beat.time - near) < Math.abs(best.time - near))
      ? beat
      : best;
  }, undefined);
}

export function setBeatTime(p: Project, beat: Beat, time: number) {
  const { trimStart, trimEnd, offset, sourceDuration } = p.music;
  const lower = beat.sourceTime === undefined ? 0 : Math.max(0, offset);
  const upper =
    beat.sourceTime === undefined
      ? 7200
      : Math.max(
          lower,
          Math.min(
            7200,
            (trimEnd || sourceDuration || 7200) - trimStart + offset - 0.000001,
          ),
        );
  beat.time = Math.min(upper, Math.max(lower, time));
  if (beat.sourceTime !== undefined)
    beat.sourceTime = Math.min(
      7200,
      Math.max(0, beat.time + trimStart - offset),
    );
  beat.corrected = true;
}

export function removeMusicBeat(p: Project, id: string) {
  const beat = p.beats.find((b) => b.id === id);
  const time = beat?.detectedAt ?? beat?.sourceTime;
  if (time !== undefined && p.ignoredMusicHits.length < 30000)
    p.ignoredMusicHits.push(time);
  p.beats = p.beats.filter((b) => b.id !== id);
}

export function updateMusicAnalysis(p: Project, analysis: MusicAnalysis) {
  p.waveform = analysis.waveform;
  p.waveformRms = analysis.waveformRms;
  if (p.beatsLocked) return;
  const linked = new Set(
    p.moves.flatMap((m) => [m.effect.landingBeat, m.effect.jam.beat]),
  );
  const saved = p.beats
    .filter((b) => b.sourceTime !== undefined)
    .map((beat) => ({ beat, anchor: beat.detectedAt ?? beat.sourceTime! }))
    .sort((a, b) => a.anchor - b.anchor);
  const ignore = [...p.ignoredMusicHits].sort((a, b) => a - b);
  let cursor = 0,
    ignored = 0;
  const matched = new Set<string>();
  const tolerance = 0.055;
  const next: Beat[] = [];
  for (const hit of analysis.peaks) {
    while (ignore[ignored] < hit.time - tolerance) ignored++;
    if (Math.abs(ignore[ignored] - hit.time) <= tolerance) continue;
    while (saved[cursor]?.anchor < hit.time - tolerance) cursor++;
    let found: (typeof saved)[number] | undefined;
    for (let i = cursor; saved[i]?.anchor <= hit.time + tolerance; i++) {
      const item = saved[i];
      if (matched.has(item.beat.id)) continue;
      if (
        !found ||
        Math.abs(item.anchor - hit.time) < Math.abs(found.anchor - hit.time)
      )
        found = item;
    }
    const prior = found?.beat;
    if (prior) matched.add(prior.id);
    const stable =
      prior && (prior.corrected || linked.has(prior.id) || !prior.enabled);
    const sourceTime = stable ? prior.sourceTime! : hit.time;
    next.push({
      id: prior?.id ?? uid(),
      time: Math.max(0, sourceTime - p.music.trimStart + p.music.offset),
      sourceTime,
      detectedAt: prior?.detectedAt ?? hit.time,
      enabled: prior?.enabled ?? true,
      accent: prior?.corrected ? prior.accent : hit.accent,
      strength: hit.strength,
      ...(prior?.corrected ? { corrected: true } : {}),
    });
  }
  const keep = p.beats.filter(
    (b) =>
      !matched.has(b.id) &&
      (b.sourceTime === undefined ||
        b.corrected ||
        linked.has(b.id) ||
        !b.enabled ||
        b.strength === undefined),
  );
  p.beats = [...keep, ...next.slice(0, Math.max(0, 30000 - keep.length))].sort(
    (a, b) => a.time - b.time,
  );
}

export function describeHit(beat: Pick<Beat, "accent" | "strength">) {
  return beat.accent
    ? "Strong hit"
    : beat.strength !== undefined
      ? "Detected hit"
      : "Beat marker";
}
