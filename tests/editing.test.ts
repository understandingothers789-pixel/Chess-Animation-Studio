import { it, expect } from "vitest";
import { effect, blank } from "../src/core/project";
import { importPgn, importFen, appendMove } from "../src/core/chess";
import {
  pasteSettings,
  preserveLockedTiming,
  moveGroups,
  settingsKinds,
} from "../src/core/editing";
it("partitions selective paste and preserves locked timing and other format cameras", () => {
  const source = effect("hop"),
    target = effect("slide");
  source.duration = 8;
  source.capture.glow = 1.4;
  source.cameras.landscape = {
    x: 1,
    y: 2,
    zoom: 1,
    tilt: 0,
    rotation: 0,
    mode: "manual",
    padding: 1,
    transition: 0.2,
  };
  target.locked = true;
  for (const kind of settingsKinds) {
    const next = pasteSettings(target, { kind, source, format: "landscape" });
    expect(next.duration).toBe(target.duration);
    expect(next.locked).toBe(true);
    if (kind === "camera") {
      expect(next.preset).toBe("slide");
      expect(next.capture).toEqual(target.capture);
      expect(next.cameras.landscape).toEqual(source.cameras.landscape);
    }
    if (kind === "movement") {
      expect(next.preset).toBe("hop");
      expect(next.cameras).toEqual(target.cameras);
      expect(next.capture).toEqual(target.capture);
    }
    if (kind === "effects") {
      expect(next.capture).toEqual(source.capture);
      expect(next.preset).toBe("slide");
    }
  }
  const unlocked = effect();
  expect(
    pasteSettings(unlocked, { kind: "timing", source, format: "landscape" })
      .duration,
  ).toBe(8);
  const changed = effect();
  changed.duration = 15;
  preserveLockedTiming(target, changed);
  expect(changed.duration).toBe(target.duration);
});
it("classifies real chess moves including castling, checks, captures and promotions", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O");
  const g = moveGroups(p);
  expect(g["Knight moves"]).toHaveLength(3);
  expect(g.Castling).toHaveLength(1);
  const mate = moveGroups(importPgn(blank(), "1. f3 e5 2. g4 Qh4#"));
  expect(mate.Checkmates).toHaveLength(1);
  expect(mate.Checks).toHaveLength(1);
  const capture = moveGroups(importPgn(blank(), "1. e4 d5 2. exd5"));
  expect(capture.Captures).toHaveLength(1);
  const promo = appendMove(
    importFen(blank(), "7k/P7/8/8/8/8/8/7K w - - 0 1"),
    -1,
    "a7",
    "a8",
    "n",
  );
  expect(moveGroups(promo).Promotions).toHaveLength(1);
  expect(moveGroups(promo)["Pawn moves"]).toHaveLength(1);
});
