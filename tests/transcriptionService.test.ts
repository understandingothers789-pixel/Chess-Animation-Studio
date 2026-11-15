import { expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { transcribeLocal } from "../desktop/transcription";
async function fixture(wait = false) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "whisper-service-test-")),
    audio = path.join(dir, "voice with spaces.wav"),
    binary = path.join(dir, "whisper fixture"),
    model = path.join(dir, "model.bin"),
    capture = path.join(dir, "arguments.json");
  execFileSync(process.env.FFMPEG_PATH ?? "ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=0.2",
    audio,
  ]);
  await fs.writeFile(model, "model fixture");
  await fs.writeFile(
    binary,
    `#!/usr/bin/env node\nconst fs=require('node:fs');const args=process.argv.slice(2);const prefix=args[args.indexOf('-of')+1];fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({args,prefix,pid:process.pid}));${wait ? "setTimeout(()=>{},60000);" : `fs.writeFileSync(prefix+'.json',JSON.stringify({transcription:[{text:' Hello',offsets:{from:0,to:400}},{text:' world',offsets:{from:400,to:900}}]}));`}`,
    { mode: 0o700 },
  );
  return { dir, audio, binary, model, capture };
}
// Windows exercises the real downloaded executable through packaged validation.
it.runIf(process.platform !== "win32")(
  "runs tools with argument arrays and removes private temporary audio",
  async () => {
    const f = await fixture();
    try {
      const t = await transcribeLocal({
        ...f,
        ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
        mode: "source",
      });
      expect(t.words.map((w) => w.text)).toEqual(["Hello", "world"]);
      const captured = JSON.parse(await fs.readFile(f.capture, "utf8"));
      expect(captured.args).toContain("-sow");
      expect(captured.args[captured.args.indexOf("-ml") + 1]).toBe("1");
      expect(
        await fs.stat(path.dirname(captured.prefix)).catch(() => null),
      ).toBeNull();
    } finally {
      await fs.rm(f.dir, { recursive: true, force: true });
    }
  },
  15000,
);
it.runIf(process.platform !== "win32")(
  "cancels the running recognizer and cleans temporary speech",
  async () => {
    const f = await fixture(true),
      controller = new AbortController();
    try {
      const pending = transcribeLocal({
        ...f,
        ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
        mode: "source",
        signal: controller.signal,
      });
      const check = pending.catch((e) => e);
      for (let i = 0; i < 500; i++) {
        if (await fs.stat(f.capture).catch(() => null)) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      const captured = JSON.parse(await fs.readFile(f.capture, "utf8"));
      controller.abort();
      expect((await check).message).toMatch(/cancelled/i);
      expect(
        await fs.stat(path.dirname(captured.prefix)).catch(() => null),
      ).toBeNull();
    } finally {
      controller.abort();
      await fs.rm(f.dir, { recursive: true, force: true });
    }
  },
  15000,
);
