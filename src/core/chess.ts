import {
  Chess,
  DEFAULT_POSITION,
  type Square,
  type PieceSymbol,
  type Color,
} from "chess.js";
import {
  blankProject,
  effectPreset,
  type Project,
  type ProjectMove,
} from "./model";

export interface PieceState {
  id: string;
  type: PieceSymbol;
  color: Color;
  square: Square;
}
export interface ChessStep {
  move: ProjectMove;
  before: PieceState[];
  after: PieceState[];
  from: Square;
  to: Square;
  pieceId: string;
  captureId?: string;
  rook?: { id: string; from: Square; to: Square };
  promotion?: PieceSymbol;
  beforeFen: string;
  afterFen: string;
  check: boolean;
  mate: boolean;
}
export interface Game {
  initial: PieceState[];
  steps: ChessStep[];
  finalFen: string;
  terminal: boolean;
}
export function hash(s: string): string {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(36);
}
export function squareXY(s: string): [number, number] {
  return [s.charCodeAt(0) - 97 - 3.5, Number(s[1]) - 1 - 3.5];
}
export function buildGame(p: Pick<Project, "startFen" | "moves">): Game {
  const chess = new Chess(p.startFen);
  let pieces: PieceState[] = chess
    .board()
    .flat()
    .filter((x) => x !== null)
    .map((x) => ({
      id: `piece-${hash(p.startFen)}-${x.square}`,
      type: x.type,
      color: x.color,
      square: x.square,
    }));
  const initial = structuredClone(pieces),
    steps: ChessStep[] = [];
  for (const pm of p.moves) {
    const before = structuredClone(pieces),
      beforeFen = chess.fen();
    const m = chess.move({
      from: pm.uci.slice(0, 2),
      to: pm.uci.slice(2, 4),
      promotion: pm.uci[4],
    });
    if (m.san !== pm.san)
      throw new Error(`Move ${steps.length + 1} has inconsistent notation.`);
    const piece = pieces.find((x) => x.square === m.from)!;
    const captureSquare = m.isEnPassant() ? `${m.to[0]}${m.from[1]}` : m.to;
    const captured = m.captured
      ? pieces.find((x) => x.square === captureSquare)
      : undefined;
    pieces = pieces.filter((x) => x.id !== captured?.id);
    piece.square = m.to;
    if (m.promotion) piece.type = m.promotion;
    let rook: ChessStep["rook"];
    if (m.isKingsideCastle() || m.isQueensideCastle()) {
      const from = `${m.isKingsideCastle() ? "h" : "a"}${m.from[1]}` as Square;
      const to = `${m.isKingsideCastle() ? "f" : "d"}${m.from[1]}` as Square;
      const r = pieces.find((x) => x.square === from)!;
      rook = { id: r.id, from, to };
      r.square = to;
    }
    steps.push({
      move: pm,
      before,
      after: structuredClone(pieces),
      from: m.from,
      to: m.to,
      pieceId: piece.id,
      captureId: captured?.id,
      rook,
      promotion: m.promotion,
      beforeFen,
      afterFen: chess.fen(),
      check: chess.isCheck(),
      mate: chess.isCheckmate(),
    });
  }
  return {
    initial,
    steps,
    finalFen: chess.fen(),
    terminal: chess.isGameOver(),
  };
}

export function parsePgn(raw: string): {
  startFen: string;
  lines: Project["lines"];
} {
  if (raw.length > 2_000_000)
    throw new Error("PGN is too large (maximum 2 MB).");
  const fen = raw.match(/\[FEN\s+"([^"]+)"\]/i)?.[1] ?? DEFAULT_POSITION;
  new Chess(fen);
  const tokens =
    raw
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\{[^}]*\}/gs, " ")
      .replace(/;[^\r\n]*/g, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\d+\.(\.\.)?/g, " ")
      .match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const alternatives: string[][] = [];
  const line = (prefix: string[], nested = false): string[] => {
    const sans = [...prefix];
    while (at < tokens.length) {
      const token = tokens[at++];
      if (token === "(") {
        if (!sans.length)
          throw new Error("A variation needs a preceding move.");
        alternatives.push(line(sans.slice(0, -1), true));
      } else if (token === ")") {
        if (!nested) throw new Error("Unexpected closing variation.");
        return sans;
      } else if (!["1-0", "0-1", "1/2-1/2", "*", "..."].includes(token))
        sans.push(token.replace(/[!?]+$/, ""));
    }
    if (nested) throw new Error("Unclosed PGN variation.");
    return sans;
  };
  const main = line([]);
  const unique = [main, ...alternatives].filter(
    (v, i, a) => a.findIndex((w) => w.join(" ") === v.join(" ")) === i,
  );
  if (unique.length > 500 || unique.some((v) => v.length > 5000))
    throw new Error("Too many moves or variations.");
  return {
    startFen: fen,
    lines: unique.map((sans, i) => {
      const chess = new Chess(fen);
      return {
        name:
          i === 0 ? "Main line" : `Variation ${i}: ${sans.slice(-4).join(" ")}`,
        sans: sans.map((s) => chess.move(s).san),
      };
    }),
  };
}
export function setLine(
  p: Project,
  sans: string[],
  startFen = p.startFen,
): Project {
  const chess = new Chess(startFen),
    old = new Map(p.moves.map((m) => [m.id, m]));
  let prefix = startFen;
  const moves = sans.map((s) => {
    const m = chess.move(s),
      uci = m.from + m.to + (m.promotion ?? "");
    prefix += " " + uci;
    const id = `move-${hash(prefix)}`;
    return (
      old.get(id) ?? {
        id,
        uci,
        san: m.san,
        effect: structuredClone(p.defaults),
        analysis: {},
      }
    );
  });
  return { ...p, startFen, moves };
}
export function importPgn(p: Project, raw: string): Project {
  const { startFen, lines } = parsePgn(raw);
  return {
    ...setLine(p, lines[0].sans, startFen),
    rawPgn: raw,
    lines,
    selectedLine: 0,
  };
}
export function importFen(p: Project, fen: string): Project {
  const startFen = new Chess(fen.trim()).fen();
  return {
    ...p,
    startFen,
    moves: [],
    rawPgn: "",
    lines: [{ name: "FEN position", sans: [] }],
    selectedLine: 0,
  };
}
export function appendMove(
  p: Project,
  uci: string,
  through = p.moves.length,
): Project {
  const c = new Chess(p.startFen);
  for (const m of p.moves.slice(0, through)) c.move(m.san);
  const m = c.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] ?? "q",
  });
  const sans = [...p.moves.slice(0, through).map((m) => m.san), m.san];
  const next = setLine(p, sans),
    lines = [...p.lines, { name: `Board line ${p.lines.length}`, sans }];
  return { ...next, lines, selectedLine: lines.length - 1 };
}
export function sampleProject(): Project {
  let p = importPgn(
    blankProject(),
    '[Event "Opera Game · Paris 1858"]\n[White "Paul Morphy"]\n[Black "Duke & Count"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',
  );
  p.title = "The Opera Game";
  p.moves[2].effect = effectPreset("spin");
  p.moves[4].effect = effectPreset("dramatic");
  p.moves[6].effect = effectPreset("capture");
  p.moves[6].effect.badge.manual = "brilliant";
  return p;
}
