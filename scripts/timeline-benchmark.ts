import { performance } from "node:perf_hooks";
import { blank } from "../src/core/project";
import { importPgn, buildGame } from "../src/core/chess";
import { compileTimeline, evaluate } from "../src/core/timeline";
const results = [];
for (const cycles of [1, 15, 75]) {
  const p = importPgn(
    blank(),
    Array.from(
      { length: cycles },
      (_, i) => `${i * 2 + 1}. Nf3 Nf6 ${i * 2 + 2}. Ng1 Ng8`,
    ).join(" "),
  );
  const game = buildGame(p),
    timeline = compileTimeline(p),
    frames = 3000;
  const run = (compiled: boolean) => {
    const start = performance.now();
    for (let i = 0; i < frames; i++)
      evaluate(
        p,
        (i * 1.71) % timeline.duration,
        game,
        p.format,
        compiled ? timeline : undefined,
      );
    return performance.now() - start;
  };
  run(false);
  run(true);
  const baseline: number[] = [],
    compiled: number[] = [];
  for (let i = 0; i < 5; i++) {
    baseline.push(run(false));
    compiled.push(run(true));
  }
  const median = (a: number[]) => a.sort((a, b) => a - b)[2];
  results.push({
    plies: p.moves.length,
    frames,
    baselineMedianMs: median(baseline),
    compiledMedianMs: median(compiled),
  });
}
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      results,
    },
    null,
    2,
  ),
);
