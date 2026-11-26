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
