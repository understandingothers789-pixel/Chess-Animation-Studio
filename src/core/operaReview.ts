import type { Move, Project } from "./project";

export const bundledOperaId = "cf07240c-44d2-4b90-9977-359827f7379e";
const initialPosition =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Stockfish 17.1, depth 18, generated with the same review rules as local analysis.
const review: {
  id: string;
  san: string;
  engine: NonNullable<Move["analysis"]["engine"]>;
}[] = [
  {
    id: "821590d4",
    san: "e4",
    engine: {
      state: "done",
      score: 30,
      loss: 0,
      best: "e2e4",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "25ca44ca",
    san: "e5",
    engine: {
      state: "done",
      score: -37,
      loss: 0,
      best: "e7e5",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "aaaf9983",
    san: "Nf3",
    engine: {
      state: "done",
      score: 37,
      loss: 0,
      best: "g1f3",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "4f490ee3",
    san: "d6",
    engine: {
      state: "done",
      score: -51,
      loss: 9,
      best: "b8c6",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "10078ee9",
    san: "d4",
    engine: {
      state: "done",
      score: 54,
      loss: 0,
      best: "d2d4",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "a2a66010",
    san: "Bg4",
    engine: {
      state: "done",
      score: -113,
      loss: 63,
      best: "g8f6",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "2aee393a",
    san: "dxe5",
    engine: {
      state: "done",
      score: 96,
      loss: 13,
      best: "c1e3",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "b1137f",
    san: "Bxf3",
    engine: {
      state: "done",
      score: -136,
      loss: 36,
      best: "b8c6",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "4c8194ef",
    san: "Qxf3",
    engine: {
      state: "done",
      score: 171,
      loss: 0,
      best: "d1f3",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "d3191af3",
    san: "dxe5",
    engine: {
      state: "done",
      score: -169,
      loss: 0,
      best: "d6e5",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "e7179446",
    san: "Bc4",
    engine: {
      state: "done",
      score: 131,
      loss: 34,
      best: "f3b3",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "73f93180",
    san: "Nf6",
    engine: {
      state: "done",
      score: -255,
      loss: 104,
      best: "d8f6",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "83322da0",
    san: "Qb3",
    engine: {
      state: "done",
      score: 250,
      loss: 0,
      best: "f3b3",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "8e7bb4bf",
    san: "Qe7",
    engine: {
      state: "done",
      score: -257,
      loss: 8,
      best: "f8c5",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "499ff8a7",
    san: "Nc3",
    engine: {
      state: "done",
      score: 221,
      loss: 30,
      best: "b3b7",
      label: "good",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "e0deb2ac",
    san: "c6",
    engine: {
      state: "done",
      score: -238,
      loss: 0,
      best: "c7c6",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "8da2e42e",
    san: "Bg5",
    engine: {
      state: "done",
      score: 244,
      loss: 0,
      best: "c1g5",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "76ab48f7",
    san: "b5",
    engine: {
      state: "done",
      score: -337,
      loss: 99,
      best: "e8d8",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "1fafdd0a",
    san: "Nxb5",
    engine: {
      state: "done",
      score: 347,
      loss: 0,
      best: "c3b5",
      label: "brilliant",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
      sacrifice: { reply: "cxb5", continuation: "Bxb5+", material: 1 },
    },
  },
  {
    id: "8c3c3d38",
    san: "cxb5",
    engine: {
      state: "done",
      score: -521,
      loss: 144,
      best: "e7b4",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "e4febfdc",
    san: "Bxb5+",
    engine: {
      state: "done",
      score: 557,
      loss: 0,
      best: "c4b5",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "df6224b5",
    san: "Nbd7",
    engine: {
      state: "done",
      score: -543,
      loss: 0,
      best: "b8d7",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "dee1db50",
    san: "O-O-O",
    engine: {
      state: "done",
      score: 536,
      loss: 0,
      best: "e1c1",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "f3ad87a",
    san: "Rd8",
    engine: {
      state: "done",
      score: -520,
      loss: 0,
      best: "a8d8",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "5ceb82d5",
    san: "Rxd7",
    engine: {
      state: "done",
      score: 516,
      loss: 0,
      best: "d1d7",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "14149c54",
    san: "Rxd7",
    engine: {
      state: "done",
      score: -628,
      loss: 129,
      best: "f6d7",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "9d987941",
    san: "Rd1",
    engine: {
      state: "done",
      score: 627,
      loss: 0,
      best: "h1d1",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "99af3f7d",
    san: "Qe6",
    engine: {
      state: "done",
      score: -839,
      loss: 209,
      best: "e7d6",
      label: "mistake",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "b9d44f65",
    san: "Bxd7+",
    engine: {
      state: "done",
      score: 855,
      loss: 0,
      best: "b5d7",
      label: "best",
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "88d925f8",
    san: "Nxd7",
    engine: {
      state: "done",
      score: 0,
      loss: 0,
      best: "e6d7",
      label: "mistake",
      mate: -2,
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "35f98116",
    san: "Qb8+",
    engine: {
      state: "done",
      score: 0,
      loss: 0,
      best: "b3b8",
      label: "brilliant",
      mate: 2,
      bestMate: 2,
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
      sacrifice: { reply: "Nxb8", continuation: "Rd8#", material: 9 },
    },
  },
  {
    id: "1114d94e",
    san: "Nxb8",
    engine: {
      state: "done",
      score: 0,
      loss: 0,
      best: "d7b8",
      label: "best",
      mate: -1,
      bestMate: -1,
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
  {
    id: "7b704cd5",
    san: "Rd8#",
    engine: {
      state: "done",
      score: 0,
      loss: 0,
      best: "d1d8",
      label: "best",
      mate: 1,
      bestMate: 1,
      depth: 18,
      message:
        "Bundled Opera Game review · Stockfish 17.1; root mover perspective",
    },
  },
];

export function applyOperaReview(p: Project) {
  if (p.fen !== initialPosition) return;
  for (const moves of [
    p.moves,
    ...p.lines.flatMap((line) => (line.moves ? [line.moves] : [])),
  ]) {
    for (const [index, move] of moves.entries()) {
      const saved = review[index];
      if (!saved || saved.san !== move.san || saved.id !== move.id) break;
      move.analysis.engine ??= structuredClone(saved.engine);
      if (index < 3) {
        move.analysis.book ??= {
          state: "found",
          games: 0,
          frequency: 0,
          message:
            "Built-in starter opening repertoire (curated lines; no game counts).",
        };
      }
    }
  }
}
