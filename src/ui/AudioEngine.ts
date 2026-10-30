import { type Project, type Asset } from "../core/model";
import { duration, segments } from "../core/timeline";
import { buildGame } from "../core/chess";
import { musicGain, musicTime } from "../core/audio";

export class AudioEngine {
  readonly context = new AudioContext();
  buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  async load(asset: Asset, data: string) {
    const bytes = await (await fetch(data)).arrayBuffer();
    const buffer = await this.context.decodeAudioData(bytes);
    this.buffers.set(asset.id, buffer);
    return buffer;
  }
  remove(id: string) {
    this.buffers.delete(id);
  }
  stop() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources = [];
  }
  async play(p: Project, time: number) {
    this.stop();
    await this.context.resume();
    const base = this.context.currentTime + 0.03,
      performanceOrigin = performance.now() + 30;
    const cue = (
      buffer: AudioBuffer,
      when: number,
      offset: number,
      gain: number,
      automation?: { start: number; end: number },
    ) => {
      if (offset >= buffer.duration || when >= duration(p) - time) return;
      const source = this.context.createBufferSource(),
        amp = this.context.createGain();
      source.buffer = buffer;
      source.connect(amp);
      amp.connect(this.context.destination);
      amp.gain.value = gain;
      if (automation && p.music) {
        const m = p.music,
          finish = Math.min(duration(p), m.offset + m.trimEnd - m.trimStart),
          samples = Math.max(
            2,
            Math.ceil((finish - Math.max(time, m.offset)) * 60),
          );
        const values = new Float32Array(samples);
        for (let i = 0; i < samples; i++)
          values[i] = musicGain(
            p,
            Math.max(time, m.offset) +
              (i / (samples - 1)) * (finish - Math.max(time, m.offset)),
          );
        amp.gain.setValueCurveAtTime(
          values,
          base + when,
          Math.max(0.001, finish - Math.max(time, m.offset)),
        );
      }
      source.start(
        base + when,
        Math.max(0, offset),
        Math.min(
          buffer.duration - offset,
          duration(p) - time - when,
          automation ? automation.end - automation.start : Infinity,
        ),
      );
      this.sources.push(source);
    };
    if (p.music && !p.music.muted) {
      const m = p.music,
        b = this.buffers.get(m.assetId),
        begin = Math.max(time, m.offset),
        at = musicTime(p, begin);
      if (b && at !== null)
        cue(b, begin - time, at, m.volume, {
          start: at,
          end: Math.min(m.trimEnd, m.duration),
        });
    }
    const segs = segments(p),
      game = buildGame(p);
    if (p.sound.enabled)
      for (const s of segs) {
        if (s.landing < time) continue;
        const capture = !!game.steps[s.index].captureId;
        cue(
          this.synth(capture),
          s.landing - time,
          0,
          capture ? p.sound.dramatic : p.sound.chess,
        );
      }
    for (const c of p.cues) {
      const b = this.buffers.get(c.assetId),
        s = c.moveId
          ? segs.find((s) => p.moves[s.index].id === c.moveId)
          : null;
      if (c.moveId && !s) continue;
      const at = (s?.landing ?? 0) + c.time;
      if (b && at + b.duration > time)
        cue(
          b,
          Math.max(0, at - time),
          Math.max(0, time - at),
          c.volume * p.sound[c.bus],
        );
    }
    return performanceOrigin;
  }
  private synth(capture: boolean) {
    const key = capture ? "__capture" : "__move";
    let b = this.buffers.get(key);
    if (b) return b;
    const rate = 48000,
      length = Math.round(rate * (capture ? 0.32 : 0.12));
    b = this.context.createBuffer(1, length, rate);
    const data = b.getChannelData(0);
    let random = 1337;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      random = (Math.imul(random, 1664525) + 1013904223) | 0;
      const noise = ((random >>> 0) / 4294967296) * 2 - 1;
      data[i] =
        (Math.sin(2 * Math.PI * (capture ? 95 : 210) * t) * 0.7 + noise * 0.3) *
        Math.exp(-t * (capture ? 19 : 45)) *
        0.5;
    }
    this.buffers.set(key, b);
    return b;
  }
  preview(id: string) {
    const b = this.buffers.get(id);
    if (b) {
      this.stop();
      void this.context.resume();
      const s = this.context.createBufferSource();
      s.buffer = b;
      s.connect(this.context.destination);
      s.start();
      this.sources.push(s);
    }
  }
}
