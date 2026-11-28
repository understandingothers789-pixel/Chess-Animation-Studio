import { activeBeats, outputBeats } from "./beatMarkers";
import type { PlaybackMode, Project } from "./project";
import { firstMatchingIndex } from "./sorted";

type PulseMarker = Project["storyboard"]["beats"][number];
export type PulseSensitivity = NonNullable<Project["pulse"]["sensitivity"]>;
export type PulseOverride = NonNullable<PulseMarker["pulseOverride"]> | "auto";

export function pulseSensitivity(p: Project): PulseSensitivity {
  return p.pulse.sensitivity ?? (p.pulse.accentsOnly ? "accents" : "lenient");
}

export function setPulseOverride(
  p: Project,
  mode: PlaybackMode,
  id: string,
  value: PulseOverride,
) {
  const markers = mode === "storyboard" ? p.storyboard.beats : p.beats;
  const marker = markers.find((beat) => beat.id === id);
  if (!marker) return;
  if (value === "auto") delete marker.pulseOverride;
  else marker.pulseOverride = value;
}

export function selectBoardPulses(p: Project, mode: PlaybackMode) {
  const markers =
    mode === "storyboard"
      ? outputBeats(p).filter((beat) => beat.enabled)
      : activeBeats(p);
  const sensitivity = pulseSensitivity(p);
  const selected: PulseMarker[] = [];
  const strictCandidates: PulseMarker[] = [];
  for (const beat of markers) {
    if (beat.pulseOverride === "off") continue;
    if (beat.pulseOverride === "on") {
      selected.push(beat);
      continue;
    }
    if (
      sensitivity === "lenient" ||
      (sensitivity === "balanced" &&
        (beat.accent || (beat.strength ?? 1) >= 0.55)) ||
      (sensitivity === "accents" && beat.accent)
    ) {
      selected.push(beat);
    } else if (
      sensitivity === "strict" &&
      beat.accent &&
      (beat.strength ?? 1) >= 0.9
    ) {
      strictCandidates.push(beat);
    }
  }
  if (strictCandidates.length) {
    // Give the hardest hit first choice of each 400 ms window.
    const spacing = 0.4;
    const occupied = new Map<number, number>();
    strictCandidates.sort(
      (a, b) => (b.strength ?? 1) - (a.strength ?? 1) || a.time - b.time,
    );
    for (const beat of strictCandidates) {
      const bucket = Math.floor(beat.time / spacing);
      const previous = occupied.get(bucket - 1) ?? -Infinity;
      const next = occupied.get(bucket + 1) ?? Infinity;
      if (
        occupied.has(bucket) ||
        beat.time - previous < spacing ||
        next - beat.time < spacing
      )
        continue;
      occupied.set(bucket, beat.time);
      selected.push(beat);
    }
  }
  return selected.sort((a, b) => a.time - b.time);
}

const compiledPulses = {
  source: new WeakMap<Project, PulseMarker[]>(),
  storyboard: new WeakMap<Project, PulseMarker[]>(),
};

/** Render callers can cache the pulse index for their immutable project. */
export function boardPulseAt(
  p: Project,
  time: number,
  mode: PlaybackMode,
  compiled = false,
) {
  const { enabled, intensity, attack, decay } = p.pulse;
  if (!enabled || intensity === 0) return 0;
  const cache = compiledPulses[mode];
  let pulses = compiled ? cache.get(p) : undefined;
  if (!pulses) {
    pulses = selectBoardPulses(p, mode);
    if (compiled) cache.set(p, pulses);
  }
  let value = 0;
  const first = firstMatchingIndex(pulses, (beat) => time - beat.time <= decay);
  for (let i = first; i < pulses.length; i++) {
    const age = time - pulses[i].time;
    if (age < -attack) break;
    value = Math.max(
      value,
      age < 0 ? 1 + age / attack : Math.exp((-age / decay) * 4),
    );
  }
  return value * intensity;
}
