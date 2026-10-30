import fs from "node:fs/promises";
import path from "node:path";
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
let text =
  "# Third-party packages\n\nThe application is GPL-3.0-or-later. Dependencies retain their own licenses. Bundled runtime dependencies and their transitives are listed below. Electron runtime/Chromium notices are also included alongside the portable app.\n\n";
const seen = new Set();
async function locate(name, from) {
  let at = from;
  for (;;) {
    const dir = path.join(at, "node_modules", name);
    if (await fs.stat(path.join(dir, "package.json")).catch(() => null))
      return dir;
    const parent = path.dirname(at);
    if (parent === at) throw Error("Cannot locate " + name);
    at = parent;
  }
}
async function include(name, from, recurse = true) {
  const dir = await locate(name, from),
    p = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8")),
    key = name + "@" + p.version;
  if (seen.has(key)) return;
  seen.add(key);
  text += `## ${name} ${p.version}\n\nLicense: ${p.license ?? "see upstream files"}\n\n`;
  const files = (await fs.readdir(dir)).filter((n) =>
    /^licen[cs]e(?:\.|$)/i.test(n),
  );
  for (const file of files)
    text +=
      "```text\n" +
      (await fs.readFile(path.join(dir, file), "utf8")) +
      "\n```\n\n";
  if (recurse)
    for (const dep of Object.keys(p.dependencies ?? {}))
      await include(dep, dir);
}
for (const name of Object.keys(pkg.dependencies))
  await include(name, process.cwd());
await include("electron", process.cwd(), false);
await fs.writeFile("docs/THIRD_PARTY.md", text);
