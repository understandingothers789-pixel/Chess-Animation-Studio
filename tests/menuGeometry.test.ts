import { describe, expect, it } from "vitest";
import { aimsAtMenu, placeMenus } from "../src/ui/timeline/menuGeometry";
describe("desktop menu hierarchy", () => {
  it("keeps three independent panels accessible at every desktop size, scale and edge", () => {
    for (const [vw, vh] of [
      [1100, 768],
      [1280, 720],
      [1440, 900],
      [1650, 900],
      [1920, 1080],
      [2560, 1440],
    ])
      for (const scale of [1, 1.1, 1.25, 1.5])
        for (const [x, y] of [
          [0, 0],
          [vw, 0],
          [0, vh],
          [vw, vh],
          [vw / 2, vh / 2],
        ]) {
          const placed = placeMenus(
            x,
            y,
            292 * scale,
            [450 * scale, 240 * scale, 650 * scale],
            [150, 140],
            { width: vw, height: vh },
          );
          for (const box of placed.boxes) {
            expect(box.left).toBeGreaterThanOrEqual(8);
            expect(box.top).toBeGreaterThanOrEqual(8);
            expect(box.left + box.width).toBeLessThanOrEqual(vw - 8 + 0.001);
            expect(box.top + box.height).toBeLessThanOrEqual(vh - 8 + 0.001);
          }
          for (let i = 1; i < placed.boxes.length; i++)
            expect(
              Math.abs(placed.boxes[i].left - placed.boxes[i - 1].left),
            ).toBeGreaterThanOrEqual(292 * scale);
          if (292 * scale * 3 + 22 <= vw) expect(placed.start).toBe(0);
        }
  });
  it("opens left at the right edge and only falls back when widths require it", () => {
    expect(
      placeMenus(1435, 890, 292, [400, 300], [200], {
        width: 1440,
        height: 900,
      }).direction,
    ).toBe(-1);
    expect(
      placeMenus(10, 10, 438, [400, 300, 500], [100, 150], {
        width: 700,
        height: 768,
      }).start,
    ).toBe(2);
  });
  it("recognizes natural diagonal intent for either opening direction", () => {
    const child = { left: 300, top: 50, width: 292, height: 450 };
    expect(aimsAtMenu({ x: 200, y: 100 }, { x: 240, y: 160 }, child)).toBe(
      true,
    );
    expect(aimsAtMenu({ x: 200, y: 100 }, { x: 190, y: 160 }, child)).toBe(
      false,
    );
    expect(aimsAtMenu({ x: 650, y: 100 }, { x: 620, y: 170 }, child)).toBe(
      true,
    );
    expect(aimsAtMenu({ x: 200, y: 100 }, { x: 240, y: 600 }, child)).toBe(
      false,
    );
  });
});
