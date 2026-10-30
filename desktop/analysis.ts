import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { type Project } from "../src/core/project";
import { buildGame } from "../src/core/chess";
import { atomic } from "./files";
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
  constructor(executable: string, signal: AbortSignal) {
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
    signal.addEventListener("abort", () => this.stop(), { once: true });
  }
  send(s: string) {
    this.child.stdin.write(s + "\n");
  }
  async until(token: string, ms = 10000) {
    const found = () =>
      this.lines.some((x) => x.startsWith(token) || x.startsWith("ERROR"));
    if (!found())
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
    const lines = this.lines.splice(0);
    const error = lines.find((l) => l.startsWith("ERROR"));
    if (error) throw Error(error);
    return lines;
  }
  async search(fen: string, p: Project, played?: string) {
    this.lines = [];
    this.send("position fen " + fen);
    this.send(
      `go depth ${p.analysis.depth} movetime ${p.analysis.milliseconds}${played ? " searchmoves " + played : ""}`,
    );
    const lines = await this.until("bestmove", p.analysis.milliseconds + 12000);
    let score = 0,
      depth = 0;
    for (const l of lines) {
      const match = l.match(/score (cp|mate) (-?\d+)/);
      if (match) {
        score =
          match[1] === "mate"
            ? Math.sign(+match[2]) * (100000 - Math.abs(+match[2]) * 100)
            : +match[2];
        depth = Number(l.match(/depth (\d+)/)?.[1] ?? depth);
      }
    }
    return {
      score,
      depth,
      best: lines.find((l) => l.startsWith("bestmove "))?.split(" ")[1] ?? "",
    };
  }
  stop() {
    this.child.kill();
  }
}
export async function analyze(
  p: Project,
  kind: "book" | "engine",
  indices: number[],
  dir: string,
  executable: string,
  token: string,
  signal: AbortSignal,
  progress: (done: number, total: number) => void,
) {
  await fs.mkdir(dir, { recursive: true });
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
      if (kind === "book") {
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
          JSON.stringify([executable, engine!.name, s.fen, s.uci, p.analysis]),
        );
        let data = await cached(dir, id, 30 * 864e5);
        if (!data) {
          const best = await engine!.search(s.fen, p),
            played =
              best.best === s.uci
                ? best
                : await engine!.search(s.fen, p, s.uci),
            loss = Math.max(0, best.score - played.score);
          data = {
            state: "done",
            score: played.score,
            loss,
            best: best.best,
            label:
              best.best === s.uci
                ? "best"
                : loss < 35
                  ? "good"
                  : loss < 90
                    ? "inaccuracy"
                    : loss < 180
                      ? "mistake"
                      : "blunder",
            depth: played.depth,
            message: engine!.name + "; root mover perspective",
          };
          await atomic(path.join(dir, id + ".json"), JSON.stringify(data));
        }
        a.engine = data;
      }
      result[s.move.id] = a;
      progress(k + 1, indices.length);
    }
    return result;
  } catch (e) {
    signal.throwIfAborted();
    if (kind === "engine") {
      for (const i of indices) {
        const s = g.steps[i];
        if (s)
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
