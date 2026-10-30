import { promises as fs } from "node:fs";
import path from "node:path";
const packages = [
  "chess.js",
  "react",
  "react-dom",
  "scheduler",
  "three",
  "zod",
  "lucide-react",
  "electron",
];
let output =
  "# Third-party notices\n\nGenerated from the installed, lockfile-pinned packages. App code and original art/audio are MIT; these dependencies retain their own licenses. Electron distributions also include `LICENSES.chromium.html` with Chromium and bundled component notices. FFmpeg and Stockfish are external, user-selected executables, not bundled app assets; see [SOURCES.md](SOURCES.md). Development/test tools are listed separately in package.json/package-lock.json.\n";
for (const name of packages) {
  const folder = path.join("node_modules", name),
    pkg = JSON.parse(
      await fs.readFile(path.join(folder, "package.json"), "utf8"),
    );
  output += `\n## ${name} ${pkg.version}\n\nLicense: ${pkg.license ?? "See accompanying notices"}. Source: https://www.npmjs.com/package/${name}\n\n`;
  const names = (await fs.readdir(folder)).filter((n) =>
    /^(licen[sc]e|copying)(\.md|\.txt)?$/i.test(n),
  );
  for (const file of names)
    output +=
      "```text\n" +
      (await fs.readFile(path.join(folder, file), "utf8")).trim() +
      "\n```\n";
}
await fs.writeFile("docs/THIRD_PARTY.md", output);
