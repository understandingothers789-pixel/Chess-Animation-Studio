import { annotation, type Annotation } from "./annotations";
import type { Project, PlaybackMode } from "./project";
import {
  compileStoryboard,
  presentationDuration,
  invalidateStoryboard,
} from "./storyboard";
import {
  transcriptSchema,
  type TimedWord,
  type Transcript,
} from "./transcriptModel";
export type Phrase = { text: string; start: number; end: number };
const word = (
  text: string,
  start: number,
  end: number,
  timing: TimedWord["timing"],
): TimedWord => ({
  id: crypto.randomUUID(),
  text: text.trim(),
  start,
  end,
  timing,
});
const clock = (s: string) => {
  const parts = s.replace(",", ".").split(":").map(Number);
  if (
    parts.some((n) => !Number.isFinite(n) || n < 0) ||
    parts.length < 2 ||
    parts.length > 3 ||
    parts.slice(-2).some((n) => n >= 60)
  )
    throw Error("Invalid subtitle timestamp");
  return parts.reduce((a, n) => a * 60 + n, 0);
};
/** Accept actual word timings; cue imports keep their cue timing provenance. */
export function parseTranscript(
  input: string,
  name: string,
  mode: PlaybackMode,
): Transcript {
  if (input.length > 4_000_000) throw Error("Transcript exceeds 4 MB.");
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  let words: TimedWord[] = [];
  if (text.startsWith("{") || text.startsWith("[")) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data.words)
        ? data.words
        : data.segments?.flatMap((s: any) => s.words ?? []);
    if (Array.isArray(data.transcription)) {
      for (const cue of data.transcription) {
        const tokens = String(cue.text ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        for (const token of tokens)
          words.push(
            word(
              token,
              cue.offsets?.from / 1000,
              cue.offsets?.to / 1000,
              tokens.length === 1 ? "word" : "cue",
            ),
          );
      }
    } else {
      if (!Array.isArray(rows) || !rows.length)
        throw Error(
          "JSON must contain word timestamps (words or segments[].words with start/end).",
        );
      words = rows.flatMap((v: any) => {
        const tokens = String(v.word ?? v.text ?? "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        return tokens.map((token) =>
          word(token, v.start, v.end, tokens.length === 1 ? "word" : "cue"),
        );
      });
    }
  } else {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes("-->")) continue;
      const [from, to] = lines[i]
        .split("-->")
        .map((s) => s.trim().split(/\s/)[0]);
      const start = clock(from),
        end = clock(to);
      let content = "";
      while (i + 1 < lines.length && lines[i + 1].trim())
        content += (content ? " " : "") + lines[++i].replace(/<[^>]*>/g, "");
      const tokens = content.trim().split(/\s+/).filter(Boolean);
      for (const token of tokens) words.push(word(token, start, end, "cue"));
    }
  }
  if (!words.length)
    throw Error(
      "No timed words found. Import SRT, WebVTT, or word-timed Whisper JSON.",
    );
  // Preserve words in each cue; sort cues/words chronologically.
  words.sort((a, b) => a.start - b.start);
  return transcriptSchema.parse({
    id: crypto.randomUUID(),
    name,
    mode,
    offset: 0,
    words,
  });
}
/** Cue-only words share cue bounds. Estimate phrase timing within that cue only;
 * never label these estimates as individual speech-word timestamps. */
export function captionPhrases(t: Transcript, maxWords = 5): Phrase[] {
  if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > 12)
    throw Error("Choose 1–12 words per caption.");
  const adjusted: TimedWord[] = [];
  for (let i = 0; i < t.words.length; ) {
    const w = t.words[i];
    if (w.timing === "word") {
      adjusted.push(w);
      i++;
      continue;
    }
    let j = i + 1;
    while (
      j < t.words.length &&
      t.words[j].timing === "cue" &&
      t.words[j].start === w.start &&
      t.words[j].end === w.end
    )
      j++;
    for (let k = i; k < j; k++)
      adjusted.push({
        ...t.words[k],
        start: w.start + ((w.end - w.start) * (k - i)) / (j - i),
        end: w.start + ((w.end - w.start) * (k - i + 1)) / (j - i),
      });
    i = j;
  }
  const result: Phrase[] = [];
  let batch: TimedWord[] = [];
  const flush = () => {
    if (batch.length) {
      result.push({
        text: batch.map((w) => w.text).join(" "),
        start: batch[0].start + t.offset,
        end: Math.max(...batch.map((w) => w.end)) + t.offset,
      });
      batch = [];
    }
  };
  for (const w of adjusted) {
    if (
      batch.length &&
      (batch.length >= maxWords ||
        w.start - batch.at(-1)!.end > 0.7 ||
        /[.!?。！？]$/.test(batch.at(-1)!.text))
    )
      flush();
    batch.push(w);
  }
  flush();
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i + 1].start <= result[i].start)
      throw Error(
        "Word timings cannot form separate phrases at the same timestamp. Correct the timing or use a larger phrase size.",
      );
    result[i].end = Math.min(result[i].end, result[i + 1].start);
  }
  return result;
}
export function quickCaption(time: number, end: number): Annotation {
  if (!Number.isFinite(end) || end < 0.05)
    throw Error(
      "Add a shot or extend the composition before adding a caption.",
    );
  const start = Math.max(0, Math.min(time, end - 0.05));
  return {
    ...annotation("caption", start),
    text: "Your caption",
    end: Math.min(end, start + 3),
    entrance: "none",
    exit: "none",
    y: 0.82,
  };
}
export function replaceTranscript(p: Project, t: Transcript) {
  transcriptSchema.parse(t);
  const id = p.transcripts?.find((v) => v.mode === t.mode)?.id ?? t.id;
  p.transcripts = [
    ...(p.transcripts ?? []).filter((v) => v.mode !== t.mode),
    { ...structuredClone(t), id },
  ];
}
/** Generated phrases are ordinary editable annotations. Clip them at shot
 * boundaries in OUTPUT time, without changing source moves or audio mappings. */
export function generateTranscriptCaptions(
  p: Project,
  t: Transcript,
  maxWords: number,
) {
  t = { ...t, id: p.transcripts?.find((v) => v.mode === t.mode)?.id ?? t.id };
  const end = presentationDuration(p, t.mode);
  const outputWords = t.words.filter(
    (w) => w.end + t.offset > 0 && w.start + t.offset < end,
  );
  const phrases = captionPhrases({ ...t, words: outputWords }, maxWords);
  if (end < 0.05) throw Error("Add a shot or extend the composition first.");
  const make = (phrase: Phrase, start: number, finish: number) => ({
    ...annotation("caption", start),
    text: phrase.text,
    end: finish,
    entrance: "none" as const,
    exit: "none" as const,
    fade: 0,
    y: 0.82,
    transcriptId: t.id,
    layout: { ...annotation("caption", 0).layout, maxLines: 2, autoSize: true },
  });
  const visible = phrases.filter((v) => v.end > 0 && v.start < end);
  if (!visible.length)
    throw Error(
      "Transcript falls outside this timeline. Adjust its offset first.",
    );
  if (visible.some((v) => v.text.length > 500))
    throw Error(
      "A caption exceeds 500 characters. Use fewer words per caption.",
    );
  const ids = new Set(
    (p.transcripts ?? []).filter((v) => v.mode === t.mode).map((v) => v.id),
  );
  ids.add(t.id);
  let count = 0;
  if (t.mode === "source") {
    const keep = p.annotations.filter(
      (a) => !a.transcriptId || !ids.has(a.transcriptId),
    );
    const added = visible.map((v) =>
      make(v, Math.max(0, v.start), Math.min(end, v.end)),
    );
    if (keep.length + added.length > 5000)
      throw Error("Too many source captions (maximum 5,000).");
    p.annotations = [...keep, ...added];
    count = added.length;
  } else {
    const replacements = compileStoryboard(p).shots.map((e) => {
      const keep = e.shot.annotations.filter(
        (a) => !a.transcriptId || !ids.has(a.transcriptId),
      );
      const added = visible
        .filter((v) => v.start < e.end && v.end > e.start)
        .map((v) =>
          make(
            v,
            Math.max(0, v.start - e.start),
            Math.min(e.shot.duration, v.end - e.start),
          ),
        );
      if (keep.length + added.length > 2000)
        throw Error(`Too many captions in ${e.shot.name} (maximum 2,000).`);
      count += added.length;
      return { id: e.shot.id, annotations: [...keep, ...added] };
    });
    for (const r of replacements) {
      const shot = p.storyboard.shots.find((s) => s.id === r.id)!;
      shot.annotations = r.annotations;
    }
  }
  replaceTranscript(p, t);
  invalidateStoryboard(p);
  return { count, outside: t.words.length - outputWords.length };
}
