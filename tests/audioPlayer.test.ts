import { afterEach, expect, it, vi } from "vitest";
import { blank } from "../src/core/project";
import { AudioPlayer } from "../src/ui/audio";

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
