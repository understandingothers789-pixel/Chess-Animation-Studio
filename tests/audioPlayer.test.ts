import { afterEach, expect, it, vi } from "vitest";
import { blank } from "../src/core/project";
import { AudioPlayer } from "../src/ui/audio";
import { importPgn } from "../src/core/chess";
import { segments } from "../src/core/timeline";

afterEach(() => vi.unstubAllGlobals());

it("clearing an unrelated missing asset does not stop scheduled music", async () => {
  const stop = vi.fn();
  const gainUpdate = vi.fn();
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {});
    createBufferSource() {
      return {
        buffer: null,
        connect: (destination: unknown) => destination,
        start: vi.fn(),
        stop,
      };
    }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          setTargetAtTime: gainUpdate,
        },
        connect: (destination: unknown) => destination,
      };
    }
    createOscillator() {
      throw new Error("No sound cues expected");
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("performance", { now: () => 0 });

  const player = new AudioPlayer(),
    project = importPgn(blank(), "1. e4");
  project.audio.chess = 0;
  project.music.asset = "selected-music";
  player.buffers.set("selected-music", { duration: 90 } as AudioBuffer);

  await player.play(project, 0);
  player.clear("unavailable-old-track");
  player.updateMusic(project, 0.1);
  player.updateMusic(project, 0.2);
  expect(gainUpdate).not.toHaveBeenCalled();
  project.music.muted = true;
  player.updateMusic(project, 0.3);
  player.updateMusic(project, 0.4);
  expect(gainUpdate).toHaveBeenCalledExactlyOnceWith(0, 0, 0.01);

  expect(stop).not.toHaveBeenCalled();
  player.stop();
  expect(stop).toHaveBeenCalledOnce();
  player.dispose();
});

it("applies horse cue timing, volume and length controls", async () => {
  const starts: unknown[][] = [],
    gains: { value: number }[] = [];
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {});
    createBufferSource() {
      return {
        buffer: null,
        connect: (destination: unknown) => destination,
        start: (...args: unknown[]) => starts.push(args),
        stop: vi.fn(),
      };
    }
    createGain() {
      const gain = {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      };
      gains.push(gain);
      return {
        gain,
        connect: (destination: unknown) => destination,
      };
    }
    createOscillator() {
      throw new Error("Automatic cues are disabled");
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("performance", { now: () => 0 });

  const project = importPgn(blank(), "1. Nf3");
  project.audio.automatic = false;
  project.audio.knightHorse = true;
  project.audio.chess = 1;
  project.audio.knightVolume = 1.35;
  project.audio.knightOffset = -0.35;
  project.audio.knightDuration = 0.6;
  const player = new AudioPlayer();
  player.buffers.set("__knightHorse", { duration: 1.8 } as AudioBuffer);

  await player.play(project, 0);

  expect(starts).toHaveLength(1);
  expect(starts[0][0]).toBeCloseTo(0.09 + segments(project)[0].land - 0.35);
  expect(starts[0].slice(1)).toEqual([0, 0.6]);
  expect(gains[0].value).toBe(1.35);
  player.dispose();
});

it("keeps one continuous storyboard music source and resumes the output-capped fade after seeking", async () => {
  const gains: any[] = [];
  const starts: any[] = [];
  const stop = vi.fn();
  class Context {
    currentTime = 0;
    destination = {};
    resume = async () => {};
    close = async () => {};
    createGain() {
      const gain = {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      };
      gains.push(gain);
      return { gain, connect: (n: any) => n };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect: (n: any) => n,
        start: (...a: any[]) => starts.push(a),
        stop,
      };
    }
    createOscillator() {
      throw Error("No chess cues in holds");
    }
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("performance", { now: () => 0 });
  const { titleShot } = await import("../src/core/storyboard");
  const p = blank();
  p.music.asset = "music";
  p.music.fadeIn = 0;
  p.music.fadeOut = 1;
  p.storyboard.shots = [titleShot(p, "A", 2), titleShot(p, "B", 2)];
  p.storyboard.shots[1].musicDucking = {
    enabled: true,
    volume: 0.3,
    fadeDown: 0.1,
    fadeUp: 0.2,
  };
  const player = new AudioPlayer();
  player.buffers.set("music", { duration: 90 } as AudioBuffer);
  await player.play(p, 3.8, "storyboard");
  expect(starts).toHaveLength(1);
  expect(starts[0][1]).toBe(3.8);
  expect(starts[0][2]).toBeCloseTo(0.2);
  expect(gains[2].setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.2);
  expect(gains[3].setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.3);
  player.updateMusic(p, 3.9);
  player.clear("old-unrelated-track");
  expect(stop).not.toHaveBeenCalled();
  player.dispose();
});

it("ignores a cancelled audio start without interrupting the newer playback", async () => {
  const resumes: (() => void)[] = [];
  const start = vi.fn(),
    stop = vi.fn();
  class Context {
    currentTime = 0;
    destination = {};
    resume() {
      return new Promise<void>((resolve) => resumes.push(resolve));
    }
    close = async () => {};
    createBufferSource() {
      return { buffer: null, connect: (node: unknown) => node, start, stop };
    }
    createGain() {
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: (node: unknown) => node,
      };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const project = blank();
  project.music.asset = "music";
  const player = new AudioPlayer();
  player.buffers.set("music", { duration: 90 } as AudioBuffer);

  const replaced = player.play(project, 0);
  const current = player.play(project, 1);
  resumes[1]();
  expect(await current).toEqual(expect.any(Number));
  resumes[0]();
  expect(await replaced).toBeNull();
  expect(start).toHaveBeenCalledOnce();
  expect(stop).not.toHaveBeenCalled();

  const cancelled = player.play(project, 0);
  player.stop();
  resumes[2]();
  expect(await cancelled).toBeNull();
  expect(start).toHaveBeenCalledOnce();
  player.dispose();
});

it("keeps replaced and removed audio out of the buffer cache when decoding finishes late", async () => {
  const decodes: ((buffer: AudioBuffer) => void)[] = [];
  class Context {
    close = async () => {};
    decodeAudioData() {
      return new Promise<AudioBuffer>((resolve) => decodes.push(resolve));
    }
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    })),
  );
  const player = new AudioPlayer();
  const older = player.load("music", "older");
  await vi.waitFor(() => expect(decodes).toHaveLength(1));
  const latest = player.load("music", "newer");
  await vi.waitFor(() => expect(decodes).toHaveLength(2));
  const fresh = { duration: 2 } as AudioBuffer;
  decodes[1](fresh);
  expect(await latest).toBe(fresh);
  decodes[0]({ duration: 1 } as AudioBuffer);
  expect(await older).toBeNull();
  expect(player.buffers.get("music")).toBe(fresh);

  const deleted = player.load("music", "deleted");
  await vi.waitFor(() => expect(decodes).toHaveLength(3));
  player.clear("music");
  decodes[2](fresh);
  expect(await deleted).toBeNull();
  expect(player.buffers.has("music")).toBe(false);
  player.dispose();
});
