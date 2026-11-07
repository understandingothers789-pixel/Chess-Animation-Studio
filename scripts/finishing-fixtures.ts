import type { Project, Format } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { annotation } from "../src/core/annotations";
import { shotFromMove, titleShot, shotCaption } from "../src/core/storyboard";
export function finishingFixtures(base: Project) {
  const puzzle = importPgn(structuredClone(base), "1. f3 e5 2. g4 Qh4#");
  puzzle.storyboard.shots = [
    titleShot(puzzle, "Find checkmate", 0.3),
    shotFromMove(puzzle, puzzle.moves[3].id, "position-hold", "before"),
    shotFromMove(puzzle, puzzle.moves[3].id),
    titleShot(puzzle, "The queen delivers checkmate", 0.3),
  ];
  const arrow = annotation("arrow", 0);
  arrow.from = "d8";
  arrow.to = "h4";
  arrow.end = 0.3;
  puzzle.storyboard.shots[2].annotations = [
    arrow,
    shotCaption(puzzle, "Qh4 is checkmate", 0.3),
  ];
  const stress = structuredClone(base);
  stress.storyboard.shots.forEach((s, i) => {
    const a = shotCaption(
      stress,
      [
        "This bishop sacrifice looks completely losing until you notice the queen is trapped.",
        "Three explicit\nlines are\nsupported",
        "A very long caption ".repeat(15),
        "Unicode café 中文 👨‍👩‍👦",
      ][i],
      0.3,
    );
    a.font = i % 2 ? "serif" : "monospace";
    a.y = i % 2 ? 0.82 : 0.15;
    s.annotations = [a];
  });
  const sync = structuredClone(base);
  sync.storyboard.beats = Array.from({ length: 5 }, (_, i) => ({
    id: "rhythm" + i,
    time: i * 0.3,
    enabled: true,
    accent: i % 2 === 0,
  }));
  sync.music.volumePoints = Array.from({ length: 9 }, (_, i) => ({
    time: i * 0.15,
    value: i % 2 ? 0.35 : 1,
  }));
  const highlights = structuredClone(base);
  highlights.storyboard.shots[3] = structuredClone(
    highlights.storyboard.shots[0],
  );
  highlights.storyboard.shots[3].id = crypto.randomUUID();
  const all = [
    {
      name: "format-comparison",
      project: base,
      formats: [
        "landscape",
        "vertical",
        "square",
        "square-in-vertical",
      ] as Format[],
      rates: [24, 30, 60],
    },
    ...[
      ["puzzle-challenge", puzzle],
      ["repeated-highlights", highlights],
      ["caption-stress", stress],
      ["audio-synchronization", sync],
    ].map(([name, project]) => ({
      name: name as string,
      project: project as Project,
      formats: ["vertical"] as Format[],
      rates: [30],
    })),
  ];
  for (const f of all)
    for (const s of f.project.storyboard.shots) {
      s.duration = 0.3;
      s.preHold = 0;
      s.postHold = 0;
      s.annotations.forEach((a) => {
        a.start = 0;
        a.end = 0.3;
      });
    }
  return all;
}
