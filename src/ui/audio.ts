import { musicAt, gainAt, musicVolumeAt } from "../core/audio";
import { segments } from "../core/timeline";
import { buildGame } from "../core/chess";
import type { Project } from "../core/project";
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
    this.stop();
    this.buffers.delete(id);
  }
  async play(p: Project, time: number) {
    this.stop();
    await this.context.resume();
    if (p.audio.knightHorse && !this.buffers.has("__knightHorse")) {
      await this.load("__knightHorse", new URL("sounds/horse.oga", document.baseURI).href);
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
        trimEnd = m.trimEnd || b.duration,
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
    const seq = segments(p),
      game = buildGame(p),
      events = p.cues.map((c) => {
        const i = c.move ? p.moves.findIndex((m) => m.id === c.move) : -1;
        return { ...c, at: (i >= 0 ? seq[i].land : 0) + c.time };
      });
    if (p.audio.automatic)
      for (let i = 0; i < seq.length; i++)
        events.push({
          id: "auto" + i,
          asset: null,
          move: null,
          time: 0,
          at: seq[i].land,
          kind: game.steps[i].capturedId ? "capture" : "move",
          volume: 0.7,
          bus: "chess",
        });
    if (p.audio.knightHorse)
      for (let i = 0; i < seq.length; i++)
        if (game.steps[i].before.find(piece => piece.id === game.steps[i].pieceId)?.type === "n")
          events.push({ id: "horse" + i, asset: "__knightHorse", move: null, time: 0, at: seq[i].land, kind: "custom", volume: 0.7, bus: "chess" });
    for (const cue of events) {
      if (cue.at < time) continue;
      const at = origin + cue.at - time,
        volume = cue.volume * p.audio[cue.bus],
        buffer = this.buffers.get(cue.asset ?? "");
      if (buffer) {
        const s = this.context.createBufferSource(),
          g = this.context.createGain();
        s.buffer = buffer;
        g.gain.value = volume;
        s.connect(g).connect(this.context.destination);
        s.start(at);
        this.sources.push(s);
      } else if (!cue.asset) {
        const osc = this.context.createOscillator(),
          g = this.context.createGain();
        osc.frequency.value = cue.kind === "capture" ? 130 : 240;
        g.gain.setValueAtTime(0.25 * volume, at);
        g.gain.exponentialRampToValueAtTime(
          0.0001,
          at + (cue.kind === "capture" ? 0.16 : 0.075),
        );
        osc.connect(g).connect(this.context.destination);
        osc.start(at);
        osc.stop(at + 0.2);
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
