import { expect, it, vi } from "vitest";
import { AudioPlayer } from "../src/ui/audio";
import { blank } from "../src/core/project";
it("slows music and its fades on the same preview clock", async () => {
  const start = vi.fn(),
    ramps: ReturnType<typeof vi.fn>[] = [];
  const source = {
    buffer: null,
    playbackRate: { value: 1 },
    connect: (v: unknown) => v,
    start,
    stop: vi.fn(),
  };
  class Context {
    currentTime = 0;
    destination = {};
    resume = async () => {};
    close = async () => {};
    createBufferSource() {
      return source;
    }
    createGain() {
      const ramp = vi.fn();
      ramps.push(ramp);
      return {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: ramp,
          setTargetAtTime: vi.fn(),
        },
        connect: (v: unknown) => v,
      };
    }
  }
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("performance", { now: () => 0 });
  try {
    const p = blank();
    p.music.asset = "music";
    p.music.offset = 2;
    p.music.fadeIn = 2;
    p.music.fadeOut = 1;
    p.tail = 10;
    const player = new AudioPlayer();
    player.buffers.set("music", { duration: 8 } as AudioBuffer);
    await player.play(p, 1, "source", 0.5);
    expect(source.playbackRate.value).toBe(0.5);
    expect(start.mock.calls[0][0]).toBeCloseTo(2.09);
    expect(ramps[0].mock.calls[0][1]).toBeCloseTo(6.09);
    player.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
