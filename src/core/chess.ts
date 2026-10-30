import { Chess } from "chess.js";
import { blank, effect, uid, type Project, type Move } from "./project";
export type Piece = { id: string; type: string; color: string; square: string };
export type Step = {
  move: Move;
  before: Piece[];
  after: Piece[];
  from: string;
  to: string;
  pieceId: string;
  capturedId?: string;
  rook?: { id: string; from: string; to: string };
  promotion?: string;
  fen: string;
  uci: string;
};
export type Game = { initial: Piece[]; steps: Step[]; end: string };
export function xy(s: string): [number, number] {
  return [s.charCodeAt(0) - 97 - 3.5, Number(s[1]) - 1 - 3.5];
}
function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
export function buildGame(p: Project): Game {
  const chess = new Chess(p.fen),
    initial: Piece[] = chess
      .board()
      .flatMap((row) =>
        row.flatMap((v) =>
          v
            ? [
                {
                  id: `${hash(p.fen)}-${v.square}`,
                  type: v.type,
                  color: v.color,
                  square: v.square,
                },
              ]
            : [],
        ),
      );
  let pieces = structuredClone(initial);
  const steps: Step[] = [];
  for (const move of p.moves) {
    const before = structuredClone(pieces),
      fen = chess.fen(),
      m = chess.move(move.san);
    if (!m) throw Error(`Illegal move ${move.san}`);
    const subject = pieces.find((x) => x.square === m.from)!;
    const capturedSquare = m.isEnPassant() ? m.to[0] + m.from[1] : m.to;
    const captured = pieces.find(
      (x) => x.square === capturedSquare && x.id !== subject.id,
    );
    if (captured) pieces = pieces.filter((x) => x.id !== captured.id);
    subject.square = m.to;
    subject.type = m.promotion ?? subject.type;
    let rook: Step["rook"];
    if (m.isKingsideCastle() || m.isQueensideCastle()) {
      const rank = m.from[1],
        from = (m.isKingsideCastle() ? "h" : "a") + rank,
        to = (m.isKingsideCastle() ? "f" : "d") + rank;
      const r = pieces.find((x) => x.square === from)!;
      rook = { id: r.id, from, to };
      r.square = to;
    }
    steps.push({
      move,
      before,
      after: structuredClone(pieces),
      from: m.from,
      to: m.to,
      pieceId: subject.id,
      capturedId: captured?.id,
      rook,
      promotion: m.promotion,
      fen,
      uci: m.from + m.to + (m.promotion ?? ""),
    });
  }
  return { initial, steps, end: chess.fen() };
}
export function setLine(
  p: Project,
  sans: string[],
  fen = p.fen,
  raw = p.pgn,
  preserve = true,
): Project {
  const chess = new Chess(fen),
    old = new Map(p.moves.map((m) => [m.id, m]));
  let prefix = fen;
  const moves = sans.map((token) => {
    const m = chess.move(token);
    if (!m) throw Error(`Illegal move: ${token}`);
    prefix += " " + m.san;
    const id = hash(prefix),
      match = preserve ? old.get(id) : undefined;
    return match
      ? structuredClone(match)
      : { id, san: m.san, effect: structuredClone(p.defaults), analysis: {} };
  });
  return { ...structuredClone(p), fen, pgn: raw, moves };
}
export function importFen(p: Project, fen: string): Project {
  new Chess(fen);
  return {
    ...setLine(p, [], fen, "", false),
    lines: [{ name: "Position", sans: [] }],
    line: 0,
  };
}
export function importPgn(p: Project, text: string, preserve = true): Project {
  if (text.length > 2e6) throw Error("PGN exceeds the 2 MB limit.");
  const fen = text.match(/\[FEN\s+"([^"]+)"\]/i)?.[1] ?? blank().fen;
  const body = text
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/;[^\n]*/g, "")
    .replace(/\$\d+/g, "");
  const tokens =
    body.replace(/(\d+)\.(?:\.\.)?/g, " ").match(/\(|\)|[^\s()]+/g) ?? [];
  let line: string[] = [];
  const stack: string[][] = [],
    branches: string[][] = [];
  for (let t of tokens) {
    if (t === "(") {
      stack.push([...line]);
      line = line.slice(0, -1);
    } else if (t === ")") {
      if (!stack.length) throw Error("Unbalanced PGN variation.");
      branches.push(line);
      line = stack.pop()!;
    } else if (!/^(1-0|0-1|1\/2-1\/2|\*|\.{1,3}|e\.p\.)$/.test(t)) {
      t = t.replace(/[!?]+$/, "");
      if (t) line.push(t);
    }
  }
  if (stack.length) throw Error("Unclosed PGN variation.");
  if (!line.length) throw Error("No legal game moves found.");
  const lines = [line, ...branches].map((sans, i) => {
    const test = new Chess(fen);
    return {
      name: i ? "Variation " + i : "Main line",
      sans: sans.map((s) => test.move(s).san),
    };
  });
  return {
    ...setLine(p, lines[0].sans, fen, text, preserve),
    lines,
    line: 0,
    title: text.match(/\[Event\s+"([^"]+)"\]/i)?.[1] ?? p.title,
  };
}
export function selectLine(p: Project, i: number) {
  if (!p.lines[i]) throw Error("Missing variation.");
  return { ...setLine(p, p.lines[i].sans), line: i };
}
export function appendMove(
  p: Project,
  at: number,
  from: string,
  to: string,
  promotion = "q",
): Project {
  const g = buildGame(p);
  const chess = new Chess(at < 0 ? p.fen : (g.steps[at]?.fen ?? p.fen));
  if (at >= 0) chess.move(p.moves[at].san);
  const m = chess.move({ from, to, promotion });
  const sans = p.moves
    .slice(0, at + 1)
    .map((m) => m.san)
    .concat(m.san);
  const lines = [
    ...p.lines,
    { name: `Board variation ${p.lines.length}`, sans },
  ];
  return { ...setLine(p, sans), lines, line: lines.length - 1 };
}
export function legalMoves(p: Project, at: number, square: string) {
  const g = buildGame(p),
    chess = new Chess(at < 0 ? p.fen : g.steps[at].fen);
  if (at >= 0) chess.move(p.moves[at].san);
  return chess
    .moves({ square: square as never, verbose: true })
    .map((m) => m.to);
}
export function sample(): Project {
  let p = importPgn(
    blank(),
    '[Event "The Opera Game"]\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
  );
  p.title = "The Opera Game";
  p.moves[2].effect = effect("sway");
  p.moves[4].effect = effect("spin");
  p.moves[6].effect = effect("capture");
  p.moves[6].effect.badge.manual = "brilliant";
  p.moves[12].effect = effect("dramatic");
  p.moves[18].effect = effect("hop");
  p.moves[0].effect.highlight.trail = true;
  return p;
}
