import { it, expect } from "vitest";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { audioEvents } from "../src/core/audioEvents";
import { shotFromMove, duplicateShot } from "../src/core/storyboard";
import { segments } from "../src/core/timeline";
it("maps chess/knight/capture cues into reordered shots once per occurrence", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6");
  p.audio.knightHorse = true;
  const knight = shotFromMove(p, p.moves[2].id),
    capture = shotFromMove(p, p.moves[6].id);
  knight.duration = 4;
  capture.duration = 2;
  p.storyboard.shots = [capture, knight, duplicateShot(knight)];
  const events = audioEvents(p, "storyboard");
  expect(events.filter((e) => e.kind === "capture")).toHaveLength(1);
  expect(events.filter((e) => e.asset === "__knightHorse")).toHaveLength(2);
  expect(events.filter((e) => e.kind === "move")).toHaveLength(2);
  expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  for (const e of events) expect(e.end).toBeLessThanOrEqual(10);
  expect(p.moves.map((m) => m.san)).toEqual([
    "e4",
    "e5",
    "Nf3",
    "Nc6",
    "Bb5",
    "a6",
    "Bxc6",
    "dxc6",
  ]);
});
it("does not schedule skipped moves or move sounds during position holds", () => {
  const p = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
  p.audio.knightHorse = true;
  p.storyboard.shots = [shotFromMove(p, p.moves[2].id, "position-hold")];
  expect(audioEvents(p, "storyboard")).toEqual([]);
});
it("uses the same clipped cue intervals for preview and export at source cuts", () => {
  const p = importPgn(blank(), "1. Nf3 Nc6");
  p.audio.automatic = false;
  p.audio.knightHorse = true;
  p.audio.knightOffset = -1;
  p.audio.knightDuration = 4;
  const s = shotFromMove(p, p.moves[0].id);
  s.duration = 0.6;
  s.trimStart = 0.2;
  p.storyboard.shots = [s];
  const cue = audioEvents(p, "storyboard")[0];
  expect(cue.at).toBeGreaterThanOrEqual(0);
  expect(cue.end).toBe(0.6);
  expect(cue.end - cue.at).toBeLessThanOrEqual(0.6);
  expect(audioEvents(p, "storyboard")).toBe(audioEvents(p, "storyboard"));
});
it("resolves decimal cut boundaries without leaking one frame from the preceding shot", async () => {
  const { resolveStoryboardFrame, titleShot } = await import(
    "../src/core/storyboard"
  );
  const p = blank();
  p.storyboard.shots = [
    titleShot(p, "A", 0.1),
    titleShot(p, "B", 0.2),
    titleShot(p, "C", 0.1),
  ];
  expect(resolveStoryboardFrame(p, 0.3)?.shot.name).toBe("C");
});
