import { audioEvents } from "../core/audioEvents";
import { presentationDuration } from "../core/storyboard";
import { musicAt, gainAt, musicVolumeAt } from "../core/audio";
import { segments } from "../core/timeline";
import { buildGame } from "../core/chess";
import type { Project, PlaybackMode } from "../core/project";
export class AudioPlayer {
  context = new AudioContext();
  buffers = new Map<string, AudioBuffer>();
  sources: AudioScheduledSourceNode[] = [];
  generation = 0;
  musicGain: GainNode | null = null;
  async load(id: string, url: string) {
    const generation = this.generation;
    const bytes = await (await fetch(url)).arrayBuffer();
    const buffer = await this.context.decodeAudioData(bytes);
    if (generation === this.generation) this.buffers.set(id, buffer);
    return buffer;
  }
  clear(id: string) {
    // Removing one unavailable asset must not stop every scheduled source.
    // Asset health checks can clear an unrelated, unused audio asset while
    // the selected music is playing.
    this.buffers.delete(id);
  }
  async play(p: Project, time: number, mode: PlaybackMode = "source") {
    const outputEnd = presentationDuration(p, mode);
    this.stop();
    await this.context.resume();
    if (p.audio.knightHorse && !this.buffers.has("__knightHorse")) {
      await this.load(
        "__knightHorse",
        new URL("sounds/horse.oga", document.baseURI).href,
      );
    }
    const origin = this.context.currentTime + 0.09;
    const perf = performance.now() + 90;
    const m = p.music,
      b = this.buffers.get(m.asset ?? "");
    if (b) {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = b;
      const master = this.context.createGain();
      this.musicGain = master;
      master.gain.value = m.muted ? 0 : m.volume;
      source.connect(gain).connect(master).connect(this.context.destination);
      const offset = musicAt(p, time),
        start = origin + Math.max(0, -(time - m.offset)),
        trimEnd = Math.min(
          m.trimEnd || b.duration,
          m.trimStart + outputEnd - m.offset,
        ),
        sourceStart = Math.max(m.trimStart, offset),
        length = Math.min(trimEnd, b.duration) - sourceStart;
      if (length > 0) {
        const elapsed = Math.max(0, time - m.offset);
        gain.gain.setValueAtTime(
          gainAt(
            {
              ...p,
              music: { ...m, volume: 1, volumePoints: [], muted: false },
            },
            Math.max(time, m.offset),
            b.duration,
          ),
          start,
        );
        if (m.fadeIn > elapsed)
          gain.gain.linearRampToValueAtTime(1, start + m.fadeIn - elapsed);
        const fadeStart = Math.max(start, start + length - m.fadeOut);
        gain.gain.setValueAtTime(
          Math.min(
            1,
            gainAt(
              {
                ...p,
                music: { ...m, volume: 1, volumePoints: [], muted: false },
              },
              m.offset + Math.max(0, trimEnd - m.trimStart - m.fadeOut),
              b.duration,
            ),
          ),
          fadeStart,
        );
        gain.gain.linearRampToValueAtTime(0, start + length);
        source.start(start, sourceStart, length);
        this.sources.push(source);
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
      const at = origin + Math.max(0, cue.at - time),
        volume = cue.volume * p.audio[cue.bus],
        buffer = this.buffers.get(cue.asset ?? "");
      if (buffer) {
        const s = this.context.createBufferSource(),
          g = this.context.createGain();
        s.buffer = buffer;
        g.gain.value = volume;
        s.connect(g).connect(this.context.destination);
        const length = Math.min(
          buffer.duration - offset,
          duration - offset,
          outputEnd - Math.max(time, cue.at),
        );
        if (length <= 0) continue;
        s.start(at, offset, length);
        this.sources.push(s);
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
              at + (cue.kind === "capture" ? 0.16 : 0.075),
              origin + cue.end - time,
            ),
          ),
        );
        osc.connect(g).connect(this.context.destination);
        osc.start(at);
        osc.stop(Math.min(at + 0.2, origin + cue.end - time));
        this.sources.push(osc);
      }
    }
    return perf;
  }
  updateMusic(p: Project, time: number) {
    this.musicGain?.gain.setTargetAtTime(
      p.music.muted ? 0 : musicVolumeAt(p, time),
      this.context.currentTime,
      0.01,
    );
  }
  stop() {
    this.musicGain = null;
    for (const s of this.sources)
      try {
        s.stop();
      } catch {}
    this.sources = [];
  }
  dispose() {
    this.stop();
    this.generation++;
    void this.context.close();
  }
}
