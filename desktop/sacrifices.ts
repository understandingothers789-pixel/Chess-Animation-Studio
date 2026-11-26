import { Chess, type Color, type Move } from "chess.js";

const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const materialThreshold = 1;
export const sacrificeDepth = 12;

export const replyUci = (move: Move) =>
  move.from + move.to + (move.promotion ?? "");

function balance(position: Chess, mover: Color) {
  return position
    .board()
    .flat()
    .reduce(
      (total, piece) =>
        piece
          ? total + (piece.color === mover ? 1 : -1) * values[piece.type]
          : total,
      0,
    );
}

export function sacrificeCandidates(fen: string, played: string) {
  const before = new Chess(fen);
  const mover = before.turn();
  const baseline = balance(before, mover);
  const after = new Chess(fen);
  const move = after.move(played);
  const replies = after.moves({ verbose: true }).filter((reply) => {
    if (!reply.captured || reply.captured === "p") return false;
    // A piece that was already under attack by this opponent is not a new offer.
    if (
      reply.to !== move.to &&
      before.attackers(reply.to, reply.color).includes(reply.from)
    )
      return false;
    return (
      baseline - balance(new Chess(reply.after), mover) >= materialThreshold
    );
  });
  return { mover, baseline, after, replies };
}

export function sacrificeLine(
  candidate: ReturnType<typeof sacrificeCandidates>,
  variation: readonly string[],
) {
  const reply = candidate.replies.find(
    (move) => replyUci(move) === variation[0],
  );
  if (!reply || !variation[1]) return undefined;
  const continuation = new Chess(reply.after);
  try {
    const answer = continuation.move(variation[1]);
    const material =
      candidate.baseline - balance(continuation, candidate.mover);
    if (material >= materialThreshold)
      return { reply: reply.san, continuation: answer.san, material };
  } catch {
    // Incomplete or illegal engine continuations cannot confirm a sacrifice.
  }
}
