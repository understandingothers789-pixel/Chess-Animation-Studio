import { requiredAssetIds } from "./exportAssets";
import type { Project } from "./project";
import type { ExportOptions } from "../bridge";
import { compileStoryboard } from "./storyboard";
import { validateExport } from "./exportOptions";
import { layoutCaption, type Measure } from "./captions/layout";
import { soundtrackWindow } from "./audio/timing";
export type ProductionIssue = {
  severity: "error" | "warning" | "info";
  message: string;
  shotId?: string;
};
export function productionChecks(
  p: Project,
  o: ExportOptions,
  measure?: Measure,
): ProductionIssue[] {
  const issues: ProductionIssue[] = [];
  try {
    validateExport(p, o);
  } catch (e) {
    issues.push({ severity: "error", message: (e as Error).message });
  }
  for (const id of requiredAssetIds(p, o))
    if (!p.assets.some((a) => a.id === id) && id !== p.music.asset)
      issues.push({
        severity: "error",
        message: "Required export asset is missing: " + id,
      });
  const story = compileStoryboard(p),
    end = o.mode === "storyboard" ? story.duration : o.end;
  const collections =
    o.mode === "storyboard"
      ? story.shots.map((e) => ({
          annotations: e.shot.annotations,
          duration: e.shot.duration,
          shotId: e.shot.id,
          name: e.shot.name,
        }))
      : [
          {
            annotations: p.annotations,
            duration: o.end,
            shotId: undefined,
            name: "Full game",
          },
        ];
  for (const group of collections)
    for (const a of group.annotations) {
      if (a.kind !== "caption" && a.kind !== "text") continue;
      const warn = (message: string) =>
        issues.push({
          severity: "warning",
          shotId: group.shotId,
          message: `${group.name}: ${message}`,
        });
      if (a.end > group.duration)
        warn("Caption extends beyond its shot. Adjust caption end time.");
      if (a.start >= a.end || a.start >= group.duration)
        warn("Caption timing falls outside the shot. Adjust start and end.");
      if (measure) {
        const l = layoutCaption(a, o.width!, o.height!, o.format, measure);
        if (l.overflow)
          warn(
            "Caption exceeds its safe area. Reduce text, increase maximum lines, or increase caption area.",
          );
        if (l.fontSize / Math.min(o.width!, o.height!) < 0.02)
          warn(
            "Caption may be difficult to read at this output size. Increase font size.",
          );
      }
    }
  if (p.music.asset) {
    if (!p.music.muted && !p.assets.some((a) => a.id === p.music.asset))
      issues.push({
        severity: "error",
        message:
          "Soundtrack asset is missing. Relink or remove it in Soundtrack & output beats.",
      });
    if (
      !p.music.muted &&
      (p.music.trimStart >= (p.music.trimEnd || p.music.sourceDuration) ||
        p.music.trimEnd > p.music.sourceDuration)
    )
      issues.push({
        severity: "error",
        message:
          "Music source trim is invalid. Source end must follow source start and fit the audio duration.",
      });
    const win = soundtrackWindow(p, end);
    if (!p.music.muted && win.end <= win.start)
      issues.push({
        severity: "warning",
        message:
          "The soundtrack falls outside the video. Adjust its output offset or source trim to hear it.",
      });
    else if (!p.music.muted && win.end < end - 0.05)
      issues.push({
        severity: "warning",
        message: `Music ends at ${win.end.toFixed(2)}s before the video. Adjust trim or choose a longer soundtrack if desired.`,
      });
    if (p.music.muted)
      issues.push({ severity: "info", message: "The soundtrack is muted." });
  }
  if (o.mode === "storyboard" && p.storyboard.beats.some((b) => b.time > end))
    issues.push({
      severity: "warning",
      message: "Some output beats fall beyond the storyboard duration.",
    });
  return issues;
}
