import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { installStockfishDev } from "../desktop/stockfishSetup";
import { engineNotation } from "../src/core/badgeNotation";
import { importPgn } from "../src/core/chess";
import { blank } from "../src/core/project";
import { badge } from "../src/core/timeline";

const tag = "stockfish-dev-20261126-88337401";
const name = "stockfish-windows-x86-64-universal.zip";
// A ZIP containing only a small dummy file with a Windows header.
const archive = Buffer.from(
  "UEsDBBQAAAAAAEiBel3sjOCOFgAAABYAAAAwAAAAc3RvY2tmaXNoL3N0b2NrZmlzaC13aW5kb3dzLXg4Ni02NC11bml2ZXJzYWwuZXhlTVp0ZXN0IFdpbmRvd3MgZml4dHVyZVBLAQIUAxQAAAAAAEiBel3sjOCOFgAAABYAAAAwAAAAAAAAAAAAAACAAQAAAABzdG9ja2Zpc2gvc3RvY2tmaXNoLXdpbmRvd3MteDg2LTY0LXVuaXZlcnNhbC5leGVQSwUGAAAAAAEAAQBeAAAAZAAAAAAA",
  "base64",
);
const digest = createHash("sha256").update(archive).digest("hex");

afterEach(() => vi.unstubAllGlobals());

function fixtures(checksum = digest) {
  return vi.fn(async (url: string) => {
    if (url.endsWith("/releases.atom"))
      return new Response(
        `<id>tag:github.com,2008:Repository/20976138/sf_19</id><id>tag:github.com,2008:Repository/20976138/${tag}</id>`,
      );
    if (url.endsWith("/expanded_assets/" + tag))
      return new Response(
        `<a href="/official-stockfish/Stockfish/releases/download/${tag}/${name}"></a><clipboard-copy aria-label="Copy to clipboard digest for ${name}" value="sha256:${checksum}"></clipboard-copy>`,
      );
    expect(url).toBe(
      `https://github.com/official-stockfish/Stockfish/releases/download/${tag}/${name}`,
    );
    return new Response(new Uint8Array(archive));
  });
}

it("installs in Downloads and reuses the verified build without another archive download", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "studio-stockfish-"));
  const fetch = fixtures();
  vi.stubGlobal("fetch", fetch);
  try {
    const downloads = path.join(root, "User Downloads");
    const run = () =>
      installStockfishDev(
        downloads,
        "win32",
        "x64",
        new AbortController().signal,
        () => {},
      );
    const result = await run();
    expect(result.reused).toBe(false);
    const installed = path.join(downloads, "Stockfish Development", tag);
    expect(result.binary).toBe(
      path.join(installed, "x64", "stockfish-windows-x86-64-universal.exe"),
    );
    expect(await fs.readFile(result.binary, "utf8")).toBe(
      "MZtest Windows fixture",
    );
    expect(await fs.readdir(installed)).toEqual(["x64"]);
    expect(await run()).toEqual({ ...result, reused: true });
    expect(
      fetch.mock.calls.filter(([url]) => url.endsWith(".zip")),
    ).toHaveLength(1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

it("cleans staging files after a checksum mismatch", async () => {
  const downloads = await fs.mkdtemp(
    path.join(os.tmpdir(), "studio-stockfish-"),
  );
  vi.stubGlobal("fetch", fixtures("f".repeat(64)));
  try {
    await expect(
      installStockfishDev(
        downloads,
        "win32",
        "x64",
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow(/checksum/);
    expect(
      await fs.readdir(path.join(downloads, "Stockfish Development", tag)),
    ).toEqual([]);
  } finally {
    await fs.rm(downloads, { recursive: true, force: true });
  }
});

it("uses a strict half-pawn cutoff even for saved reviews and keeps manual overrides", () => {
  expect(engineNotation(50, false, false)).toBe("good");
  expect(engineNotation(51, false, false)).toBe("mistake");
  expect(engineNotation(190, false, false)).toBe("mistake");
  expect(engineNotation(0, true, true)).toBe("brilliant");
  const [move] = importPgn(blank(), "1. e4").moves;
  move.analysis = {
    book: { state: "found", games: 200, frequency: 1, message: "Book" },
    engine: {
      state: "done",
      score: 0,
      loss: 51,
      best: "d2d4",
      label: "inaccuracy",
      depth: 12,
      message: "Saved review",
    },
  };
  expect(badge(move)).toBe("mistake");
  move.analysis.engine!.loss = 50;
  expect(badge(move)).toBe("book");
  move.effect.badge.manual = "blunder";
  expect(badge(move)).toBe("blunder");
  move.effect.badge.manual = "none";
  expect(badge(move)).toBeNull();
});
