import {
  storyboardDuckEnvelope,
  storyboardDuckGain,
} from "../core/audio/ducking";
import { audioEvents } from "../core/audioEvents";
import { presentationDuration } from "../core/storyboard";
import {
  automationPoints,
  musicAt,
  musicVolumeAt,
  musicEnd,
} from "../core/audio";
import type { Project, PlaybackMode } from "../core/project";
export class AudioPlayer {
  context = new AudioContext();
  buffers = new Map<string, AudioBuffer>();
  private sources = new Set<AudioScheduledSourceNode>();
  private lastMusicGain: number | null = null;
  private volumePoints?: Project["music"]["volumePoints"];
  private orderedVolume = [] as ReturnType<typeof automationPoints>;
  private playbackRequest = 0;
  private loads = new Map<string, object>();
  musicGain: GainNode | null = null;
  async load(id: string, url: string) {
    const request = {};
    this.loads.set(id, request);
    try {
      const response = await fetch(url);
      if (!response.ok) throw Error("Could not load audio.");
      const bytes = await response.arrayBuffer();
      if (this.loads.get(id) !== request) return null;
      const buffer = await this.context.decodeAudioData(bytes);
      if (this.loads.get(id) !== request) return null;
      this.buffers.set(id, buffer);
      return buffer;
    } catch (error) {
      if (this.loads.get(id) !== request) return null;
      throw error;
    } finally {
      if (this.loads.get(id) === request) this.loads.delete(id);
    }
  }
  clear(id: string) {
    // Clearing an unavailable asset must not stop other playing sources.
    this.loads.delete(id);
    this.buffers.delete(id);
  }
  private track(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.onended = () => this.sources.delete(source);
  }
  async play(
    p: Project,
    time: number,
    mode: PlaybackMode = "source",
    rate = 1,
  ) {
    this.stop();
    const request = this.playbackRequest;
    await this.context.resume();
    if (request !== this.playbackRequest) return null;
    if (p.audio.knightHorse && !this.buffers.has("__knightHorse")) {
      await this.load(
        "__knightHorse",
        new URL("sounds/horse.oga", document.baseURI).href,
      );
    }
    if (request !== this.playbackRequest) return null;
    const outputEnd = presentationDuration(p, mode);
    const origin = this.context.currentTime + 0.09;
    const perf = performance.now() + 90;
    const m = p.music,
      b = this.buffers.get(m.asset ?? "");
    if (b) {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = b;
      if (source.playbackRate) source.playbackRate.value = rate;
      const master = this.context.createGain(),
        fadeOutGain = this.context.createGain();
      const duck = this.context.createGain();
      master.gain.value = m.muted
        ? 0
        : musicVolumeAt(p, Math.max(time, m.offset));
      source
        .connect(gain)
        .connect(fadeOutGain)
        .connect(master)
        .connect(duck)
        .connect(this.context.destination);
      const offset = musicAt(p, time),
        start = origin + Math.max(0, -(time - m.offset)) / rate,
        trimEnd = musicEnd(p, b.duration, outputEnd),
        sourceStart = Math.max(m.trimStart, offset),
        length = Math.min(trimEnd, b.duration) - sourceStart;
      if (length > 0) {
        const outputStart = Math.max(time, m.offset);
        duck.gain.setValueAtTime(
          mode === "storyboard" ? storyboardDuckGain(p, outputStart) : 1,
          start,
        );
        if (mode === "storyboard")
          for (const point of storyboardDuckEnvelope(p))
            if (point.time > outputStart && point.time <= outputEnd)
              duck.gain.linearRampToValueAtTime(
                point.value,
                start + (point.time - outputStart) / rate,
              );
        // If output ends in a ramp, schedule its interpolated endpoint too.
        if (mode === "storyboard")
          duck.gain.linearRampToValueAtTime(
            storyboardDuckGain(p, outputEnd),
            start + (outputEnd - outputStart) / rate,
          );

        const elapsed = Math.max(0, time - m.offset);
        gain.gain.setValueAtTime(
          m.fadeIn ? Math.min(1, elapsed / m.fadeIn) : 1,
          start,
        );
        if (m.fadeIn > elapsed)
          gain.gain.linearRampToValueAtTime(
            1,
            start + (m.fadeIn - elapsed) / rate,
          );
        fadeOutGain.gain.setValueAtTime(
          m.fadeOut ? Math.min(1, length / m.fadeOut) : 1,
          start,
        );
        if (m.fadeOut && length > m.fadeOut)
          fadeOutGain.gain.setValueAtTime(
            1,
            start + (length - m.fadeOut) / rate,
          );
        if (m.fadeOut)
          fadeOutGain.gain.linearRampToValueAtTime(0, start + length / rate);
        source.start(start, sourceStart, length);
        this.track(source);
        this.musicGain = master;
        this.lastMusicGain = master.gain.value;
      }
    }
    const events = audioEvents(p, mode);
    for (const cue of events) {
      const duration = Math.min(
        cue.duration ?? Infinity,
        cue.end - cue.at + cue.offset,
      );
      const offset = cue.offset + Math.max(0, time - cue.at);
      if (cue.end <= time || offset >= duration) continue;
      const at = origin + Math.max(0, cue.at - time) / rate,
        volume = cue.volume * p.audio[cue.bus],
        buffer = this.buffers.get(cue.asset ?? "");
      if (volume <= 0) continue;
      if (buffer) {
        const s = this.context.createBufferSource(),
          g = this.context.createGain();
        s.buffer = buffer;
        if (s.playbackRate) s.playbackRate.value = rate;
        g.gain.value = volume;
        s.connect(g).connect(this.context.destination);
        const length = Math.min(
          buffer.duration - offset,
          duration - offset,
          outputEnd - Math.max(time, cue.at),
        );
        if (length <= 0) continue;
        s.start(at, offset, length);
        this.track(s);
      } else if (!cue.asset) {
        const osc = this.context.createOscillator(),
          g = this.context.createGain();
        osc.frequency.value = cue.kind === "capture" ? 130 : 240;
        g.gain.setValueAtTime(0.25 * volume, at);
        g.gain.exponentialRampToValueAtTime(
          0.0001,
          Math.max(
            at + 0.001,
            Math.min(
              at + (cue.kind === "capture" ? 0.16 : 0.075) / rate,
              origin + (cue.end - time) / rate,
            ),
          ),
        );
        osc.connect(g).connect(this.context.destination);
        osc.start(at);
        osc.stop(Math.min(at + 0.2 / rate, origin + (cue.end - time) / rate));
        this.track(osc);
      }
    }
    return perf;
  }
  updateMusic(p: Project, time: number) {
    if (!this.musicGain) return;
    if (p.music.volumePoints !== this.volumePoints) {
      this.volumePoints = p.music.volumePoints;
      this.orderedVolume = automationPoints(p);
    }
    const next = p.music.muted ? 0 : musicVolumeAt(p, time, this.orderedVolume);
    if (next === this.lastMusicGain) return;
    this.lastMusicGain = next;
    this.musicGain.gain.setTargetAtTime(next, this.context.currentTime, 0.01);
  }
  stop() {
    this.playbackRequest++;
    this.musicGain = null;
    this.lastMusicGain = null;
    for (const s of this.sources)
      try {
        s.stop();
      } catch {}
    this.sources.clear();
  }
  dispose() {
    this.stop();
    this.loads.clear();
    this.buffers.clear();
    void this.context.close();
  }
}
