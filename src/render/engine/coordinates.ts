/** Board-local coordinates are independent of camera orientation. */
export { xy as squareToWorld } from "../../core/chess";
export const BOARD_HALF = 4;
export function worldToSquare(x: number, y: number): string | null {
  const file = Math.floor(x + BOARD_HALF),
    rank = Math.floor(y + BOARD_HALF);
  return file >= 0 && file < 8 && rank >= 0 && rank < 8
    ? String.fromCharCode(97 + file) + (rank + 1)
    : null;
}
export function orientationSign(orientation: "white" | "black") {
  return orientation === "white" ? 1 : -1;
}
