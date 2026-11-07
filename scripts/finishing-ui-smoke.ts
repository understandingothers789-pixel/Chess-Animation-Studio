import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { blank, parseProject } from "../src/core/project";
import { importPgn } from "../src/core/chess";
import { shotFromMove, shotCaption, titleShot } from "../src/core/storyboard";
import { analyze } from "../src/core/audio";
const root = "docs/finishing-031";
await fs.mkdir(root, { recursive: true });
const wav = "/tmp/cas031-pulse.wav";
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=220:duration=12",
  "-af",
  "volume=if(lt(mod(t\\,0.5)\\,0.08)\\,1\\,0.1):eval=frame",
  wav,
]);
const audio =
  "data:audio/wav;base64," + (await fs.readFile(wav)).toString("base64");
let fixture = importPgn(blank(), "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6");
fixture.format = "vertical";
fixture.shorts.enabled = true;
fixture.storyboard.shots = [
  titleShot(fixture, "Find the winning move!", 2),
  shotFromMove(fixture, fixture.moves[6].id, "position-hold", "before"),
  shotFromMove(fixture, fixture.moves[6].id),
  shotFromMove(fixture, fixture.moves[0].id),
];
fixture.storyboard.shots[1].annotations = [
  shotCaption(
    fixture,
    "This bishop sacrifice looks completely losing until you notice the queen is trapped.",
    3,
  ),
];
fixture.music.asset = "pulse";
fixture.music.sourceDuration = 12;
fixture.music.trimStart = 1;
fixture.music.trimEnd = 10;
fixture.music.offset = 0;
fixture.music.fadeIn = 0.5;
fixture.music.fadeOut = 1;
fixture.assets = [
  {
    id: "pulse",
    kind: "audio",
    path: wav,
    name: "Generated rhythmic audio.wav",
    source: "test",
    guidance: "synthetic",
  },
];
fixture.waveform = analyze(
  Float32Array.from(
    { length: 12000 },
    (_, i) => Math.sin(i * 0.5) * (i % 500 < 80 ? 1 : 0.1),
  ),
  1000,
).waveform;
fixture.music.volumePoints = [
  { time: 0, value: 0.6 },
  { time: 3, value: 0.25 },
  { time: 6, value: 1 },
];
fixture.storyboard.beats = Array.from({ length: 20 }, (_, i) => ({
  id: "beat" + i,
  time: i * 0.5,
  accent: i % 4 === 0,
  enabled: true,
}));
fixture = parseProject(fixture);
await fs.writeFile(
  root + "/synthetic.castudio",
  JSON.stringify(fixture, null, 2),
);
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--port", "5191"],
  { stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:5191")).ok) break;
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
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
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
        assetStatus: async () => ({ pulse: true }),
        assetData: async () => audio,
        save: async (p: any) => {
          w.__stored = structuredClone(p);
          return "/test/finishing.castudio";
        },
        open: async () => ({
          project: structuredClone(w.__stored),
          path: "/test/finishing.castudio",
        }),
        presentation: async () => {},
      };
    },
    { fixture, audio },
  );
  await page.goto("http://127.0.0.1:5191");
  await page.getByTitle("Open composition", { exact: true }).click();
  await page.getByLabel("Storyboard mode", { exact: true }).click();
  await expect(page.locator(".shot-card")).toHaveCount(4);
  const state = () => page.evaluate(() => (window as any).__state.project);
  const snap = async (name: string) => {
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${root}/${name}.png` });
  };
  const seekTime = async (t: number) => {
    const r = await page
      .getByLabel("Seek storyboard", { exact: true })
      .boundingBox();
    assert(r);
    await page.mouse.click(
      r.x + 8 + ((r.width - 16) * t) / 9.4,
      r.y + r.height / 2,
    );
  };
  await seekTime(1);
  await snap("01-short-caption");
  await page.getByLabel("Shot 2:", { exact: false }).click();
  await seekTime(2.5);
  await snap("02-wrapped-vertical");
  const beforeGuidePixels = await page
    .getByLabel("Chess composition preview", { exact: true })
    .evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page
    .getByRole("button", { name: "Caption guides", exact: true })
    .click();
  await expect(page.getByLabel("Caption safe area")).toBeVisible();
  await snap("05-guides-enabled");
  assert.equal(
    await page
      .getByLabel("Chess composition preview", { exact: true })
      .evaluate((c: HTMLCanvasElement) => c.toDataURL()),
    beforeGuidePixels,
    "Editor guides must not alter PNG/export pixels",
  );
  const marker = page.getByLabel("Drag caption position");
  const before = (await state()).storyboard.shots[1].annotations[0];
  const box = await marker.boundingBox();
  assert(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 75, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await state()).storyboard.shots[1].annotations[0].y)
    .not.toBe(before.y);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal((await state()).storyboard.shots[1].annotations[0].y, before.y);
  await page.getByTitle("Redo", { exact: true }).click();
  await page
    .getByRole("button", { name: "Caption guides", exact: true })
    .click();
  await snap("06-guides-disabled");
  await page
    .locator(".shot-inspector")
    .getByText("Caption presets · selected caption", { exact: true })
    .click();
  await page
    .getByLabel("Caption preset", { exact: true })
    .selectOption("Bold Short");
  const text = (await state()).storyboard.shots[1].annotations[0].text;
  await snap("08-preset-browser");
  await page
    .getByRole("button", { name: "Apply caption preset", exact: true })
    .click();
  assert.equal((await state()).storyboard.shots[1].annotations[0].text, text);
  await page
    .getByLabel("Shot caption", { exact: true })
    .scrollIntoViewIfNeeded();
  await snap("07-caption-inspector");
  for (const [format, name] of [
    ["landscape", "03-landscape"],
    ["square", "04-square"],
    ["square-in-vertical", "18-square-in-vertical"],
    ["vertical", "13-storyboard"],
  ]) {
    await page
      .getByRole("main")
      .getByLabel("Output format", { exact: true })
      .selectOption(format);
    await snap(name);
  }
  await page.locator(".story-waveform>summary").click();
  await page.locator(".story-waveform").scrollIntoViewIfNeeded();
  await snap("09-waveform");
  const beat = page.getByRole("slider", { name: "Accent 1", exact: true });
  const beatBox = await beat.boundingBox();
  assert(beatBox);
  assert(beatBox.y >= 0 && beatBox.y + beatBox.height <= 1080);
  await page.mouse.click(
    beatBox.x + beatBox.width / 2,
    beatBox.y + beatBox.height / 2,
  );
  await page.getByLabel("Selected beat time", { exact: true }).fill("0.25");
  await snap("10-beat-edit");
  assert.equal((await state()).storyboard.beats[0].time, 0.25);
  for (const [label, key] of [
    ["Music source trim start", "trimStart"],
    ["Music source trim end", "trimEnd"],
    ["Music fade out", "fadeOut"],
  ] as const) {
    const before = (await state()).music[key];
    await page.getByRole("slider", { name: label, exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await state()).music[key])
      .toBeCloseTo(before + 0.01);
    await page.getByTitle("Undo", { exact: true }).click();
    await expect.poll(async () => (await state()).music[key]).toBe(before);
  }
  const musicRegion = page.locator('.wave-scroll rect[fill="#192e24"]'),
    clip = await musicRegion.boundingBox();
  assert(clip);
  const originalOffset = (await state()).music.offset;
  await page.mouse.move(clip.x + clip.width * 0.4, clip.y + clip.height * 0.5);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(
    clip.x + clip.width * 0.4 + 45,
    clip.y + clip.height * 0.5,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => (await state()).music.offset)
    .not.toBe(originalOffset);
  await page.getByTitle("Undo", { exact: true }).click();
  await expect
    .poll(async () => (await state()).music.offset)
    .toBe(originalOffset);
  const fade = page.getByRole("slider", { name: "Music fade in", exact: true });
  await fade.focus();
  await page.keyboard.press("ArrowRight");
  await snap("11-trim-fades");
  assert.equal((await state()).music.fadeIn, 0.51);
  await page.getByTitle("Undo", { exact: true }).click();
  assert.equal((await state()).music.fadeIn, 0.5);
  await page
    .getByRole("slider", { name: "Volume point 1", exact: true })
    .click();
  await page.getByLabel("Volume point gain", { exact: true }).fill("0.4");
  await snap("12-automation");
  assert.equal((await state()).music.volumePoints[0].value, 0.4);
  await page.keyboard.press("Control+s");
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__stored.music.volumePoints[0].value),
    )
    .toBe(0.4);
  await expect(
    page.getByText("Saved composition", { exact: true }),
  ).toBeVisible();
  await page.getByTitle("Open composition", { exact: true }).click();
  assert.equal((await state()).music.volumePoints[0].value, 0.4);
  await page
    .getByRole("button", { name: "Export storyboard", exact: true })
    .click();
  await expect(page.getByText(/Production checks ·/)).toBeVisible();
  await snap("14-production-checks");
  await snap("15-export-dialog");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 820 });
  await snap("16-narrow");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await snap("17-desktop");
  await page.getByLabel("UI scale", { exact: true }).selectOption("150");
  await snap("19-scale150");
  const bench = await page.evaluate(async () => {
    const { layoutCaption, captionCache } = await import(
      "/src/core/captions/layout.ts" as string
    );
    const a = (window as any).__state.project.storyboard.shots[1]
      .annotations[0];
    const ctx = document.createElement("canvas").getContext("2d")!;
    const measure = (t: string, s: number, f: string, w: number) => {
      ctx.font = `${w} ${s}px ${f}`;
      return ctx.measureText(t).width;
    };
    let start = performance.now();
    for (let i = 0; i < 1000; i++)
      layoutCaption(a, 1080, 1920, "vertical", measure);
    const cold = performance.now() - start;
    const cached = captionCache(measure);
    start = performance.now();
    for (let i = 0; i < 10000; i++) cached(a, 1080, 1920, "vertical");
    return { layout1000ms: cold, cached10000ms: performance.now() - start };
  });
  await fs.writeFile(
    root + "/performance.json",
    JSON.stringify(bench, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: finishing UI, caption presets/drag Undo/Redo, waveform, beat time, fade nudge Undo, volume editing, persistence, export checks, responsive screenshots",
    bench,
  );
} finally {
  await browser?.close();
  server.kill();
}
