import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { sample } from "../src/core/chess";
import {
  compileStoryboard,
  shotFromMove,
  resolveStoryboardFrame,
} from "../src/core/storyboard";
const p = sample();
p.storyboard.shots = Array.from({ length: 200 }, (_, i) =>
  shotFromMove(p, p.moves[i % p.moves.length].id),
);
const a = performance.now();
compileStoryboard(p);
const cold = performance.now() - a;
const b = performance.now();
for (let i = 0; i < 10000; i++) resolveStoryboardFrame(p, (i % 200) * 0.5);
const resolve = performance.now() - b;
const edit = structuredClone(p);
edit.storyboard.shots[0].name = "Caption edit";
const c = performance.now();
compileStoryboard(edit);
const edited = performance.now() - c;
const result = {
  shots: 200,
  sourceMoves: p.moves.length,
  coldCompileMs: cold,
  resolve10000Ms: resolve,
  editCompileMs: edited,
  note: "Node CPU benchmark; no claim about GPU FPS. 48 thumbnail cache entries, source-context LRU bounded to 4.",
};
await fs.mkdir("test-results/storyboard-render", { recursive: true });
await fs.writeFile(
  "test-results/storyboard-render/benchmark.json",
  JSON.stringify(result, null, 2),
);
console.log(result);
