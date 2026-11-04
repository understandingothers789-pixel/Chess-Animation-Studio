import { afterEach, expect, it, vi } from "vitest";
import { blank } from "../src/core/project";
import { AudioPlayer } from "../src/ui/audio";
import { importPgn } from "../src/core/chess";
import { segments } from "../src/core/timeline";

afterEach(() => vi.unstubAllGlobals());

it("clearing an unrelated missing asset does not stop scheduled music", async () => {
  const stop = vi.fn();
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
          setTargetAtTime: vi.fn(),
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
    project = blank();
  project.music.asset = "selected-music";
  player.buffers.set("selected-music", { duration: 90 } as AudioBuffer);

  await player.play(project, 0);
  player.clear("unavailable-old-track");

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
