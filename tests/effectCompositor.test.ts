import { describe, expect, it } from "vitest";
import { composePasses, executePasses } from "../src/render/effectCompositor";
describe("render pass compositor", () => {
  it("sorts by stage and priority without mutating inputs", () => {
    const passes = [
      { id: "overlay", stage: "overlay" as const },
      { id: "board2", stage: "board" as const, priority: 2 },
      { id: "background", stage: "background" as const },
      { id: "board1", stage: "board" as const, priority: 1 },
    ];
    expect(composePasses(0, passes).map(x => x.id)).toEqual(["background", "board1", "board2", "overlay"]);
    expect(passes[0].id).toBe("overlay");
  });
  it("filters by absolute time with exclusive end", () => {
    const passes = [{ id: "x", stage: "post" as const, start: 1, end: 2 }];
    expect(composePasses(1, passes)).toHaveLength(1);
    expect(composePasses(2, passes)).toHaveLength(0);
  });
  it("dispatches in order and rejects duplicates", () => {
    const out: string[] = [];
    executePasses(0, [{ id: "b", stage: "board" }, { id: "a", stage: "background" }], x => out.push(x.id));
    expect(out).toEqual(["a", "b"]);
    expect(() => composePasses(0, [{ id: "x", stage: "board" }, { id: "x", stage: "post" }])).toThrow();
  });
});

describe("effect dependency graph", () => {
  it("respects explicit dependencies within a stage", () => {
    const passes = [
      { id: "glow", stage: "post" as const, after: ["blur"] },
      { id: "blur", stage: "post" as const, priority: 100 },
    ];
    expect(composePasses(0, passes).map(pass => pass.id)).toEqual(["blur", "glow"]);
  });
  it("allows dependencies on inactive effects", () => {
    const passes = [
      { id: "dust", stage: "board" as const, start: 2, after: ["motion"] },
      { id: "motion", stage: "board" as const, end: 1 },
    ];
    expect(composePasses(2, passes).map(pass => pass.id)).toEqual(["dust"]);
  });
  it("rejects cycles, missing dependencies, and conflicting stage order", () => {
    expect(() => composePasses(0, [
      { id: "a", stage: "post", after: ["b"] },
      { id: "b", stage: "post", after: ["a"] },
    ])).toThrow(/Cycle/);
    expect(() => composePasses(0, [{ id: "a", stage: "post", after: ["missing"] }])).toThrow(/Unknown/);
    expect(() => composePasses(0, [
      { id: "background", stage: "background", after: ["overlay"] },
      { id: "overlay", stage: "overlay" },
    ])).toThrow(/Cycle/);
  });
  it("rejects invalid descriptors even when effects are disabled", () => {
    expect(() => composePasses(0, [{ id: "bad", stage: "post", enabled: false, priority: NaN }])).toThrow();
    expect(() => composePasses(0, [{ id: "bad", stage: "post", enabled: false, start: Infinity }])).toThrow();
  });
});
