export type DetectedHit = { time: number; accent: boolean; strength: number };

/** Processes bounded PCM blocks so stereo tracks need no second full-length copy. */
export function createMusicAnalyzer(
  sampleRate: number,
  frames: number,
  channels: number,
) {
  if (
    !Number.isFinite(sampleRate) ||
    sampleRate < 1000 ||
    !Number.isSafeInteger(frames) ||
    frames < 0 ||
    !Number.isInteger(channels) ||
    channels < 1
  )
    throw Error("Invalid audio data.");
  const hop = Math.round(sampleRate * 0.008);
  const stride = Math.max(1, Math.floor(sampleRate / 12000));
  const hopCount = Math.ceil(frames / hop);
  const binCount = Math.min(12000, hopCount);
  const peak = new Float32Array(binCount);
  const square = new Float64Array(binCount);
  const count = new Uint32Array(binCount);
  const novelty = new Float32Array(hopCount);
  const impact = new Float32Array(hopCount);
  const power = [0, 0, 0];
  const previous = [0, 0, 0];
  const fast = [0, 0, 0];
  const floor = [0, 0, 0];
  const weight = [1.35, 1.05, 0.76];
  const filters = Array.from({ length: channels }, () => ({
    bass: 0,
    body: 0,
    sum: 0,
  }));
  const bassRate = 1 - Math.exp((-2 * Math.PI * 145 * stride) / sampleRate);
  const bodyRate = 1 - Math.exp((-2 * Math.PI * 1800 * stride) / sampleRate);
  let offset = 0,
    hopIndex = 0,
    samplesInHop = 0;
  function endHop() {
    let flux = 0;
    let strength = 0;
    for (let k = 0; k < 3; k++) {
      const rms = Math.sqrt(power[k] / Math.max(1, samplesInHop * channels));
      fast[k] = 0.68 * rms + 0.32 * fast[k];
      const change = Math.max(0, fast[k] - previous[k]);
      const above = Math.max(0, fast[k] - floor[k]);
      flux += weight[k] * Math.log1p(change / (0.012 + floor[k] * 0.65));
      strength += weight[k] * (above + 1.5 * change);
      floor[k] += (rms - floor[k]) * 0.075;
      previous[k] = fast[k];
      power[k] = 0;
    }
    novelty[hopIndex] = flux;
    impact[hopIndex++] = strength;
    samplesInHop = 0;
  }
  function push(block: Float32Array[]) {
    for (let i = 0; i < block[0].length && offset < frames; i++, offset++) {
      const bin = Math.min(
        binCount - 1,
        Math.floor((offset * binCount) / frames),
      );
      const filterSample = (offset + 1) % stride === 0;
      for (let c = 0; c < channels; c++) {
        const value = block[c][i];
        peak[bin] = Math.max(peak[bin], Math.abs(value));
        square[bin] += value * value;
        const filter = filters[c];
        filter.sum += value;
        if (filterSample) {
          const input = filter.sum / stride;
          filter.sum = 0;
          filter.bass += (input - filter.bass) * bassRate;
          filter.body += (input - filter.body) * bodyRate;
          power[0] += filter.bass ** 2;
          power[1] += (filter.body - filter.bass) ** 2;
          power[2] += (input - filter.body) ** 2;
        }
      }
      count[bin] += channels;
      if (filterSample) samplesInHop++;
      if ((offset + 1) % hop === 0) endHop();
    }
  }
  function finish() {
    if (offset % hop) endHop();
    const max = Math.max(0.001, ...peak);
    const waveform = Array.from(
      peak,
      (v) => Math.round(Math.min(1, v / max) * 10000) / 10000,
    );
    const waveformRms = Array.from(
      square,
      (v, i) =>
        Math.round(
          Math.min(1, Math.sqrt(v / Math.max(1, count[i])) / max) * 10000,
        ) / 10000,
    );
    const seconds = hop / sampleRate;
    const prefix = new Float64Array(hopIndex + 1);
    const squares = new Float64Array(hopIndex + 1);
    for (let i = 0; i < hopIndex; i++) {
      prefix[i + 1] = prefix[i] + novelty[i];
      squares[i + 1] = squares[i] + novelty[i] ** 2;
    }
    const candidates: { time: number; score: number }[] = [];
    const window = Math.max(1, Math.round(0.48 / seconds));
    const exclusion = Math.max(1, Math.round(0.048 / seconds));
    for (let i = 0; i < hopIndex; i++) {
      const value = novelty[i];
      if (
        value < 0.13 ||
        value < (novelty[i - 1] ?? 0) ||
        value <= (novelty[i + 1] ?? 0)
      )
        continue;
      const lo = Math.max(0, i - window),
        hi = Math.min(hopIndex, i + window);
      const left = Math.max(lo, i - exclusion),
        right = Math.min(hi, i + exclusion + 1);
      const n = Math.max(1, left - lo + hi - right);
      const mean = (prefix[left] - prefix[lo] + prefix[hi] - prefix[right]) / n;
      const sd = Math.sqrt(
        Math.max(
          0,
          (squares[left] - squares[lo] + squares[hi] - squares[right]) / n -
            mean ** 2,
        ),
      );
      if (value < mean + Math.max(0.1, 2.2 * sd, mean * 0.85)) continue;
      let onset = i;
      while (
        onset > Math.max(0, i - 3) &&
        novelty[onset - 1] >= Math.max(mean, value * 0.32)
      )
        onset--;
      const candidate = {
        time: onset * seconds,
        score: impact[i] * 0.74 + (value - mean) * 0.13,
      };
      const last = candidates.at(-1);
      if (last && candidate.time - last.time < 0.108) {
        if (candidate.score > last.score * 1.12)
          candidates[candidates.length - 1] = candidate;
      } else candidates.push(candidate);
    }
    const scores = candidates.map((hit) => hit.score).sort((a, b) => a - b);
    const typical = scores[Math.floor(scores.length * 0.55)] || 1;
    const reference = scores[Math.floor(scores.length * 0.92)] || 1;
    const peaks: DetectedHit[] = candidates.slice(0, 30000).map((hit) => {
      const strength = Math.min(1, hit.score / reference);
      return {
        time: hit.time,
        strength: Math.round(strength * 1000) / 1000,
        accent:
          strength >= 0.74 &&
          hit.score >= Math.min(reference * 0.9, typical * 1.36),
      };
    });
    return { waveform, waveformRms, peaks };
  }
  return { push, finish };
}

export function analyze(
  samples: Float32Array | Float32Array[],
  sampleRate: number,
) {
  const block = samples instanceof Float32Array ? [samples] : samples;
  const analyzer = createMusicAnalyzer(
    sampleRate,
    block[0].length,
    block.length,
  );
  analyzer.push(block);
  return analyzer.finish();
}
export type MusicAnalysis = ReturnType<typeof analyze>;
