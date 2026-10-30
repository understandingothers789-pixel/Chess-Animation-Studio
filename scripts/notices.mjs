import fs from "node:fs/promises";
import path from "node:path";
const pkg = JSON.parse(await fs.readFile("package.json", "utf8"));
let text =
  "# Third-party packages\n\nThe application is GPL-3.0-or-later. Dependencies retain their own licenses.\n\n";
for (const name of [...Object.keys(pkg.dependencies), "electron"]) {
  const dir = path.join("node_modules", name),
    p = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
  text += `## ${name} ${p.version}\n\nLicense: ${p.license ?? "see upstream files"}\n\n`;
  const files = (await fs.readdir(dir)).filter((n) =>
    /^licen[cs]e(?:\.|$)/i.test(n),
  );
  for (const file of files)
    text +=
      "```text\n" +
      (await fs.readFile(path.join(dir, file), "utf8")) +
      "\n```\n\n";
}
await fs.writeFile("docs/THIRD_PARTY.md", text);
