export const badgeSymbols: Readonly<Record<string, string>> = {
  book: "▤",
  brilliant: "!!",
  best: "★",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

const notationColors = {
  brilliant: "#4EB8F0",
  best: "#83CE60",
  good: "#83CE60",
  book: "#FFA878",
  inaccuracy: "#F3D253",
  mistake: "#F49A4A",
  blunder: "#E63336",
};

export const reviewColorDefaults = { enabled: true, ...notationColors };

export function notationColor(
  palette: typeof notationColors,
  rating: string | null,
) {
  return rating && Object.hasOwn(notationColors, rating)
    ? palette[rating as keyof typeof notationColors]
    : undefined;
}

export const mistakeLossCp = 50;

/** Convert current and saved engine results to the editor's automatic badges. */
export function engineNotation(
  loss: number,
  best: boolean,
  brilliant: boolean,
) {
  if (loss > mistakeLossCp) return "mistake";
  if (brilliant) return "brilliant";
  return best ? "best" : "good";
}

export function forcedMateLost(
  mate: number | undefined,
  bestMate: number | undefined,
) {
  return mate !== undefined && mate <= 0
    ? bestMate === undefined || bestMate > 0
    : bestMate !== undefined && bestMate > 0 && mate === undefined;
}

export function reviewNotation(review: {
  loss: number;
  score: number;
  mate?: number;
  bestMate?: number;
  label: string;
}) {
  const legacyWinningMate = review.mate === undefined && review.score >= 90000;
  const mateComparison =
    legacyWinningMate ||
    review.mate !== undefined ||
    review.bestMate !== undefined;
  return engineNotation(
    mateComparison
      ? forcedMateLost(review.mate, review.bestMate)
        ? mistakeLossCp + 1
        : 0
      : review.loss,
    review.label === "best",
    review.label === "brilliant",
  );
}
