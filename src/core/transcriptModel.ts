import { z } from "zod";
export const timedWordSchema = z
  .object({
    id: z.string().min(1).max(100),
    text: z
      .string()
      .min(1)
      .max(500)
      .refine((v) => !/\s/.test(v), {
        message: "Enter one word; edit full phrases in the caption inspector.",
      }),
    start: z.number().finite().min(0).max(86400),
    end: z.number().finite().min(0).max(86400),
    timing: z.enum(["word", "cue"]),
  })
  .refine((w) => w.end > w.start, { message: "Word end must follow start" });
export const transcriptSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().max(200),
    mode: z.enum(["source", "storyboard"]),
    offset: z.number().finite().min(-86400).max(86400),
    words: z.array(timedWordSchema).min(1).max(50000),
  })
  .refine((t) => new Set(t.words.map((w) => w.id)).size === t.words.length, {
    message: "Duplicate transcript word identities",
  })
  .refine(
    (t) => t.words.every((w, i) => i === 0 || w.start >= t.words[i - 1].start),
    { message: "Transcript words must be in time order" },
  );
export type TimedWord = z.infer<typeof timedWordSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;
