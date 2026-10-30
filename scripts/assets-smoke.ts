import { _electron as electron } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd(),
  dir = await fs.mkdtemp("/tmp/castudio-assets-"),
  file = path.join(dir, "missing-assets.castudio"),
  audio = path.join(dir, "music.wav"),
  packDir = path.join(dir, "pack");
const p = JSON.parse(await fs.readFile("samples/Opera-Game.castudio", "utf8"));
await fs.copyFile("samples/Opera-original.wav", audio);
p.assets[0].path = audio;
await fs.writeFile(file, JSON.stringify(p));
await fs.writeFile(
  path.join(dir, "settings.json"),
  JSON.stringify({ recent: [file] }),
);
await fs.mkdir(packDir);
await fs.copyFile("build/icon.png", path.join(packDir, "brilliant.png"));
await fs.writeFile(
  path.join(packDir, "pack.json"),
  JSON.stringify({
    kind: "chess-animation-badges",
    schemaVersion: 1,
    source: "Original app icon",
    guidance: "MIT",
    badges: { brilliant: "brilliant.png" },
  }),
);
const app = await electron.launch({
  args: [
    root,
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
  env: {
    ...process.env,
    DISPLAY: process.env.DISPLAY ?? ":100",
    STUDIO_TEST_DATA: dir,
  },
});
try {
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByTitle("Settings", { exact: true }).click();
  await page.getByLabel("Recent projects", { exact: true }).selectOption(file);
  await page.waitForFunction(() =>
    document.body.textContent?.includes("Opened The Opera Game"),
  );
  await page.waitForFunction(
    () =>
      !(document.querySelector(".play-button") as HTMLButtonElement).disabled,
  );
  await fs.rm(audio);
  await page.waitForFunction(
    () => document.body.textContent?.includes("An asset was moved or deleted"),
    {},
    { timeout: 12000 },
  );
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [file],
      })) as any;
    },
    path.join(packDir, "pack.json"),
  );
  await page.getByTitle("Design", { exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Local classification assets" })
    .click();
  await page
    .getByRole("button", {
      name: "Import local badge pack manifest",
      exact: true,
    })
    .click();
  await page.waitForFunction(() =>
    document.body.textContent?.includes("1 local badge images imported"),
  );
  await page.getByRole("button", { name: "look", exact: true }).click();
  await page
    .getByLabel("Badge override", { exact: true })
    .selectOption("brilliant");
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: deleted asset detected/cleared; permitted local badge pack imported through native dialog with source guidance.",
  );
} finally {
  await app.close();
  await fs.rm(dir, { recursive: true, force: true });
}
