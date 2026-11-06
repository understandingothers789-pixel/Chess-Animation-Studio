export type Point = { x: number; y: number };
export type MenuBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(n, hi));
/** Keep each whole hierarchy inside the viewport; compact mode is depth-limited. */
export function placeMenus(
  x: number,
  y: number,
  width: number,
  heights: number[],
  rowOffsets: number[],
  viewport: { width: number; height: number },
) {
  const margin = 8,
    gap = 3;
  width = Math.min(width, viewport.width - margin * 2);
  const capacity = Math.max(
    1,
    Math.floor((viewport.width - margin * 2 + gap) / (width + gap)),
  );
  const start = Math.max(0, heights.length - capacity),
    count = heights.length - start;
  const rootX = clamp(x, margin, viewport.width - width - margin);
  const direction = rootX + 2 * width + gap <= viewport.width - margin ? 1 : -1;
  const span = count * width + (count - 1) * gap;
  const left = clamp(
    direction === 1 ? rootX : rootX - span + width,
    margin,
    viewport.width - span - margin,
  );
  const boxes: MenuBox[] = [];
  for (let i = 0; i < count; i++) {
    const depth = start + i,
      height = Math.min(heights[depth], viewport.height - margin * 2);
    const top = clamp(
      i ? boxes[i - 1].top + rowOffsets[depth - 1] : y,
      margin,
      viewport.height - height - margin,
    );
    boxes.push({
      left: left + (direction === 1 ? i : count - i - 1) * (width + gap),
      top,
      width,
      height,
    });
  }
  return { boxes, start, direction };
}
/** The triangle facing a child tolerates a diagonal path over sibling rows. */
export function aimsAtMenu(from: Point, to: Point, child: MenuBox) {
  const right = child.left >= from.x;
  if ((to.x - from.x) * (right ? 1 : -1) <= 0) return false;
  const edge = right ? child.left : child.left + child.width;
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const a = from,
    b = { x: edge, y: child.top - 12 },
    c = { x: edge, y: child.top + child.height + 12 };
  const signs = [cross(a, b, to), cross(b, c, to), cross(c, a, to)];
  return !(signs.some((n) => n < 0) && signs.some((n) => n > 0));
}
