import type { Project, PlaybackMode } from "./project";
import { buildGame } from "./chess";
import { compileTimeline } from "./timeline";
import { compileStoryboard } from "./storyboard";
export type AudioEvent = {
  id: string;
  asset: string | null;
  at: number;
  offset: number;
  end: number;
  duration: number | null;
  volume: number;
  kind: "move" | "capture" | "custom";
  bus: "chess" | "effects";
  moveId: string | null;
};
const cache = new WeakMap<
  Project,
  Partial<Record<PlaybackMode, AudioEvent[]>>
>();
export function audioEvents(
  p: Project,
  mode: PlaybackMode = "source",
): AudioEvent[] {
  const saved = cache.get(p)?.[mode];
  if (saved) return saved;
  const timeline = compileTimeline(p),
    game = mode === "storyboard" ? compileStoryboard(p).game : buildGame(p);
  const events: AudioEvent[] = p.cues.map((c) => {
    const i = c.move ? p.moves.findIndex((m) => m.id === c.move) : -1;
    return {
      id: c.id,
      asset: c.asset,
      at: (i >= 0 ? timeline.segments[i].land : 0) + c.time,
      offset: 0,
      end: timeline.duration,
      duration: null,
      volume: c.volume,
      kind: c.kind,
      bus: c.bus,
      moveId: c.move,
    };
  });
  for (let i = 0; i < p.moves.length; i++) {
    if (p.audio.automatic)
      events.push({
        id: `auto-${p.moves[i].id}`,
        asset: null,
        at: timeline.segments[i].land,
        offset: 0,
        end: timeline.duration,
        duration: 0.2,
        volume: 0.7,
        kind: game.steps[i].capturedId ? "capture" : "move",
        bus: "chess",
        moveId: p.moves[i].id,
      });
    if (
      p.audio.knightHorse &&
      game.steps[i].before.find((piece) => piece.id === game.steps[i].pieceId)
        ?.type === "n"
    )
      events.push({
        id: `horse-${p.moves[i].id}`,
        asset: "__knightHorse",
        at: timeline.segments[i].land + p.audio.knightOffset,
        offset: 0,
        end: timeline.duration,
        duration: p.audio.knightDuration,
        volume: p.audio.knightVolume,
        kind: "custom",
        bus: "chess",
        moveId: p.moves[i].id,
      });
  }
  let result = events;
  if (mode === "storyboard") {
    result = [];
    for (const entry of compileStoryboard(p).shots) {
      if (entry.shot.kind !== "move-range" || entry.issue) continue;
      const ids = new Set(
        p.moves.slice(entry.startIndex, entry.endIndex + 1).map((m) => m.id),
      );
      const rate =
        (entry.sourceEnd - entry.sourceStart) /
        (entry.shot.duration - entry.shot.preHold - entry.shot.postHold);
      for (const event of events) {
        if (event.moveId && !ids.has(event.moveId)) continue;
        if (!event.moveId && event.at < entry.sourceStart) continue;
        if (event.at >= entry.sourceEnd) continue;
        const rawAt =
          entry.start +
          entry.shot.preHold +
          (event.at - entry.sourceStart) / rate;
        const at = Math.max(entry.start, rawAt),
          end = Math.min(entry.end, rawAt + (event.duration ?? Infinity));
        if (at >= end) continue;
        result.push({
          ...event,
          id: `${entry.shot.id}:${event.id}`,
          at,
          end,
          offset: at - rawAt,
        });
      }
    }
  }
  result.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const record = cache.get(p) ?? {};
  record[mode] = result;
  cache.set(p, record);
  return result;
}
