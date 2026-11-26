import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { type Project } from "../src/core/project";
import { buildGame } from "../src/core/chess";
import { starterBook } from "../src/core/openingBook";
import { atomic } from "./files";
import {
  replyUci,
  sacrificeCandidates,
  sacrificeDepth,
  sacrificeLine,
} from "./sacrifices";
const key = (s: string) => createHash("sha256").update(s).digest("hex");
async function cached(dir: string, id: string, ttl = 7 * 864e5) {
  try {
    const f = path.join(dir, id + ".json");
    if (Date.now() - (await fs.stat(f)).mtimeMs > ttl) return null;
    return JSON.parse(await fs.readFile(f, "utf8"));
  } catch {
    return null;
  }
}
const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(t);
      reject(Error("Analysis cancelled."));
    };
    const t = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
class Uci {
  child: ChildProcessWithoutNullStreams;
  buffer = "";
  lines: string[] = [];
  name = "";
  wake: (() => void) | null = null;
  private readonly abort = () => this.child.kill();
  constructor(
    executable: string,
    private readonly signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    this.child = spawn(executable, [], { windowsHide: true, stdio: "pipe" });
    this.child.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop()!;
      this.lines.push(...lines);
      for (const l of lines)
        if (l.startsWith("id name ")) this.name = l.slice(8);
      this.wake?.();
    });
    this.child.stderr.resume();
    this.child.stdin.on("error", () => {});
    this.child.on("error", (e) => {
      this.lines.push("ERROR " + e.message);
      this.wake?.();
    });
    signal.addEventListener("abort", this.abort, { once: true });
  }
  send(s: string) {
    this.child.stdin.write(s + "\n");
  }
  async until(token: string, ms = 10000) {
    const found = () =>
      this.lines.some((x) => x.startsWith(token) || x.startsWith("ERROR"));
    if (!found()) {
      this.signal.throwIfAborted();
      if (this.child.exitCode !== null || this.child.signalCode !== null)
        throw Error("Engine stopped.");
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(t);
          this.wake = null;
          this.child.removeListener("exit", exited);
        };
        const exited = () => {
          cleanup();
          reject(Error("Engine stopped."));
        };
        const t = setTimeout(() => {
          cleanup();
          reject(Error("Engine timed out."));
        }, ms);
        this.wake = () => {
          if (found()) {
            cleanup();
            resolve();
          }
        };
        this.child.once("exit", exited);
      });
    }
    this.signal.throwIfAborted();
    const lines = this.lines.splice(0);
    const error = lines.find((l) => l.startsWith("ERROR"));
    if (error) throw Error(error);
    return lines;
  }
  async search(
    fen: string,
    p: Project,
    only: readonly string[] = [],
    depthLimit = p.analysis.depth,
  ) {
    this.lines = [];
    this.send("position fen " + fen);
    this.send(
      `go depth ${depthLimit} movetime ${p.analysis.milliseconds}${only.length ? " searchmoves " + only.join(" ") : ""}`,
    );
    const lines = await this.until("bestmove", p.analysis.milliseconds + 12000);
    const best =
      lines.find((line) => line.startsWith("bestmove "))?.split(" ")[1] ?? "";
    const scoring = lines.flatMap((line) => {
      const match = line.match(
        /^info depth (\d+) .*?score (cp|mate) (-?\d+)(.*)$/,
      );
      if (!match) return [];
      const [, depth, kind, raw, rest] = match;
      const value = Number(raw);
      const pv =
        rest
          .match(/ pv (.+)$/)?.[1]
          .trim()
          .split(/\s+/) ?? [];
      return [
        {
          depth: Number(depth),
          score:
            kind === "mate"
              ? (value > 0 ? 1 : -1) * (100000 - Math.abs(value) * 100)
              : value,
          exact: !/\b(?:lowerbound|upperbound)\b/.test(rest) && pv[0] === best,
          pv,
        },
      ];
    });
    const exact = [...scoring].reverse().find((line) => line.exact);
    return {
      ...(exact ??
        scoring.at(-1) ?? { score: 0, depth: 0, exact: false, pv: [] }),
      best,
    };
  }
  stop() {
    this.signal.removeEventListener("abort", this.abort);
    this.child.kill();
  }
}
async function reviewMove(
  engine: Uci,
  p: Project,
  fen: string,
  move: string,
): Promise<NonNullable<Project["moves"][number]["analysis"]["engine"]>> {
  const candidate = /^Stockfish\b/i.test(engine.name)
    ? sacrificeCandidates(fen, move)
    : undefined;
  const depth = candidate?.replies.length
    ? Math.max(sacrificeDepth, p.analysis.depth)
    : p.analysis.depth;
  const best = await engine.search(fen, p, [], depth);
  const played =
    best.best === move ? best : await engine.search(fen, p, [move], depth);
  const lossLimit = best.score >= 90000 && played.score >= 90000 ? 100 : 40;
  let sacrifice: ReturnType<typeof sacrificeLine>;
  if (
    candidate?.replies.length &&
    best.exact &&
    played.exact &&
    Math.min(best.depth, played.depth) >= sacrificeDepth &&
    played.score >= -35 &&
    best.score - played.score <= lossLimit
  ) {
    const replies = candidate.replies.map(replyUci);
    if (replies.includes(played.pv[1])) {
      sacrifice = sacrificeLine(candidate, played.pv.slice(1));
    } else {
      const accepted = await engine.search(
        candidate.after.fen(),
        p,
        replies,
        depth,
      );
      if (
        accepted.exact &&
        accepted.depth >= sacrificeDepth &&
        accepted.score <= 35
      )
        sacrifice = sacrificeLine(candidate, accepted.pv);
    }
  }
  const loss = Math.max(0, best.score - played.score);
  return {
    state: "done",
    score: played.score,
    loss,
    best: best.best,
    label: sacrifice
      ? "brilliant"
      : best.best === move
        ? "best"
        : loss < 35
          ? "good"
          : loss < 90
            ? "inaccuracy"
            : loss < 180
              ? "mistake"
              : "blunder",
    depth: played.depth,
    message: engine.name + "; root mover perspective",
    ...(sacrifice ? { sacrifice } : {}),
  };
}

export async function analyze(
  p: Project,
  kind: "book" | "engine" | "starter",
  indices: number[],
  dir: string,
  executable: string,
  token: string,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  signal.throwIfAborted();
  await fs.mkdir(dir, { recursive: true });
  signal.throwIfAborted();
  const g = buildGame(p),
    result: Record<string, Project["moves"][number]["analysis"]> = {};
  let engine: Uci | undefined;
  try {
    if (kind === "engine") {
      engine = new Uci(executable, signal);
      engine.send("uci");
      await engine.until("uciok");
      engine.send(`setoption name Threads value ${p.analysis.threads}`);
      engine.send(`setoption name Hash value ${p.analysis.hash}`);
      engine.send("isready");
      await engine.until("readyok");
    }
    let lastFetch = 0;
    for (let k = 0; k < indices.length; k++) {
      signal.throwIfAborted();
      const i = indices[k],
        s = g.steps[i];
      if (!s) continue;
      const a = structuredClone(s.move.analysis);
      if (kind === "starter") {
        const found = starterBook(s.fen, s.uci, i);
        a.book = {
          state: i >= 8 ? "not-analyzed" : found ? "found" : "not-found",
          games: 0,
          frequency: 0,
          message:
            "Built-in starter opening repertoire (curated lines; no game counts).",
        };
      } else if (kind === "book") {
        if (i >= p.analysis.cutoff) {
          a.book = {
            state: "not-analyzed",
            games: 0,
            frequency: 0,
            message: "Outside opening cutoff.",
          };
        } else {
          try {
            const cacheKey = key("masters-v2:" + s.fen);
            let raw = await cached(dir, cacheKey);
            if (!raw) {
              await pause(Math.max(0, 1000 - (Date.now() - lastFetch)), signal);
              lastFetch = Date.now();
              const controller = new AbortController(),
                abort = () => controller.abort();
              signal.addEventListener("abort", abort, { once: true });
              const timeout = setTimeout(() => controller.abort(), 15000);
              try {
                const url = new URL("https://explorer.lichess.org/masters");
                url.searchParams.set("fen", s.fen);
                const response = await fetch(url, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  signal: controller.signal,
                });
                if (!response.ok)
                  throw Error(`Masters returned HTTP ${response.status}.`);
                raw = await response.json();
                await atomic(
                  path.join(dir, cacheKey + ".json"),
                  JSON.stringify(raw),
                );
              } finally {
                clearTimeout(timeout);
                signal.removeEventListener("abort", abort);
              }
            }
            const total =
                Number(raw.white ?? 0) +
                Number(raw.draws ?? 0) +
                Number(raw.black ?? 0),
              m = raw.moves?.find((x: { uci: string }) => x.uci === s.uci),
              games = m
                ? Number(m.white ?? 0) +
                  Number(m.draws ?? 0) +
                  Number(m.black ?? 0)
                : 0,
              frequency = total ? games / total : 0;
            a.book = {
              state:
                games >= p.analysis.minGames &&
                frequency >= p.analysis.frequency
                  ? "found"
                  : "not-found",
              games,
              frequency,
              message: `${games} / ${total} Masters games`,
            };
          } catch (err) {
            signal.throwIfAborted();
            a.book = {
              state: "unavailable",
              games: 0,
              frequency: 0,
              message: (err as Error).message,
            };
          }
        }
      } else {
        const id = key(
          JSON.stringify([
            "sacrifice-v1",
            executable,
            engine!.name,
            s.fen,
            s.uci,
            p.analysis,
          ]),
        );
        let data = await cached(dir, id, 30 * 864e5);
        if (!data) {
          data = await reviewMove(engine!, p, s.fen, s.uci);
          await atomic(path.join(dir, id + ".json"), JSON.stringify(data));
        }
        a.engine = data;
      }
      signal.throwIfAborted();
      result[s.move.id] = a;
      progress(k + 1, indices.length);
    }
    return result;
  } catch (e) {
    signal.throwIfAborted();
    if (kind === "engine") {
      for (const i of indices) {
        const s = g.steps[i];
        if (s && !Object.hasOwn(result, s.move.id))
          result[s.move.id] = {
            ...s.move.analysis,
            engine: {
              state: "unavailable",
              score: 0,
              loss: 0,
              best: "",
              label: "good",
              depth: 0,
              message: (e as Error).message,
            },
          };
      }
      return result;
    }
    throw e;
  } finally {
    engine?.stop();
  }
}
