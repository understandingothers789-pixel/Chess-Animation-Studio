import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseTranscript } from "../src/core/transcripts";
import type { PlaybackMode } from "../src/core/project";
export async function transcribeLocal(options: {
  audio: string;
  binary: string;
  model: string;
  ffmpeg: string;
  mode: PlaybackMode;
  signal?: AbortSignal;
}) {
  const { audio, binary, model, ffmpeg, signal, mode } = options;
  if (!binary || !model)
    throw Error("Choose a local whisper-cli executable and model first.");
  for (const file of [audio, binary, model]) {
    const stat = await fs.stat(file);
    if (!stat.isFile()) throw Error("Whisper input/tool/model must be a file.");
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "chess-transcript-"));
  const run = (tool: string, args: string[]) =>
    new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(Error("Transcription cancelled."));
        return;
      }
      const child = spawn(tool, args, {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      let error = "",
        settled = false;
      const abort = () => child.kill();
      signal?.addEventListener("abort", abort, { once: true });
      child.stderr.on("data", (chunk) => {
        error = (error + chunk.toString()).slice(-3000);
      });
      const end = (e?: Error) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        e ? reject(e) : resolve();
      };
      child.on("error", (e) => end(e));
      child.on("close", (code) =>
        end(
          signal?.aborted
            ? Error("Transcription cancelled.")
            : code !== 0
              ? Error(`Local transcription tool failed (${code}): ${error}`)
              : undefined,
        ),
      );
    });
  try {
    const wav = path.join(temp, "speech.wav"),
      prefix = path.join(temp, "speech");
    await run(ffmpeg || "ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      audio,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      wav,
    ]);
    await run(binary, [
      "-m",
      model,
      "-f",
      wav,
      "-oj",
      "-of",
      prefix,
      "-ml",
      "1",
      "-sow",
      "-l",
      "auto",
    ]);
    if (signal?.aborted) throw Error("Transcription cancelled.");
    const output = prefix + ".json";
    if ((await fs.stat(output)).size > 4_000_000)
      throw Error("Transcript exceeds 4 MB.");
    return parseTranscript(
      await fs.readFile(output, "utf8"),
      path.basename(audio),
      mode,
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}
