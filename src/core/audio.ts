import { segments } from "./timeline";
import { uid, type Project } from "./project";
export function analyze(samples: Float32Array, sampleRate: number) {
  const hop = Math.max(1, Math.round(sampleRate * 0.012)),
    energy: number[] = [];
  for (let i = 0; i < samples.length; i += hop) {
    let e = 0;
    for (let j = i; j < Math.min(i + hop, samples.length); j++)
      e += samples[j] * samples[j];
    energy.push(Math.sqrt(e / hop));
  }
  const wave = Array.from({ length: Math.min(1600, energy.length) }, (_, i) =>
    Math.max(
      ...energy.slice(
        Math.floor((i * energy.length) / Math.min(1600, energy.length)),
        Math.floor(((i + 1) * energy.length) / Math.min(1600, energy.length)) +
          1,
      ),
    ),
  );
  const max = Math.max(0.001, ...wave);
  const peaks: { time: number; accent: boolean }[] = [];
  for (let i = 2; i < energy.length - 2; i++) {
    const baseline =
      energy.slice(Math.max(0, i - 25), i).reduce((a, b) => a + b, 0) /
      Math.min(i, 25);
    if (
      energy[i] > baseline * 1.55 &&
      energy[i] > max * 0.16 &&
      energy[i] >= energy[i - 1] &&
      energy[i] > energy[i + 1] &&
      (!peaks.length || (i * hop) / sampleRate - peaks.at(-1)!.time > 0.22)
    )
      peaks.push({
        time: (i * hop) / sampleRate,
        accent: energy[i] > max * 0.55,
      });
  }
  return { waveform: wave.map((x) => Math.min(1, x / max)), peaks };
}
export function musicAt(p: Project, time: number) {
  return p.music.trimStart + time - p.music.offset;
}
export function musicVolumeAt(p: Project, time: number) {
  const points = [...p.music.volumePoints].sort((a, b) => a.time - b.time);
  if (!points.length) return p.music.volume;
  if (time <= points[0].time) return points[0].value;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (time <= b.time)
      return (
        a.value + ((b.value - a.value) * (time - a.time)) / (b.time - a.time)
      );
  }
  return points[points.length - 1].value;
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
  mode: "all" | "alternate" | "fourth" | "accents" = "all",
  min = 0.5,
  max = 5,
): { project: Project; aligned: number; skipped: number } {
  const next = structuredClone(p),
    beats = p.beats
      .filter((b) => b.enabled && (mode !== "accents" || b.accent))
      .filter((_, i) =>
        mode === "alternate"
          ? i % 2 === 0
          : mode === "fourth"
            ? i % 4 === 0
            : true,
      )
      .sort((a, b) => a.time - b.time);
  let aligned = 0,
    skipped = 0;
  for (let i = 0; i < next.moves.length; i++) {
    const e = next.moves[i].effect;
    if (e.locked) {
      skipped++;
      continue;
    }
    const seg = segments(next)[i];
    const wanted = e.landingBeat
      ? beats.find((b) => b.id === e.landingBeat)
      : undefined;
    const candidates = wanted ? [wanted] : beats;
    const b = candidates
      .filter((b) => {
        const d = (b.time - seg.depart) / e.landing;
        return d >= min && d <= max;
      })
      .sort(
        (a, b) => Math.abs(a.time - seg.land) - Math.abs(b.time - seg.land),
      )[0];
    if (!b) {
      e.landingBeat = null;
      skipped++;
      continue;
    }
    e.duration = (b.time - seg.depart) / e.landing;
    e.landingBeat = b.id;
    aligned++;
  }
  return { project: next, aligned, skipped };
}
export function detectedMarkers(
  p: Project,
  peaks: { time: number; accent: boolean }[],
) {
  return peaks
    .filter(
      (b) =>
        b.time >= p.music.trimStart &&
        (!p.music.trimEnd || b.time <= p.music.trimEnd),
    )
    .map((b) => ({
      id: uid(),
      time: Math.max(0, b.time - p.music.trimStart + p.music.offset),
      sourceTime: b.time,
      accent: b.accent,
      enabled: true,
    }));
}
