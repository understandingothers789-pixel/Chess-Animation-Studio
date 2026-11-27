import { expect, it } from "vitest";
import { blank } from "../src/core/project";
import { buildGame, importPgn, selectLine } from "../src/core/chess";
import {
  compileStoryboard,
  shotFromMove,
  sourceToStoryboard,
} from "../src/core/storyboard";
import { audioEvents } from "../src/core/audioEvents";
import { requiredAssetIds } from "../src/core/exportAssets";
import { segments } from "../src/core/timeline";
import { reconcileBeatPins } from "../src/core/beatPins";
import { syncMarkers } from "../src/core/audio";
import { filmLayout, squareVideoFrame } from "../src/core/introVideo";

it("keeps a shot and its assets and sounds linked to the original variation", () => {
  const p = importPgn(blank(), "1. e4 (1. d4 d5) e5 2. Nf3");
  const original = p.moves[1];
  original.effect.preMoveMeme = { asset: "reaction", duration: 0.4 };
  p.storyboard.shots = [shotFromMove(p, original.id)];
  const alternate = selectLine(p, 1);
  const shot = compileStoryboard(alternate).shots[0];
  expect(shot.issue).toBeNull();
  expect(shot.sourceLine).toBe(0);
  expect(shot.project.moves[0].san).toBe("e5");
  expect(
    audioEvents(alternate, "storyboard").some(
      (event) => event.moveId === original.id,
    ),
  ).toBe(true);
  expect(
    requiredAssetIds(alternate, {
      mode: "storyboard",
      start: 0,
      end: shot.end,
      format: "vertical",
    }).has("reaction"),
  ).toBe(true);
});

it("moves a source landing with its soundtrack marker while respecting locked timing", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3");
  const land = segments(p)[1].land;
  p.beats = [
    { id: "hit", enabled: true, accent: true, time: land, sourceTime: land },
  ];
  p.moves[1].effect.landingBeat = "hit";
  p.music.offset = 0.25;
  const shifted = reconcileBeatPins(syncMarkers(p));
  expect(segments(shifted)[1].land).toBeCloseTo(land + 0.25, 8);
  const locked = structuredClone(p);
  locked.moves[1].effect.locked = true;
  expect(segments(reconcileBeatPins(syncMarkers(locked)))[1].land).toBeCloseTo(
    land,
    8,
  );
});

it("keeps a storyboard pin on the output beat through a soundtrack offset", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3");
  const key = p.moves[1].id;
  const seg = segments(p)[1];
  const shot = {
    ...shotFromMove(p, key),
    duration: 3,
    beatPin: { beatId: "beat", moveId: key, event: "landing" as const },
  };
  p.storyboard.shots = [shot];
  p.storyboard.beats = [
    { id: "beat", time: 1.4, sourceTime: 1.4, enabled: true, accent: true },
  ];
  expect(sourceToStoryboard(p, seg.land)[0].time).toBeCloseTo(1.4, 8);
  const shifted = { ...p, music: { ...p.music, offset: 0.25 } };
  expect(sourceToStoryboard(shifted, seg.land)[0].time).toBeCloseTo(1.65, 8);
  expect(
    compileStoryboard({ ...p, music: { ...p.music, offset: 6 } }).shots[0]
      .pinIssue,
  ).toMatch(/outside/);
});

it("reuses positions after an effect edit without keeping stale move settings", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
  const before = buildGame(p);
  const edited = {
    ...p,
    moves: p.moves.map((m, i) =>
      i === 0 ? { ...m, effect: { ...m.effect, scale: 1.8 } } : m,
    ),
  };
  const after = buildGame(edited);
  expect(after.steps[0].before).toBe(before.steps[0].before);
  expect(after.steps[0].move.effect.scale).toBe(1.8);
});

it("keeps animated footage within texture bounds and honors loop or fade", () => {
  const p = blank();
  p.lead = 6;
  p.squareIntro = {
    asset: "clip",
    square: "e4",
    hold: 3,
    pullback: 2,
    endMode: "loop",
  };
  const film = filmLayout(2, true);
  p.assets = [
    {
      id: "clip",
      kind: "filmstrip",
      name: "clip",
      path: "clip.jpg",
      source: "",
      guidance: "",
      film,
    },
  ];
  const loop = squareVideoFrame(p, 2.1)!;
  expect([loop.column, loop.row]).toEqual([3, 0]);
  p.squareIntro.endMode = "fade";
  expect(squareVideoFrame(p, 2.1)?.opacity).toBe(0);
  const longer = filmLayout(6, true);
  expect(longer.frames).toBe(180);
  expect(longer.fps).toBe(30);
  expect(
    Math.max(longer.columns, longer.rows) * longer.cell,
  ).toBeLessThanOrEqual(4096);
});
