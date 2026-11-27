import { expect, it } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { annotation, annotationOpacity } from "../src/core/annotations";
import { importPgn } from "../src/core/chess";
import {
  createStoryTemplate,
  storyTemplates,
} from "../src/core/storyTemplates";
import { highlightGroups, highlightMatches } from "../src/core/highlights";
import {
  compileStoryboard,
  replayShot,
  resolveStoryboardFrame,
  shotFromMove,
} from "../src/core/storyboard";
it("finds legal checkmate, castling and capture events without inventing assessments", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#");
  const g = highlightGroups(p);
  expect(g.Checkmates).toEqual([p.moves[6].id]);
  expect(highlightMatches(p, ["Checkmates"]).map((m) => m.id)).toEqual([
    p.moves[6].id,
  ]);
  expect(g["Analysis labels"]).toEqual([]);
  const c = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O");
  expect(highlightMatches(c, ["Castling"]).map((m) => m.san)).toEqual(["O-O"]);
});
it("builds all editable templates from real source references, leaving source and existing story untouched", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#");
  const before = JSON.stringify(p);
  for (const name of storyTemplates) {
    const shots = createStoryTemplate(p, name, [p.moves[0].id, p.moves[6].id]);
    expect(shots.length).toBeGreaterThan(2);
    expect(JSON.stringify(p)).toBe(before);
    const next = parseProject({ ...p, storyboard: { shots, beats: [] } });
    expect(compileStoryboard(next).issues).toEqual([]);
    expect(new Set(shots.map((s) => s.id)).size).toBe(shots.length);
  }
});
it("rejects ungrounded mate/trap templates and uses neutral prompts for combinations", () => {
  const p = importPgn(blank(), "1. e4 e5");
  expect(() =>
    createStoryTemplate(p, "Checkmate Reveal", [p.moves[0].id]),
  ).toThrow(/checkmate/);
  expect(() => createStoryTemplate(p, "Opening Trap", [p.moves[0].id])).toThrow(
    /two/,
  );
  expect(() => createStoryTemplate(p, "Puzzle Challenge", [])).toThrow(
    /Choose/,
  );
  expect(
    JSON.stringify(
      createStoryTemplate(
        p,
        "Combination",
        p.moves.map((m) => m.id),
      ),
    ),
  ).not.toMatch(/brilliant|winning|sacrifice/i);
});

it("counts down on the unrevealed board and shows the played move after the reveal", () => {
  const p = importPgn(blank(), "1. e4 e5");
  const [countdown, reveal, payoff] = createStoryTemplate(
    p,
    "Puzzle Challenge",
    [p.moves[0].id],
    5,
  );
  p.storyboard.shots = [countdown, reveal, payoff];
  expect(countdown.duration).toBe(5);
  expect(countdown.camera?.mode).toBe("full");
  for (let second = 0; second < 5; second++) {
    expect(
      countdown.annotations
        .filter(
          (layer) => layer.kind === "text" && annotationOpacity(layer, second),
        )
        .map((layer) => layer.text),
    ).toEqual([String(5 - second)]);
  }
  const unrevealed = resolveStoryboardFrame(p, 4.99)!;
  expect(unrevealed.game.initial.some((piece) => piece.square === "e4")).toBe(
    false,
  );
  expect(
    unrevealed.project.annotations.every((layer) => !layer.text.includes("e4")),
  ).toBe(true);
  expect(resolveStoryboardFrame(p, 5)?.game.steps[0]?.move.san).toBe("e4");
  expect(payoff.annotations[0].text).toBe("Played move · e4");
});

it("marks actual checking pieces, including a discovered check, and both castling paths", () => {
  const p = importPgn(
    blank(),
    `[SetUp "1"]
[FEN "4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1"]

1. Bb5+`,
  );
  const [setup, , result] = createStoryTemplate(p, "Tactical Breakdown", [
    p.moves[0].id,
  ]);
  expect(result.camera?.mode).toBe("full");
  expect(setup.annotations).toContainEqual(
    expect.objectContaining({ kind: "circle", from: "e2" }),
  );
  expect(result.annotations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "arrow", from: "e2", to: "b5" }),
      expect.objectContaining({ kind: "arrow", from: "e1", to: "e8" }),
      expect.objectContaining({ kind: "circle", from: "e8" }),
    ]),
  );
  const castle = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O");
  const [, , castled] = createStoryTemplate(castle, "Tactical Breakdown", [
    castle.moves[6].id,
  ]);
  expect(castled.annotations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "arrow", from: "e1", to: "g1" }),
      expect.objectContaining({ kind: "arrow", from: "h1", to: "f1" }),
    ]),
  );
});

it("replays the same trimmed move at the selected speed with independent annotation timing", () => {
  const p = importPgn(blank(), "1. e4 e5");
  const original = shotFromMove(p, p.moves[0].id);
  original.preHold = 0.15;
  original.postHold = 0.21;
  original.trimStart = 0.02;
  original.trimEnd = 0.02;
  original.duration = 2;
  original.annotations = [
    {
      ...annotation("arrow", 0.4),
      end: 1.9,
    },
  ];
  original.beatPin = {
    beatId: "removed",
    moveId: p.moves[0].id,
    event: "landing",
  };
  p.storyboard.shots = [original];
  const originalSnapshot = structuredClone(original);
  const entry = compileStoryboard(p).shots[0];
  const replay = replayShot(p, entry, 0.5)!;
  expect(original).toEqual(originalSnapshot);
  expect(replay).toMatchObject({ preHold: 0.15, postHold: 0.21 });
  expect(replay.duration).toBeCloseTo(0.36 + (original.duration - 0.36) / 0.5);
  expect(replay.beatPin).toBeUndefined();
  expect(replay.id).not.toBe(original.id);
  expect(replay.annotations[0].id).not.toBe(original.annotations[0].id);
  expect(replay.annotations[0].start).toBeCloseTo(
    0.15 + (0.25 * (replay.duration - 0.36)) / (original.duration - 0.36),
  );
  expect(replay.duration - replay.annotations[0].end).toBeCloseTo(0.1);
  const combined = parseProject({
    ...p,
    storyboard: { shots: [original, replay], beats: [] },
  });
  const frame = resolveStoryboardFrame(
    combined,
    entry.end + replay.preHold + 0.1,
  )!;
  expect(frame.shot.id).toBe(replay.id);
  const originalRate =
    (entry.sourceEnd - entry.sourceStart) / (original.duration - 0.36);
  expect(frame.rate).toBeCloseTo(originalRate * 0.5);
  expect(frame.sourceTime).toBeCloseTo(
    entry.sourceStart + 0.1 * originalRate * 0.5,
  );
  expect(frame.sourceEnd).toBeCloseTo(entry.sourceEnd);
});
