import { Chess } from "chess.js";
import { annotation } from "./annotations";
import { buildGame, type Step } from "./chess";
import { camera, type Project, type StoryboardShot } from "./project";
import { shotFromMove, titleShot, shotCaption } from "./storyboard";
import { moveGroups } from "./editing";
export function moveShort(p: Project, id: string): StoryboardShot[] {
  const before = shotFromMove(p, id, "position-hold", "before");
  before.name = "Opening position";
  before.duration = 2;
  const after = shotFromMove(p, id, "position-hold", "after");
  after.name = "Final position";
  after.duration = 2.5;
  return [before, shotFromMove(p, id), after];
}

export const storyTemplates = [
  "Puzzle Challenge",
  "Opening Trap",
  "Combination",
  "Game Highlights",
  "Checkmate Reveal",
  "Tactical Breakdown",
] as const;
export type StoryTemplate = (typeof storyTemplates)[number];
export const countdownLengths = [2, 3, 5] as const;
export type CountdownLength = (typeof countdownLengths)[number];

const pieceName: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

function moveResult(step: Step, chess: Chess) {
  const san = step.move.san;
  const captured = step.before.find((piece) => piece.id === step.capturedId);
  if (chess.isCheckmate()) return `Checkmate · ${san}`;
  if (step.rook)
    return step.to[0] === "g" ? "Kingside castling" : "Queenside castling";
  const promotion = step.promotion;
  if (promotion) return `Promotion to ${pieceName[promotion]} · ${san}`;
  if (captured && captured.square !== step.to) return `En passant · ${san}`;
  if (captured) return `Captures a ${pieceName[captured.type]} · ${san}`;
  if (chess.isCheck()) return `Check · ${san}`;
  return `Played move · ${san}`;
}

function mark(
  kind: "arrow" | "circle",
  from: string,
  to: string,
  color: string,
  duration: number,
) {
  return {
    ...annotation(kind, 0),
    from,
    to,
    color,
    end: duration,
    width: kind === "circle" ? 0.05 : 0.085,
    opacity: 0.9,
  };
}

function tacticalBreakdown(p: Project, id: string): StoryboardShot[] {
  const step = buildGame(p).steps.find(({ move }) => move.id === id);
  if (!step) throw Error("Choose a source move.");
  const before = shotFromMove(p, id, "position-hold", "before");
  before.name = "Tactical setup";
  before.camera = { ...camera(), mode: "full" };
  before.duration = 1.65;
  before.annotations = [
    shotCaption(p, "Watch this piece", before.duration),
    mark("circle", step.from, step.from, "#FFD690", before.duration),
  ];

  const after = shotFromMove(p, id, "position-hold", "after");
  after.name = "Tactical breakdown";
  after.camera = { ...camera(), mode: "full" };
  after.duration = 2.7;
  const chess = new Chess(step.fen);
  const attacker = chess.turn();
  chess.move(step.move.san);
  after.annotations = [
    shotCaption(p, moveResult(step, chess), after.duration),
    mark("arrow", step.from, step.to, "#65DBEC", after.duration),
  ];
  if (step.rook)
    after.annotations.push(
      mark("arrow", step.rook.from, step.rook.to, "#FFD690", after.duration),
    );
  if (chess.isCheck()) {
    const king = chess.findPiece({ type: "k", color: chess.turn() })[0];
    after.annotations.push(
      mark("circle", king, king, "#FF7588", after.duration),
    );
    for (const from of chess.attackers(king, attacker))
      after.annotations.push(
        mark("arrow", from, king, "#FF7588", after.duration),
      );
  } else {
    after.annotations.push(
      mark("circle", step.to, step.to, "#FFD690", after.duration),
    );
  }

  return [before, shotFromMove(p, id), after];
}

export function createStoryTemplate(
  p: Project,
  template: StoryTemplate,
  ids: string[],
  countdown: CountdownLength = 3,
): StoryboardShot[] {
  const valid = ids.filter((id) => p.moves.some((m) => m.id === id));
  if (!valid.length)
    throw Error("Choose at least one source move for this template.");
  const anchor = valid[0],
    last = valid.at(-1)!;
  const hold = (
    id: string,
    position: "before" | "after",
    text: string,
    duration = 3,
  ) => {
    const s = shotFromMove(p, id, "position-hold", position);
    s.duration = duration;
    s.name = text;
    s.annotations = [shotCaption(p, text, duration)];
    return s;
  };
  const move = (id: string, name?: string) => {
    const s = shotFromMove(p, id);
    if (name) s.name = name;
    return s;
  };
  if (template === "Tactical Breakdown") return tacticalBreakdown(p, anchor);
  if (template === "Puzzle Challenge") {
    const puzzle = hold(anchor, "before", "Can you find the move?", countdown);
    puzzle.name = "Puzzle countdown";
    puzzle.camera = { ...camera(), mode: "full" };
    const vertical =
      p.format === "vertical" || p.format === "square-in-vertical";
    for (let second = 0; second < countdown; second++) {
      puzzle.annotations.push({
        ...annotation("text", second),
        text: String(countdown - second),
        size: vertical ? 112 : 80,
        y: vertical ? 0.79 : 0.82,
        color: "#FFD690",
        end: second + 1,
        entrance: "none",
        exit: "none",
      });
    }
    const san = p.moves.find((m) => m.id === anchor)!.san;
    return [
      puzzle,
      move(anchor, "The reveal"),
      hold(anchor, "after", `Played move · ${san}`, 2.4),
    ];
  }
  if (template === "Checkmate Reveal") {
    const mate = valid.find((id) => moveGroups(p).Checkmates.includes(id));
    if (!mate)
      throw Error("Choose a checkmate move. No checkmate is selected.");
    return [
      hold(mate, "before", "Find checkmate", 3),
      move(mate, "Checkmate"),
      hold(mate, "after", "Checkmate", 3),
    ];
  }
  if (template === "Game Highlights")
    return [
      titleShot(p, p.title, 2.5),
      ...valid.slice(0, 12).map((id) => move(id)),
      hold(last, "after", "Final position", 3),
    ];
  if (template === "Opening Trap") {
    if (valid.length < 2)
      throw Error(
        "Choose at least two source moves for the setup and continuation.",
      );
    return [
      titleShot(p, "A closer look at the opening", 2.5),
      hold(anchor, "before", "The setup", 3),
      move(anchor),
      hold(last, "before", "What happens next?", 3),
      ...valid.slice(1).map((id) => move(id)),
      hold(last, "after", "Add your lesson here", 3),
    ];
  }
  return [
    hold(anchor, "before", "Study the position", 3),
    ...valid.map((id) => move(id)),
    hold(last, "after", "Explain the continuation", 4),
  ];
}
