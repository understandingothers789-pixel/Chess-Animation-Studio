import { analyzePcm } from "../core/audio";
self.onmessage = (
  event: MessageEvent<{ samples: Float32Array; sampleRate: number }>,
) => {
  self.postMessage(analyzePcm(event.data.samples, event.data.sampleRate));
};
