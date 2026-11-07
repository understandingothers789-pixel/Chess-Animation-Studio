import type { Project } from "../../core/project";
import { compileStoryboard } from "../../core/storyboard";
export type ThumbnailRenderer = (
  p: Project,
  time: number,
  w: number,
  h: number,
) => string | null;
export type ThumbnailPort = { current: ThumbnailRenderer | null };
/** One idle queue borrows the existing preview renderer; no per-card WebGL contexts. */
export class StoryThumbnails {
  private cache = new Map<string, string>();
  private pending = new Map<string, Promise<string | null>>();
  private tasks: (() => void)[] = [];
  private busy = false;
  constructor(readonly port: ThumbnailPort) {}
  request(p: Project, id: string): Promise<string | null> {
    const entry = compileStoryboard(p).shots.find((e) => e.shot.id === id);
    if (!entry) return Promise.resolve(null);
    const { storyboard, pgn, lines, music, cues, scenes, ...visual } = p;
    const key = JSON.stringify({
      visual,
      shot: entry.shot,
      start: entry.start,
      beats: p.storyboard.beats,
    });
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = this.pending.get(key);
    if (pending) return pending;
    const promise = new Promise<string | null>((resolve) => {
      this.tasks.push(() => {
        let result: string | null = null;
        try {
          const local = Math.min(
            entry.shot.duration - 0.02,
            Math.max(
              0.02,
              entry.shot.preHold +
                (entry.shot.duration -
                  entry.shot.preHold -
                  entry.shot.postHold) *
                  0.6,
            ),
          );
          const w = p.format === "landscape" ? 240 : 136,
            h =
              p.format === "landscape"
                ? 135
                : p.format === "square"
                  ? 136
                  : 242;
          result = this.port.current?.(p, entry.start + local, w, h) ?? null;
        } catch {}
        if (result) {
          this.cache.set(key, result);
          while (this.cache.size > 48)
            this.cache.delete(this.cache.keys().next().value!);
        }
        this.pending.delete(key);
        resolve(result);
      });
    });
    this.pending.set(key, promise);
    this.pump();
    return promise;
  }
  private pump() {
    if (this.busy) return;
    this.busy = true;
    const next = () => {
      const task = this.tasks.shift();
      if (!task) {
        this.busy = false;
        return;
      }
      task();
      setTimeout(next, 24);
    };
    setTimeout(next, 24);
  }
}
