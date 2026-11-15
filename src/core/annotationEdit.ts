import type { Annotation } from "./annotations";
import type { Project } from "./project";
/** Annotation gestures cannot modify moves, audio or unrelated shots. Borrow those
 * immutable branches and clone only the target layer list for history isolation. */
export function updateAnnotations(
  p: Project,
  change: (layers: Annotation[]) => void,
  shotId?: string,
): Project {
  const shot = shotId
    ? p.storyboard.shots.find((s) => s.id === shotId)
    : undefined;
  if (shotId && !shot) return p;
  const previous = shot ? shot.annotations : p.annotations;
  const layers = structuredClone(previous);
  change(layers);
  if (JSON.stringify(layers) === JSON.stringify(previous)) return p;
  return shot
    ? {
        ...p,
        storyboard: {
          ...p.storyboard,
          shots: p.storyboard.shots.map((s) =>
            s === shot ? { ...s, annotations: layers } : s,
          ),
        },
      }
    : { ...p, annotations: layers };
}
