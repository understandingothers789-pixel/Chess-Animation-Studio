import type { Project } from "../../core/project";
import { duration, segments } from "../../core/timeline";
import type { Annotation } from "../../core/annotations";
import type { Edit } from "../state";
import type { MenuAction } from "../timeline/TimelineMenu";
export type AnnotationStyle = Pick<
  Annotation,
  | "color"
  | "background"
  | "width"
  | "opacity"
  | "fade"
  | "entrance"
  | "exit"
  | "size"
  | "font"
  | "align"
  | "outline"
  | "shadow"
>;
const keys = [
  "color",
  "background",
  "width",
  "opacity",
  "fade",
  "entrance",
  "exit",
  "size",
  "font",
  "align",
  "outline",
  "shadow",
] as const;
export function annotationCommands(
  p: Project,
  id: string | undefined,
  index: number,
  time: number,
  edit: Edit,
  inspect: (i: number, s: string, id?: string) => void,
  seek: (t: number) => void,
  style: { current: AnnotationStyle | null },
): MenuAction[] {
  const a = p.annotations.find((a) => a.id === id),
    length = duration(p);
  if (!a)
    return [
      { label: "Edit annotations…", run: () => inspect(index, "annotations") },
    ];
  const patch = (label: string, fn: (a: Annotation) => void) =>
    edit(label, (p) => {
      const target = p.annotations.find((v) => v.id === id);
      if (target) fn(target);
    });
  const seg = segments(p)[index];
  return [
    { label: `Edit ${a.kind}…`, run: () => inspect(index, "annotations", id) },
    {
      label: "Preview annotation",
      run: () => seek(Math.min(a.end - 0.01, a.start + a.fade)),
    },
    {
      label: "Duplicate annotation",
      run: () => {
        const copy = structuredClone(a);
        copy.id = crypto.randomUUID();
        copy.start = Math.min(Math.max(0, length - 0.05), a.start + 0.15);
        copy.end = Math.min(length, Math.max(copy.start + 0.05, a.end + 0.15));
        if (a.kind === "text" || a.kind === "caption") {
          copy.x = Math.min(0.95, a.x + 0.025);
          copy.y = Math.min(0.95, a.y + 0.025);
        }
        edit("Duplicate annotation", (p) => {
          p.annotations.push(copy);
        });
        inspect(index, "annotations", copy.id);
      },
    },
    {
      label: "Copy style",
      run: () => {
        style.current = Object.fromEntries(
          keys.map((k) => [k, a[k]]),
        ) as AnnotationStyle;
      },
    },
    {
      label: "Paste style",
      disabled: !style.current,
      run: () =>
        patch("Paste annotation style", (a) => Object.assign(a, style.current)),
    },
    {
      label: "Timing",
      children: [
        {
          label: "Start at playhead",
          disabled: time >= a.end,
          run: () =>
            patch("Start annotation", (a) => {
              a.start = time;
            }),
        },
        {
          label: "End at playhead",
          disabled: time <= a.start,
          run: () =>
            patch("End annotation", (a) => {
              a.end = time;
            }),
        },
        {
          label: "Match selected move",
          disabled: !seg,
          run: () =>
            patch("Align annotation", (a) => {
              a.start = seg.start;
              a.end = seg.end;
            }),
        },
        {
          label: "Extend to next move",
          disabled: !seg,
          run: () =>
            patch("Extend annotation", (a) => {
              a.end = Math.min(
                length,
                Math.max(a.start + 0.05, segments(p)[index + 1]?.end ?? length),
              );
            }),
        },
      ],
    },
    {
      label: "Delete annotation",
      danger: true,
      shortcut: "Undo available",
      run: () =>
        edit("Delete annotation", (p) => {
          p.annotations = p.annotations.filter((a) => a.id !== id);
        }),
    },
  ];
}
