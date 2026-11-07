import type { Project } from "./project";
import type { ExportOptions } from "../bridge";
import { audioEvents } from "./audioEvents";
/** Conservative badge dependencies, exact selected-format background and output audio.
 * Unreferenced library files are never read by the export worker. */
export function requiredAssetIds(p: Project, o: ExportOptions) {
  const ids = new Set<string>(),
    bg = p.layouts[o.format];
  if (bg.background === "image" && bg.image) ids.add(bg.image);
  for (const id of Object.values(p.badgeAssets)) if (id) ids.add(id);
  if (p.music.asset && !p.music.muted) ids.add(p.music.asset);
  for (const event of audioEvents(p, o.mode))
    if (
      event.at < o.end &&
      event.end > o.start &&
      event.asset &&
      event.asset !== "__knightHorse"
    )
      ids.add(event.asset);
  return ids;
}
