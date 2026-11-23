import { expect, it } from "vitest";
import {
  appendMove,
  buildGame,
  importPgn,
  sample,
  selectLine,
} from "../src/core/chess";
import { blank, parseProject } from "../src/core/project";

it("keeps the complete Opera Game and both lines’ authored edits through save and reopen", () => {
  const main = sample();
  main.moves[0].effect.hop = 0.63;
  main.moves[4].effect.preMoveMeme = { asset: "reaction", duration: 0.6 };
  const branch = appendMove(main, 1, "g1", "e2");
  expect(branch.moves.map((m) => m.san)).toEqual(["e4", "e5", "Ne2"]);
  expect(branch.lines[0].moves).toEqual(main.moves);
  expect(branch.moves[0].id).toBe(main.moves[0].id);
  branch.moves[0].effect.hop = 0.9;
  branch.moves[2].effect.preMoveMeme = { asset: "other-image", duration: 0.4 };

  const reopened = parseProject(JSON.parse(JSON.stringify(branch)));
  const restored = selectLine(reopened, 0);
  expect(restored.moves).toEqual(main.moves);
  expect(buildGame(restored).steps.at(-1)?.move.san).toBe("Rd8#");
  expect(selectLine(restored, 1).moves).toEqual(branch.moves);
});

it("plays the existing move without shortening the game and extends edited lines at their tip", () => {
  const main = sample();
  expect(appendMove(main, 1, "g1", "f3")).toBe(main);
  const branch = appendMove(main, 0, "c7", "c5");
  const extended = appendMove(branch, 1, "g1", "f3");
  expect(extended.moves.map((m) => m.san)).toEqual(["e4", "c5", "Nf3"]);
  expect(extended.lines).toHaveLength(2);
  expect(selectLine(extended, 0).moves).toEqual(main.moves);
  expect(appendMove(extended, 0, "e7", "e5").moves).toEqual(main.moves);
});

it("restores SAN-only variations from older saves without discarding the active line", () => {
  const p = importPgn(blank(), "1. e4 e5 (1... c5) 2. Nf3");
  const legacy = parseProject(JSON.parse(JSON.stringify(p)));
  const alt = selectLine(legacy, 1);
  expect(alt.moves.map((m) => m.san)).toEqual(["e4", "c5"]);
  expect(selectLine(alt, 0).moves).toEqual(p.moves);
});
