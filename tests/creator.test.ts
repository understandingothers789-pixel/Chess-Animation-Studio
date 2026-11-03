import {sample} from "../src/core/chess";
import {evaluate,segments,curve} from "../src/core/timeline";
import { describe, it, expect } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { annotation, annotationOpacity } from "../src/core/annotations";
import { validateExport } from "../src/core/exportOptions";
describe("creator project annotations", () => {
  it("round trips all annotation types with exact timing and styling", () => {
    const p = blank();
    p.annotations = ["arrow", "circle", "text", "caption"].map((k) =>
      annotation(k as "arrow", 1),
    );
    p.annotations[2].text = "A fork\nWatch the queen";
    p.annotations[2].x = 0.3;
    expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("evaluates fades by absolute time without playback history", () => {
    const a = annotation("arrow", 1);
    a.fade = 0.5;
    expect(annotationOpacity(a, 0)).toBe(0);
    expect(annotationOpacity(a, 1.25)).toBe(0.5);
    expect(annotationOpacity(a, 2)).toBe(1);
    expect(annotationOpacity(a, 3.75)).toBe(0.5);
    expect(annotationOpacity(a, 4)).toBe(0);
    expect(annotationOpacity(a, 1.25)).toBe(0.5);
  });
  it("rejects malformed annotation ranges and squares", () => {
    const p = blank();
    p.annotations = [annotation("circle", 0)];
    p.annotations[0].end = 0;
    expect(() => parseProject(p)).toThrow();
    p.annotations[0].end = 1;
    p.annotations[0].from = "z9";
    expect(() => parseProject(p)).toThrow();
  });
});
describe("creator export requests", () => {
  it.each([24, 30, 60])("accepts %i FPS outside validation mode", (fps) => {
    const p = blank();
    expect(
      validateExport(p, {
        format: "landscape",
        start: 0,
        end: 1,
        width: 1280,
        height: 720,
        fps,
      }).fps,
    ).toBe(fps);
  });
  it("rejects invalid frames, aspect ratio and ranges before launching export", () => {
    const p = blank();
    for (const o of [
      { fps: 0 },
      { width: 999, height: 720 },
      { width: 640, height: 640 },
      { end: 9999 },
      { start: 2, end: 1 },
    ])
      expect(() =>
        validateExport(p, { format: "landscape", start: 0, end: 1, ...o }),
      ).toThrow();
  });
});

it('renders keyed camera values without an extra transition blend',()=>{const p=sample();const m=p.moves[0];m.effect.keys.cameraRotation=[{at:0,value:0,ease:'linear'},{at:1,value:90,ease:'linear'}];m.effect.keys.cameraTilt=[{at:0,value:0,ease:'linear'},{at:1,value:20,ease:'linear'}];const s=segments(p)[0],u=.5;const frame=evaluate(p,s.depart+u*m.effect.duration);expect(frame.camera.rotation).toBeCloseTo(curve(m.effect.keys.cameraRotation,u,0));expect(frame.camera.tilt).toBeCloseTo(10);});
