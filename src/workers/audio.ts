import { createMusicAnalyzer } from "../core/musicAnalysis";
type Request =
  | { kind: "start"; frames: number; channels: number; rate: number }
  | { kind: "block"; block: Float32Array[] }
  | { kind: "finish" };
let analysis: ReturnType<typeof createMusicAnalyzer>;
self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const data = event.data;
    if (data.kind === "start") {
      analysis = createMusicAnalyzer(data.rate, data.frames, data.channels);
    } else if (data.kind === "block") {
      analysis.push(data.block);
    } else {
      self.postMessage({ result: analysis.finish() });
      return;
    }
    self.postMessage({ ready: true });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
