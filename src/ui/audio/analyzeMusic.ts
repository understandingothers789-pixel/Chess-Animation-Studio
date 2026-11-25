import type { MusicAnalysis } from "../../core/musicAnalysis";

export async function analyzeMusicBuffer(
  buffer: AudioBuffer,
): Promise<MusicAnalysis> {
  if (buffer.duration > 3600)
    throw Error("Music analysis supports up to one hour.");
  const worker = new Worker(
    new URL("../../workers/audio.ts", import.meta.url),
    { type: "module" },
  );
  const channels = Array.from(
    { length: Math.min(2, buffer.numberOfChannels) },
    (_, i) => buffer.getChannelData(i),
  );
  const size = Math.round(buffer.sampleRate);
  return new Promise((resolve, reject) => {
    let offset = 0;
    const failure = (message: string) => {
      worker.terminate();
      reject(Error(message));
    };
    worker.onerror = () => failure("Music beat analysis failed.");
    worker.onmessage = ({ data }) => {
      if (data.error) return failure(data.error);
      if (data.result) {
        worker.terminate();
        resolve(data.result);
      } else if (offset >= buffer.length) {
        worker.postMessage({ kind: "finish" });
      } else {
        const block = channels.map((channel) =>
          channel.slice(offset, offset + size),
        );
        offset += size;
        worker.postMessage(
          { kind: "block", block },
          block.map((part) => part.buffer),
        );
      }
    };
    worker.postMessage({
      kind: "start",
      rate: buffer.sampleRate,
      frames: buffer.length,
      channels: channels.length,
    });
  });
}
