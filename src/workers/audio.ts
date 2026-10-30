import { analyze } from "../core/audio";
self.onmessage = (e: MessageEvent<{ samples: Float32Array; rate: number }>) => {
  try {
    self.postMessage(analyze(e.data.samples, e.data.rate));
  } catch (err) {
    self.postMessage({ error: (err as Error).message });
  }
};
