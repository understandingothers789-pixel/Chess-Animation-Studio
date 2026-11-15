import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { blank } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { titleShot, shotFromMove } from "../src/core/storyboard";
const fixture = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6");
fixture.format = "vertical";
fixture.storyboard.shots = [
  shotFromMove(fixture, fixture.moves[0].id, "position-hold", "after"),
  titleShot(fixture, "Transition title", 1),
  shotFromMove(fixture, fixture.moves[3].id),
];
fixture.storyboard.shots[0].duration = 4;
fixture.storyboard.shots[2].duration = 1;
fixture.storyboard.shots[2].preHold = 0;
fixture.storyboard.shots[2].postHold = 0;
const audio: Record<string, string> = {};
fixture.storyboard.shots[0].inheritAnnotations = false;
fixture.annotations = [];
fixture.storyboard.shots[0].annotations = [];
const evidenceDir = process.env.TRANSCRIPT_EVIDENCE_DIR ?? "work/transcript-ui";
await fs.mkdir(evidenceDir, { recursive: true });
const port = process.env.COMPOSITION_PORT ?? "5199",
  origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", port, "--strictPort"],
  { stdio: "pipe" },
);
let browser;
let page: import("@playwright/test").Page | undefined;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Page error:", e.message);
  });
  page.setDefaultTimeout(90000);
  await page.addInitScript(
    ({ fixture, audio }) => {
      const w = window as any;
      w.__name = (f: any) => f;
      w.__stored = fixture;
      w.studio = {
        settings: async () => ({
          ffmpeg: "ffmpeg",
          stockfish: "",
          encoder: "software",
          tokenPresent: false,
        }),
        recent: async () => [],
        recover: async () => null,
        onAnalysis: () => () => {},
        onExport: () => () => {},
        autosave: async () => {},
        present: (s: any) => {
          w.__state = s;
        },
        assetStatus: async () => ({}),
        assetData: async (a: any) => audio[a.id],
        open: async () => ({
          project: structuredClone(w.__stored),
          path: "/test/duck.castudio",
        }),
        save: async (p: any) => {
          w.__stored = structuredClone(p);
          return "/test/duck.castudio";
        },
      };
    },
    { fixture, audio },
  );
  await page.goto(origin);
  await page.getByTitle("Open composition", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(3);
  await page.locator(".shot-card").first().click();
  const state = () => page!.evaluate(() => (window as any).__state.project);
  const settleGeometry = () =>
    page!.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  await page.getByRole("button", { name: "Add caption", exact: true }).click();
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    "Your caption",
  );
  await page
    .getByLabel("Shot caption", { exact: true })
    .fill("Manual introduction");
  const manual = (await state()).storyboard.shots[0].annotations[0];
  await page
    .getByRole("button", { name: "Captions & transcript", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Captions and transcript" }),
  ).toBeVisible();
  await page
    .getByText("Paste timed transcript · SRT, WebVTT or word-timed JSON", {
      exact: true,
    })
    .click();
  const texts =
    "This is a brilliant move that wins the queen in one turn".split(" ");
  const input = JSON.stringify({
    words: texts.map((word, i) => ({
      word,
      start: i * 0.45,
      end: i * 0.45 + 0.4,
    })),
  });
  await page.getByLabel("Timed transcript text", { exact: true }).fill(input);
  await page
    .getByRole("button", { name: "Use pasted transcript", exact: true })
    .click();
  await expect(page.locator(".transcript-words button")).toHaveCount(12);
  await page
    .getByRole("button", {
      name: "Seek word queen at 3.60 seconds",
      exact: true,
    })
    .click();
  assert(
    Math.abs((await page.evaluate(() => (window as any).__state.time)) - 3.6) <
      1e-8,
  );
  await page
    .getByRole("button", { name: "Generate short captions", exact: true })
    .click();
  await expect(page.getByText(/Generated 5 captions/)).toBeVisible();
  const generated = (await state()).storyboard.shots.flatMap((s: any) =>
    s.annotations.filter((a: any) => a.transcriptId),
  );
  assert.equal(generated.length, 5);
  assert(generated.every((a: any) => a.text.split(/\s+/).length <= 5));
  await page.screenshot({ path: `${evidenceDir}/clickable-transcript.png` });
  await page
    .getByRole("button", { name: "Close captions", exact: true })
    .click();
  await settleGeometry();
  const caption = page.locator(
    `.text-hit[data-annotation-id="${generated[1].id}"]`,
  );
  await expect(caption).toBeVisible();
  await caption.click();
  await expect(page.getByLabel("Shot caption", { exact: true })).toHaveValue(
    generated[1].text,
  );
  await page.screenshot({ path: `${evidenceDir}/short-caption.png` });
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal((await state()).storyboard.shots[0].annotations.length, 1);
  assert.equal(
    (await state()).storyboard.shots[0].annotations[0].text,
    manual.text,
  );
  await page.getByTitle("Redo", { exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByTitle("Open composition", { exact: true }).click();
  assert.equal((await state()).transcripts[0].words.length, 12);
  assert.equal(
    (await state()).storyboard.shots.flatMap((s: any) =>
      s.annotations.filter((a: any) => a.transcriptId),
    ).length,
    5,
  );
  await page.locator(".shot-card").first().click();
  await page
    .getByRole("button", { name: "Captions & transcript", exact: true })
    .click();
  await page.getByLabel("Transcript offset", { exact: true }).fill("0.25");
  await page.getByLabel("Find transcript words", { exact: true }).fill("queen");
  await expect(page.locator(".transcript-words button")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Seek word queen at 3.85 seconds",
      exact: true,
    })
    .click();
  assert(
    Math.abs((await page.evaluate(() => (window as any).__state.time)) - 3.85) <
      1e-8,
  );
  await page.getByLabel("Transcript word text", { exact: true }).fill("rook");
  await page
    .getByRole("button", { name: "Save word edit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate short captions", exact: true })
    .click();
  assert(
    (await state()).storyboard.shots
      .flatMap((s: any) => s.annotations)
      .some((a: any) => a.transcriptId && a.text.includes("rook")),
  );
  await page.getByLabel("Find transcript words", { exact: true }).fill("");
  await page
    .getByText("Paste timed transcript · SRT, WebVTT or word-timed JSON", {
      exact: true,
    })
    .click();
  await page
    .getByLabel("Timed transcript text", { exact: true })
    .fill(
      "1\n00:00:00,000 --> 00:00:04,000\nOne two three four five six seven eight nine ten",
    );
  await page
    .getByRole("button", { name: "Use pasted transcript", exact: true })
    .click();
  await expect(page.locator(".transcript-warning").first()).toContainText(
    "cue-level timing",
  );
  await page
    .getByRole("button", { name: "Generate short captions", exact: true })
    .click();
  assert.equal(
    (await state()).storyboard.shots.flatMap((s: any) =>
      s.annotations.filter((a: any) => a.transcriptId),
    ).length,
    2,
  );
  await page.setViewportSize({ width: 900, height: 800 });
  await page.screenshot({ path: `${evidenceDir}/narrow-transcript.png` });
  await page
    .getByRole("button", { name: "Close captions", exact: true })
    .click();
  assert.deepEqual((await state()).annotations, fixture.annotations);
  assert.deepEqual((await state()).moves, fixture.moves);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: quick caption, timed transcript import, precise word seek, short phrases across shots, generated-caption selection, Undo/Redo, save/reopen, offset, search, word edits, cue warnings, regeneration and source preservation",
  );
} catch (e) {
  await page
    ?.screenshot({ path: `${evidenceDir}/failure.png` })
    .catch(() => {});
  throw e;
} finally {
  await browser?.close();
  server.kill();
}
