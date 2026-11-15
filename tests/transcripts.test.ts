import { expect, it } from "vitest";
import { blank, parseProject } from "../src/core/project";
import { annotation } from "../src/core/annotations";
import { titleShot, compileStoryboard } from "../src/core/storyboard";
import {
  parseTranscript,
  captionPhrases,
  generateTranscriptCaptions,
  replaceTranscript,
  quickCaption,
  alignNarrationTranscript,
} from "../src/core/transcripts";
import { importPgn } from "../src/core/chess";
import { shotFromMove } from "../src/core/storyboard";
const input = JSON.stringify({
  segments: [
    {
      words: Array.from({ length: 11 }, (_, i) => ({
        word: `word${i}`,
        start: i * 0.4,
        end: i * 0.4 + 0.35,
      })),
    },
  ],
});
it("aligns narration with both soundtrack trims and excludes inaudible speech", () => {
  const t = parseTranscript(input, "narration", "storyboard");
  const music = { ...blank().music, trimStart: 0.5, trimEnd: 2.1, offset: 1 };
  const result = alignNarrationTranscript(t, music);
  expect(result.offset).toBe(0.5);
  expect(result.words[0].start).toBe(0.5);
  expect(result.words.at(-1)!.end).toBe(2.1);
  expect(result.words.every((w) => w.start >= 0.5 && w.end <= 2.1)).toBe(true);
  expect(t.words).toHaveLength(11);
  expect(() =>
    alignNarrationTranscript(t, { ...music, trimStart: 10, trimEnd: 12 }),
  ).toThrow(/No recognized speech/);
});
it("parses actual word timestamps and creates at most five words per phrase without lost content", () => {
  const t = parseTranscript(input, "words", "source"),
    phrases = captionPhrases(t, 5);
  expect(phrases.map((p) => p.text.split(" ").length)).toEqual([5, 5, 1]);
  expect(phrases[1].start).toBe(2);
  expect(phrases.at(-1)!.end).toBeCloseTo(4.35);
  expect(phrases.flatMap((p) => p.text.split(" "))).toEqual(
    t.words.map((w) => w.text),
  );
  expect(() => captionPhrases(t, 0)).toThrow();
});
it.each([
  "1\n00:00:01,000 --> 00:00:03,000\nOne two three four five six\n",
  "WEBVTT\n\n00:01.000 --> 00:03.000 align:start\n<b>One two three four five six</b>\n",
])(
  "preserves cue provenance and explicitly estimates short phrases",
  (text) => {
    const t = parseTranscript(text, "subtitles", "storyboard");
    expect(t.words).toHaveLength(6);
    expect(t.words.every((w) => w.timing === "cue")).toBe(true);
    expect(t.words[5].start).toBe(1);
    const chunks = captionPhrases(t, 4);
    expect(chunks).toHaveLength(2);
    expect(chunks[1].start).toBeCloseTo(1 + (2 * 4) / 6);
  },
);
it("reads whisper.cpp millisecond offsets without claiming multiword cues are word-timed", () => {
  const t = parseTranscript(
    JSON.stringify({
      transcription: [
        { text: " Hello", offsets: { from: 100, to: 500 } },
        { text: " world now", offsets: { from: 500, to: 1000 } },
      ],
    }),
    "local",
    "source",
  );
  expect(t.words[0].start).toBe(0.1);
  expect(t.words[0].timing).toBe("word");
  expect(t.words[1].timing).toBe("cue");
});
it("rejects invalid/untimed input rather than inventing speech alignment", () => {
  for (const s of [
    "plain untimed text",
    "{}",
    JSON.stringify({ words: [{ word: "bad", start: 2, end: 1 }] }),
    "1\n00:00:02,000 --> 00:00:01,000\nInvalid",
    "1\n00:60:00,000 --> 01:00:01,000\nInvalid clock",
  ])
    expect(() => parseTranscript(s, "bad", "source")).toThrow();
});
it("splits multiword JSON rows as cue timing so word limits remain accurate", () => {
  const t = parseTranscript(
    JSON.stringify({
      words: [{ word: "one two three four five six", start: 0, end: 3 }],
    }),
    "cue JSON",
    "source",
  );
  expect(t.words).toHaveLength(6);
  expect(t.words.every((w) => w.timing === "cue")).toBe(true);
  expect(captionPhrases(t, 5).map((p) => p.text.split(" ").length)).toEqual([
    5, 1,
  ]);
});
it("rejects ambiguous equal-start phrases and does not mutate a project on failure", () => {
  const p = blank();
  p.tail = 10;
  const before = structuredClone(p);
  const t = parseTranscript(
    JSON.stringify({
      words: Array.from({ length: 6 }, (_, i) => ({
        word: `word${i}`,
        start: 1,
        end: 2,
      })),
    }),
    "ambiguous",
    "source",
  );
  expect(() => generateTranscriptCaptions(p, t, 5)).toThrow(/same timestamp/);
  expect(p).toEqual(before);
});
it.each(["move-range", "position-hold"] as const)(
  "avoids inherited generated source captions alongside output captions in %s shots",
  (kind) => {
    const p = importPgn(blank(), "1. e4 e5");
    const source = parseTranscript(input, "source", "source");
    generateTranscriptCaptions(p, source, 5);
    const manual = annotation("text", 0);
    manual.end = 30;
    p.annotations.push(manual);
    const shot = shotFromMove(p, p.moves[0].id, kind);
    shot.inheritAnnotations = true;
    p.storyboard.shots = [shot];
    const output = parseTranscript(input, "output", "storyboard");
    generateTranscriptCaptions(p, output, 5);
    const rendered = compileStoryboard(p).shots[0].project.annotations;
    expect(rendered.some((a) => a.transcriptId === source.id)).toBe(false);
    expect(rendered.some((a) => a.transcriptId === output.id)).toBe(true);
    expect(rendered.some((a) => a.id === `source-${manual.id}`)).toBe(true);
    expect(p.annotations.some((a) => a.transcriptId === source.id)).toBe(true);
  },
);
it("regenerates only its own captions, preserves manual text, and roundtrips metadata", () => {
  const p = blank();
  p.tail = 10;
  p.annotations = [annotation("text", 0)];
  const t = parseTranscript(input, "words", "source");
  generateTranscriptCaptions(p, t, 5);
  expect(p.annotations).toHaveLength(4);
  expect(p.annotations[0].transcriptId).toBeUndefined();
  generateTranscriptCaptions(p, t, 4);
  expect(p.annotations).toHaveLength(4);
  const next = parseTranscript(input, "replacement", "source");
  replaceTranscript(p, next);
  expect(p.transcripts![0].id).toBe(t.id);
  generateTranscriptCaptions(p, p.transcripts![0], 5);
  expect(p.annotations).toHaveLength(4);
  expect(parseProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
});
it("splits phrases across output shot boundaries and invalidates compiled draft projections", () => {
  const p = blank();
  p.storyboard.shots = [titleShot(p, "first", 2.5), titleShot(p, "second", 3)];
  const manual = structuredClone(p.storyboard.shots[0].annotations);
  const source = structuredClone(p.annotations);
  const t = parseTranscript(input, "words", "storyboard");
  compileStoryboard(p);
  generateTranscriptCaptions(p, t, 5);
  const a = p.storyboard.shots[0].annotations.filter((a) => a.transcriptId),
    b = p.storyboard.shots[1].annotations.filter((a) => a.transcriptId);
  expect(a.at(-1)!.end).toBe(2.5);
  expect(b[0].start).toBe(0);
  expect(a.at(-1)!.text).toBe(b[0].text);
  expect(p.annotations).toEqual(source);
  expect(p.storyboard.shots[0].annotations.slice(0, manual.length)).toEqual(
    manual,
  );
  expect(
    compileStoryboard(p).shots[1].project.annotations.some(
      (a) => a.transcriptId === t.id,
    ),
  ).toBe(true);
});
it("supports soundtrack offsets, clipping and quick captions at the end of a shot", () => {
  const p = blank();
  p.tail = 3;
  p.lead = 0;
  const t = parseTranscript(input, "words", "source");
  t.offset = -1;
  const result = generateTranscriptCaptions(p, t, 5);
  expect(result.count).toBeGreaterThan(0);
  expect(p.annotations.every((a) => a.start >= 0 && a.end <= 3)).toBe(true);
  const a = quickCaption(3, 3);
  expect(a.start).toBeCloseTo(2.95);
  expect(a.end).toBe(3);
  expect(a.entrance).toBe("none");
  expect(() => quickCaption(0, 0)).toThrow();
});
