import { CaptionControls } from "../captions/CaptionControls";
import {
  annotationSchema,
  annotation,
  type Annotation,
} from "../../core/annotations";
import type { Project } from "../../core/project";
import type { Edit } from "../state";
export function AnnotationEditor({
  project: p,
  edit,
  time,
  selected,
  onSelect,
  onDraw,
  allowBoard = true,
  textLabel = "Annotation text",
}: {
  allowBoard?: boolean;
  textLabel?: string;
  project: Project;
  edit: Edit;
  time: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onDraw: (kind: "arrow" | "circle" | null) => void;
}) {
  const a = p.annotations.find((a) => a.id === selected);
  const patch = (v: Partial<Annotation>) =>
    annotationSchema.safeParse({ ...a, ...v }).success &&
    edit("Edit annotation", (p) => {
      Object.assign(p.annotations.find((a) => a.id === selected)!, v);
    });
  return (
    <section className="annotation-editor">
      <h3>Explanations</h3>
      <p className="hint">
        Draw arrows with two square clicks; circles with one. Click text in the
        preview to move it; drag its side handle to resize wrapping. Alt
        bypasses snapping.
      </p>
      <div className="button-row">
        {(["arrow", "circle", "text", "caption"] as const)
          .filter(
            (kind) => allowBoard || (kind !== "arrow" && kind !== "circle"),
          )
          .map((kind) => (
            <button
              key={kind}
              onClick={() => {
                if (kind === "arrow" || kind === "circle") {
                  onSelect("");
                  onDraw(kind);
                } else {
                  const a = annotation(kind, time);
                  edit("Add annotation", (p) => {
                    p.annotations.push(a);
                  });
                  onSelect(a.id);
                  onDraw(null);
                }
              }}
            >
              + {kind}
            </button>
          ))}
      </div>
      <div className="text-layer-list" aria-label="Text layers">
        {p.annotations
          .filter((a) => a.kind === "text" || a.kind === "caption")
          .map((a) => (
            <button
              key={a.id}
              aria-pressed={a.id === selected}
              onClick={() => onSelect(a.id)}
            >
              {a.text || "Empty text"} · {a.start.toFixed(2)}–{a.end.toFixed(2)}
              s
            </button>
          ))}
      </div>
      <select
        aria-label="Selected annotation"
        value={selected ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select annotation</option>
        {p.annotations.map((a) => (
          <option key={a.id} value={a.id}>
            {a.kind} · {a.start.toFixed(1)}s ·{" "}
            {a.kind === "arrow" ? a.from + " → " + a.to : a.text.slice(0, 25)}
          </option>
        ))}
      </select>
      {a && (
        <>
          <div className="button-row layer-actions">
            <button
              disabled={p.annotations.length >= 50}
              onClick={() => {
                const copy = structuredClone(a);
                copy.id = crypto.randomUUID();
                copy.y = Math.min(0.95, a.y + 0.03);
                edit("Duplicate text layer", (p) => {
                  if (p.annotations.length < 50) p.annotations.push(copy);
                });
                onSelect(copy.id);
              }}
            >
              Duplicate layer
            </button>
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                disabled={
                  p.annotations.indexOf(a) + dir < 0 ||
                  p.annotations.indexOf(a) + dir >= p.annotations.length
                }
                onClick={() =>
                  edit("Reorder text layer", (p) => {
                    const i = p.annotations.findIndex((v) => v.id === a.id);
                    const [item] = p.annotations.splice(i, 1);
                    p.annotations.splice(i + dir, 0, item);
                  })
                }
              >
                {dir < 0 ? "Send backward" : "Bring forward"}
              </button>
            ))}
            <button
              onClick={() =>
                onDraw(
                  a.kind === "arrow" || a.kind === "circle" ? a.kind : null,
                )
              }
            >
              Edit placement
            </button>
            <button
              onClick={() =>
                edit("Delete annotation", (p) => {
                  p.annotations = p.annotations.filter((v) => v.id !== a.id);
                })
              }
            >
              Delete
            </button>
          </div>
          {(a.kind === "text" || a.kind === "caption") && (
            <>
              <textarea
                aria-label={textLabel}
                value={a.text}
                onChange={(e) => patch({ text: e.target.value })}
              />
              <CaptionControls a={a} format={p.format} patch={patch} />
            </>
          )}
          {(
            [
              "start",
              "end",
              "fade",
              "opacity",
              ...(a.kind === "text" || a.kind === "caption" ? [] : ["width"]),
            ] as const
          ).map((key) => (
            <label key={key}>
              {key}
              <input
                aria-label={`Annotation ${key}`}
                type="number"
                step={key === "size" ? 1 : 0.05}
                min={key === "end" ? a.start + 0.05 : 0}
                max={
                  key === "opacity" || key === "x" || key === "y"
                    ? 1
                    : key === "width"
                      ? 0.3
                      : key === "fade"
                        ? 5
                        : key === "size"
                          ? 160
                          : 86400
                }
                value={a[key as keyof Annotation] as number}
                onChange={(e) => {
                  const n = +e.target.value;
                  if (
                    (key === "end" && n <= a.start) ||
                    (key === "start" && n >= a.end)
                  )
                    return;
                  patch({ [key]: n });
                }}
              />
            </label>
          ))}
          <label>
            Color
            <input
              type="color"
              value={a.color}
              onChange={(e) => patch({ color: e.target.value })}
            />
          </label>
          <label>
            Background
            <input
              type="color"
              value={a.background}
              onChange={(e) => patch({ background: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={a.outline}
              onChange={(e) => patch({ outline: e.target.checked })}
            />
            Text outline
          </label>
          <label>
            <input
              type="checkbox"
              checked={a.shadow}
              onChange={(e) => patch({ shadow: e.target.checked })}
            />
            Text shadow
          </label>
          <label>
            Entrance
            <select
              value={a.entrance}
              onChange={(e) =>
                patch({ entrance: e.target.value as Annotation["entrance"] })
              }
            >
              {["fade", "pop", "none"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Exit
            <select
              value={a.exit}
              onChange={(e) =>
                patch({ exit: e.target.value as Annotation["exit"] })
              }
            >
              {["fade", "none"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}
