import { expect, it } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import {
  createStoryTemplate,
  storyTemplates,
} from "../src/core/storyTemplates";
import { highlightGroups, highlightMatches } from "../src/core/highlights";
import { compileStoryboard } from "../src/core/storyboard";
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
it("builds all five editable templates from real source references, leaving source and existing story untouched", () => {
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
