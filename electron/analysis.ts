import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { buildGame } from "../src/core/chess";
import type { Project } from "../src/core/model";
import type { AnalysisProgress } from "../src/bridge";
import { atomicWrite } from "./files";

export interface Score {
  cp: number;
  mate: number | null;
  depth: number;
  best: string;
}
export function classify(loss: number, best: boolean): string {
  return best
    ? "best"
    : loss < 35
      ? "good"
      : loss < 90
        ? "inaccuracy"
        : loss < 180
          ? "mistake"
          : "blunder";
}
export function normalizedScore(
  cp: number | undefined,
  mate: number | undefined,
): number {
  return mate !== undefined
    ? Math.sign(mate || 1) * (100000 - Math.abs(mate) * 100)
    : (cp ?? 0);
}
export class UciEngine {
  name = "Unidentified UCI engine";
  private child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private lines: string[] = [];
  private waiters: ((line: string) => void)[] = [];
  private dead: Error | null = null;
  constructor(binary: string) {
    this.child = spawn(binary, [], { windowsHide: true });
    this.child.stdout.on("data", (data) => {
      this.buffer += data.toString();
      let at;
      while ((at = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, at).trim();
        this.buffer = this.buffer.slice(at + 1);
        if (line.startsWith("id name ")) this.name = line.slice(8);
        for (const fn of [...this.waiters]) fn(line);
      }
    });
    this.child.on("error", (e) => {
      this.dead = e;
      for (const fn of [...this.waiters]) fn("__dead");
    });
    this.child.on("exit", () => {
      this.dead ??= new Error("Engine exited.");
      for (const fn of [...this.waiters]) fn("__dead");
    });
    this.child.stderr.on("data", () => {});
  }
  private send(line: string) {
    if (this.dead) throw this.dead;
    this.child.stdin.write(line + "\n");
  }
  private until(test: (line: string) => boolean, ms: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.dead) {
        reject(this.dead);
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Stockfish timed out."));
      }, ms);
      const receive = (line: string) => {
        if (this.dead) {
          cleanup();
          reject(this.dead);
        } else if (test(line)) {
          cleanup();
          resolve(line);
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.waiters = this.waiters.filter((x) => x !== receive);
      };
      this.waiters.push(receive);
    });
  }
  async ready() {
    const ready = this.until((l) => l === "uciok", 5000);
    this.send("uci");
    await ready;
    this.send("setoption name Threads value 2");
    this.send("setoption name Hash value 128");
    const check = this.until((l) => l === "readyok", 5000);
    this.send("isready");
    await check;
  }
  async score(
    fen: string,
    depth: number,
    movetime: number,
    searchMove?: string,
  ): Promise<Score> {
    let score: Score = { cp: 0, mate: null, depth: 0, best: "" };
    const info = (line: string) => {
      const m = line.match(/score (cp|mate) (-?\d+)/);
      if (m && !/upperbound|lowerbound/.test(line)) {
        const v = Number(m[2]);
        score = {
          ...score,
          cp: normalizedScore(
            m[1] === "cp" ? v : undefined,
            m[1] === "mate" ? v : undefined,
          ),
          mate: m[1] === "mate" ? v : null,
          depth: Number(line.match(/depth (\d+)/)?.[1] ?? 0),
        };
      }
    };
    this.waiters.push(info);
    try {
      this.send(`position fen ${fen}`);
      const done = this.until(
        (l) => l.startsWith("bestmove"),
        movetime + 10000,
      );
      this.send(
        `go depth ${depth} movetime ${movetime}${searchMove ? ` searchmoves ${searchMove}` : ""}`,
      );
      const line = await done;
      score.best = line.split(" ")[1];
      return score;
    } finally {
      this.waiters = this.waiters.filter((x) => x !== info);
    }
  }
  close() {
    if (!this.dead) {
      this.child.stdin.write("stop\nquit\n");
    }
    this.child.kill();
  }
}

export class AnalysisService {
  private cancelled = false;
  private engine: UciEngine | null = null;
  private busy = false;
  private abort: AbortController | null = null;
  constructor(
    private cacheDir: string,
    private request: (
      url: string,
      token?: string,
      signal?: AbortSignal,
    ) => Promise<Response>,
  ) {}
  cancel() {
    this.cancelled = true;
    this.abort?.abort();
    this.engine?.close();
  }
  async run(
    p: Project,
    mode: "book" | "engine" | "both",
    ids: string[],
    binary: string,
    token: string | undefined,
    progress: (p: AnalysisProgress) => void,
  ) {
    if (this.busy) throw new Error("Analysis is already running.");
    this.busy = true;
    this.cancelled = false;
    await fs.mkdir(this.cacheDir, { recursive: true });
    let engineError = "";
    try {
      if (mode !== "book") {
        try {
          this.engine = new UciEngine(binary);
          await this.engine.ready();
        } catch (e) {
          engineError = (e as Error).message;
          this.engine?.close();
          this.engine = null;
        }
      }
      const game = buildGame(p),
        chosen = game.steps.filter((s) => ids.includes(s.move.id));
      for (let i = 0; i < chosen.length && !this.cancelled; i++) {
        const s = chosen[i],
          analysis = structuredClone(s.move.analysis);
        if (mode !== "engine") {
          const ply = game.steps.indexOf(s);
          if (ply >= p.analysisSettings.cutoff)
            analysis.book = {
              state: "not-analyzed",
              games: 0,
              frequency: 0,
              source: "Lichess Masters",
              message: "Outside configured opening cutoff.",
            };
          else
            try {
              const url = `https://explorer.lichess.org/masters?fen=${encodeURIComponent(s.beforeFen)}&moves=100&topGames=0`;
              const data = (await this.cached(
                url,
                async () => {
                  this.abort = new AbortController();
                  const timer = setTimeout(() => this.abort?.abort(), 12000);
                  try {
                    const res = await this.request(
                      url,
                      token,
                      this.abort.signal,
                    );
                    if (!res.ok)
                      throw new Error(
                        res.status === 401
                          ? "Masters requires authentication. Add a token in local settings."
                          : `Masters returned HTTP ${res.status}.`,
                      );
                    return await res.json();
                  } finally {
                    clearTimeout(timer);
                  }
                },
                7 * 24 * 3600 * 1000,
              )) as {
                white: number;
                draws: number;
                black: number;
                moves: {
                  uci: string;
                  white: number;
                  draws: number;
                  black: number;
                }[];
              };
              const move = data.moves.find((m) => m.uci === s.move.uci),
                games = move ? move.white + move.draws + move.black : 0,
                total = data.white + data.draws + data.black,
                frequency = total ? games / total : 0;
              analysis.book = {
                state:
                  games >= p.analysisSettings.minGames &&
                  frequency >= p.analysisSettings.frequency
                    ? "found"
                    : "not-found",
                games,
                frequency,
                source:
                  "Lichess Masters · " + new Date().toISOString().slice(0, 10),
                message: games
                  ? "Thresholds applied to database frequency."
                  : "Move not found in returned Masters moves.",
              };
            } catch (e) {
              analysis.book = {
                state: "unavailable",
                games: 0,
                frequency: 0,
                source: "Lichess Masters",
                message: (e as Error).message,
              };
            }
        }
        if (mode !== "book" && !this.cancelled) {
          try {
            if (!this.engine)
              throw new Error(
                engineError ||
                  "Choose a local Stockfish executable in settings.",
              );
            const { depth, moveTime } = p.analysisSettings;
            const result = (await this.cached(
              JSON.stringify([
                binary,
                this.engine.name,
                s.beforeFen,
                s.move.uci,
                depth,
                moveTime,
              ]),
              async () => {
                const best = await this.engine!.score(
                  s.beforeFen,
                  depth,
                  moveTime,
                );
                const played =
                  best.best === s.move.uci
                    ? best
                    : await this.engine!.score(
                        s.beforeFen,
                        depth,
                        moveTime,
                        s.move.uci,
                      );
                return { best, played };
              },
            )) as { best: Score; played: Score };
            const loss = Math.max(0, result.best.cp - result.played.cp);
            analysis.engine = {
              state: "done",
              label: classify(loss, result.best.best === s.move.uci),
              loss,
              before: result.best.cp,
              after: result.played.cp,
              mate: result.played.mate,
              depth: result.played.depth,
              source: "Local Stockfish · mover perspective",
              message:
                "Centipawn loss at configured search limits; not Chess.com classifications.",
            };
          } catch (e) {
            analysis.engine = {
              state: "unavailable",
              label: "",
              loss: 0,
              before: 0,
              after: 0,
              mate: null,
              depth: 0,
              source: "Local Stockfish",
              message: (e as Error).message,
            };
          }
        }
        if (!this.cancelled)
          progress({
            moveId: s.move.id,
            index: i + 1,
            total: chosen.length,
            analysis,
          });
      }
    } finally {
      this.engine?.close();
      this.engine = null;
      this.busy = false;
      this.abort = null;
    }
  }
  private async cached(
    key: string,
    load: () => Promise<unknown>,
    ttl = Infinity,
  ): Promise<unknown> {
    const { createHash } = await import("node:crypto");
    const file = path.join(
      this.cacheDir,
      createHash("sha256").update(key).digest("hex") + ".json",
    );
    try {
      const data = JSON.parse(await fs.readFile(file, "utf8"));
      if (Date.now() - data.at < ttl) return data.value;
    } catch {}
    if (key.startsWith("https:")) await new Promise((r) => setTimeout(r, 1000));
    const value = await load();
    await atomicWrite(file, JSON.stringify({ at: Date.now(), value }));
    return value;
  }
}
