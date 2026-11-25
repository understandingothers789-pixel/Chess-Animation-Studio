import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { blank, type Asset } from "../src/core/project";
import { generateTranscriptCaptions } from "../src/core/transcripts";

const dir = path.resolve("test-results/transcript-desktop");
await fs.mkdir(dir, { recursive: true });
const profile = await fs.mkdtemp(
  path.join(os.tmpdir(), "chess speech with spaces-"),
);
const audio = path.join(profile, "speech sample.wav");
const bytes = process.env.TRANSCRIPT_SAMPLE_PATH
  ? await fs.readFile(process.env.TRANSCRIPT_SAMPLE_PATH)
  : await (async () => {
      const sample = await fetch(
        "https://raw.githubusercontent.com/ggml-org/whisper.cpp/4979e04f5dcaccb36057e059bbaed8a2f5288315/samples/jfk.wav",
      );
      assert.ok(sample.ok, "Official speech sample download failed");
      return Buffer.from(await sample.arrayBuffer());
    })();
assert.equal(
  createHash("sha256").update(bytes).digest("hex"),
  "59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e",
);
await fs.writeFile(audio, bytes);
const asset: Asset = {
  id: "speech",
  name: "Official Whisper sample",
  kind: "audio",
  path: audio,
  source: "whisper.cpp samples/jfk.wav",
  guidance: "Public speech test fixture",
};
const project = blank();
project.lead = 0;
project.tail = 12;
project.assets = [asset];
project.music.asset = asset.id;
project.music.sourceDuration = 11;
project.music.fadeIn = project.music.fadeOut = 0;
const file = path.join(profile, "speech.castudio");
await fs.writeFile(file, JSON.stringify(project));
const packed = process.env.STUDIO_PACKAGED_EXE;
const app = await electron.launch({
  ...(packed ? { executablePath: packed } : {}),
  args: [
    ...(packed ? [] : ["."]),
    ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
  env: { ...process.env, STUDIO_USER_DATA: profile, STUDIO_TEST: "1" },
  timeout: 60000,
});
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForSelector(".app-shell");
  await page.waitForFunction(() => !document.querySelector(".loading"));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await page.getByTitle("Open composition", { exact: true }).click();
  const captions = page.getByRole("button", {
    name: "Captions & transcript",
    exact: true,
  });
  const tools = page.getByRole("group", { name: "Preview tools menu" });
  if (await tools.getByRole("button", { name: /^Tools/ }).isVisible())
    await tools.getByRole("button", { name: /^Tools/ }).click();
  await captions.click();
  await page
    .getByText("Automatic transcription · local Whisper (optional)", {
      exact: true,
    })
    .click();
  if (process.platform === "win32") {
    await page
      .getByRole("button", { name: "Set up local transcription", exact: true })
      .click();
    await expect(page.getByText(/Local transcription is ready/)).toBeVisible({
      timeout: 180000,
    });
    // A second invocation reuses the completed package rather than downloading again.
    const cached = await page.evaluate(() => window.studio.whisperInstall());
    assert.ok(cached.whisper && cached.whisperModel);
  }
  await page
    .getByRole("button", { name: "Transcribe soundtrack locally", exact: true })
    .click();
  await expect(page.getByText(/Transcription ready/)).toBeVisible({
    timeout: 180000,
  });
  await page
    .getByRole("button", { name: "Generate short captions", exact: true })
    .click();
  // Verify the real UI saved the actual IPC result and generated ordinary captions.
  await page
    .getByRole("button", { name: "Close captions", exact: true })
    .click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Saved composition", { exact: true }),
  ).toBeVisible();
  const saved = JSON.parse(await fs.readFile(file, "utf8"));
  const transcript = saved.transcripts[0];
  const text = transcript.words.map((w: { text: string }) => w.text).join(" ");
  assert.match(text, /Americans/i);
  assert.ok(transcript.words.length > 10);
  assert.ok(
    transcript.words.every(
      (w: { start: number; end: number; timing: string }) =>
        w.end > w.start && w.timing === "word",
    ),
  );
  assert.ok(saved.annotations.length > 2);
  assert.ok(
    saved.annotations.every(
      (a: { text: string }) => a.text.split(/\s+/).length <= 5,
    ),
  );
  const expected = structuredClone(project);
  generateTranscriptCaptions(expected, transcript, 5);
  assert.deepEqual(
    saved.annotations.map((a: any) => [a.text, a.start, a.end]),
    expected.annotations.map((a) => [a.text, a.start, a.end]),
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(dir, "real-speech-captions.png") });
  await fs.writeFile(
    path.join(dir, "result.json"),
    JSON.stringify(
      {
        platform: process.platform,
        packaged: !!packed,
        words: transcript.words.length,
        captions: saved.annotations.length,
        text,
        oneClickSetup: process.platform === "win32",
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS: ${packed ? "packaged" : "desktop"} local speech recognition, ${transcript.words.length} timed words, ${saved.annotations.length} short captions and project save${process.platform === "win32" ? ", verified one-click GitHub setup and cache" : ""}`,
  );
} finally {
  await app.close();
  await fs.rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 300,
  });
}
