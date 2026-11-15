import fs from "node:fs/promises";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { titleShot } from "../src/core/storyboard";
import { annotation } from "../src/core/annotations";
import { updateAnnotations } from "../src/core/annotationEdit";
const p = importPgn(
  blank(),
  Array.from(
    { length: 100 },
    (_, i) => `${i * 2 + 1}. Nf3 Nf6 ${i * 2 + 2}. Ng1 Ng8`,
  ).join(" "),
);
p.storyboard.shots = Array.from({ length: 100 }, () =>
  titleShot(p, "Performance fixture", 2),
);
p.storyboard.shots[0].annotations = Array.from({ length: 20 }, () =>
  annotation("text", 0),
);
const id = p.storyboard.shots[0].id,
  count = 100;
function measure(fast: boolean) {
  let state = p;
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const x = 0.3 + i / 1000;
    if (fast)
      state = updateAnnotations(
        state,
        (a) => {
          a[0].x = x;
        },
        id,
      );
    else {
      const next = structuredClone(state);
      next.storyboard.shots[0].annotations[0].x = x;
      if (JSON.stringify(next) !== JSON.stringify(state)) state = next;
    }
  }
  return performance.now() - start;
}
measure(true);
measure(false);
const results = {
  moves: p.moves.length,
  shots: p.storyboard.shots.length,
  layers: 20,
  edits: count,
  fullCloneCompareMs: measure(false),
  annotationOnlyMs: measure(true),
};
await fs.mkdir("work", { recursive: true });
await fs.writeFile(
  "work/annotation-benchmark.json",
  JSON.stringify(results, null, 2),
);
console.log(results);
