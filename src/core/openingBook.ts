import { Chess } from "chess.js";
// A small curated starter repertoire, not a statistical Masters database.
const lines = [
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Bc5",
  "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6",
  "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6",
  "e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",
  "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6",
  "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7",
  "e4 Nf6 e5 Nd5 d4 d6 Nf3 g6",
  "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6",
  "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
  "d4 Nf6 c4 e6 Nf3 b6 g3 Bb7",
  "d4 Nf6 Nf3 d5 Bf4 e6 e3 c5",
  "c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5",
  "Nf3 d5 d4 Nf6 c4 e6 Nc3 Be7",
];
const positions = new Map<string, Set<string>>();
const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
for (const line of lines) {
  const chess = new Chess();
  for (const san of line.split(" ")) {
    const fen = key(chess.fen());
    const move = chess.move(san);
    const moves = positions.get(fen) ?? new Set<string>();
    moves.add(move.from + move.to + (move.promotion ?? ""));
    positions.set(fen, moves);
  }
}
export function starterBook(fen: string, uci: string, ply: number) {
  return ply < 8 && (positions.get(key(fen))?.has(uci) ?? false);
}
