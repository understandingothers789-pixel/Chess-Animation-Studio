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

import { moveCommands } from "../src/ui/commands/moveCommands";
import type { Edit } from "../src/ui/state";
it("applies movement to a counted chess group in one transaction without touching timing or cameras", () => {
  const p = importPgn(blank(), "1. Nf3 Nf6 2. d4 d5 3. Nc3");
  p.moves[0].effect = effect("hop");
  p.moves[1].effect.locked = true;
  const before = structuredClone(p);
  let edits = 0;
  const edit = Object.assign(
    (_label: string, fn: (p: typeof before) => void) => {
      edits++;
      fn(p);
    },
    { begin: () => {}, end: () => {} },
  ) as Edit;
  const commands = moveCommands({
    p,
    index: 0,
    track: "move",
    checked: new Set(),
    edit,
    copied: { current: null },
    inspect: () => {},
    navigate: () => {},
    preview: () => {},
    report: () => {},
  });
  const apply = commands
    .find((a) => /^Apply .*settings to/.test(a.label))!
    .children!.find((a) => a.label === "Movement")!
    .children!.find((a) => a.label.startsWith("Knight moves"))!;
  expect(apply.label).toContain("3");
  apply.run!();
  expect(edits).toBe(1);
  const ids = moveGroups(before)["Knight moves"];
  for (let i = 0; i < p.moves.length; i++) {
    expect(p.moves[i].effect.duration).toBe(before.moves[i].effect.duration);
    expect(p.moves[i].effect.cameras).toEqual(before.moves[i].effect.cameras);
    expect(p.moves[i].effect.preset).toBe(
      ids.includes(p.moves[i].id) ? "hop" : before.moves[i].effect.preset,
    );
  }
});

import { annotation } from "../src/core/annotations";
import { annotationCommands } from "../src/ui/commands/annotationCommands";
it("duplicates annotations with distinct timing, identity and selected editor target", () => {
  const p = importPgn(blank(), "1. e4 e5"),
    a = annotation("text", 1);
  p.annotations.push(a);
  let selected = "";
  const edit = Object.assign(
    (_label: string, fn: (draft: typeof p) => void) => fn(p),
    { begin: () => {}, end: () => {} },
  ) as Edit;
  const actions = annotationCommands(
    p,
    a.id,
    0,
    1,
    edit,
    (_i, _s, id) => {
      selected = id!;
    },
    () => {},
    { current: null },
  );
  actions.find((a) => a.label === "Duplicate annotation")!.run!();
  const copy = p.annotations[1];
  expect(copy.id).not.toBe(a.id);
  expect(copy.start).toBeGreaterThan(a.start);
  expect(copy.color).toBe(a.color);
  expect(copy.x).toBeGreaterThan(a.x);
  expect(selected).toBe(copy.id);
});

it("does not retarget a stale move command onto a different move at the same array index", () => {
  const p = importPgn(blank(), "1. e4 e5");
  p.moves[1].effect.duration = 9;
  const edit = Object.assign(
    (_label: string, fn: (draft: typeof p) => void) => fn(p),
    { begin: () => {}, end: () => {} },
  ) as Edit;
  const commands = moveCommands({
    p,
    index: 0,
    track: "move",
    checked: new Set(),
    edit,
    copied: { current: null },
    inspect: () => {},
    navigate: () => {},
    preview: () => {},
    report: () => {},
  });
  p.moves.shift();
  commands
    .find((a) => a.label === "Speed / Duration")!
    .children!.find((a) => a.label === "Reset duration")!.run!();
  expect(p.moves[0].effect.duration).toBe(9);
});

it("reports preserved spotlight timing when applying visual effects to locked targets", () => {
  const p = importPgn(blank(), "1. e4 e5");
  p.moves[0].effect.jam.enabled = true;
  p.moves[0].effect.jam.duration = 4;
  p.moves[1].effect.locked = true;
  const before = structuredClone(p.moves[1].effect);
  let report = "";
  const edit = Object.assign(
    (_label: string, fn: (draft: typeof p) => void) => fn(p),
    { begin: () => {}, end: () => {} },
  ) as Edit;
  const commands = moveCommands({
    p,
    index: 0,
    track: "effect",
    checked: new Set(),
    edit,
    copied: { current: null },
    inspect: () => {},
    navigate: () => {},
    preview: () => {},
    report: (s) => {
      report = s;
    },
  });
  const group = commands
    .find((a) => /^Apply .*settings to/.test(a.label))!
    .children!.find((a) => a.label === "Effects")!
    .children!.find((a) => a.label.startsWith("All moves"))!;
  expect(group.label).toContain("1 timing locked");
  group.run!();
  expect(p.moves[1].effect.jam.enabled).toBe(before.jam.enabled);
  expect(p.moves[1].effect.jam.duration).toBe(before.jam.duration);
  expect(report).toContain("1 locked move kept its timing");
});
