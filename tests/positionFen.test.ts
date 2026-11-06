import { it, expect } from "vitest";
import { Chess } from "chess.js";
import { importPgn } from "../src/core/chess";
import { blank } from "../src/core/project";
import { segments } from "../src/core/timeline";
import { positionFen } from "../src/ui/preview/positionFen";
it("copies the legal position after each landed move, including the final move", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
  const chess = new Chess(p.fen),
    sequence = segments(p);
  expect(positionFen(p, 0)).toBe(p.fen);
  for (let i = 0; i < p.moves.length; i++) {
    expect(positionFen(p, sequence[i].land - 0.001)).toBe(chess.fen());
    chess.move(p.moves[i].san);
    expect(positionFen(p, sequence[i].land)).toBe(chess.fen());
  }
});
