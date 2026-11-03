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
}: {
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
        Draw arrows with two square clicks; circles with one. Alt-click the
        preview to position selected text.
      </p>
      <div className="button-row">
        {(["arrow", "circle", "text", "caption"] as const).map((kind) => (
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
          <div className="button-row">
            <button
              onClick={() =>
                onDraw(
                  a.kind === "arrow" || a.kind === "circle" ? a.kind : null,
                )
              }
            >
              Reposition on board
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
                aria-label="Annotation text"
                value={a.text}
                onChange={(e) => patch({ text: e.target.value })}
              />
              <label>
                Font
                <select
                  value={a.font}
                  onChange={(e) =>
                    patch({ font: e.target.value as Annotation["font"] })
                  }
                >
                  {["sans-serif", "serif", "monospace"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Alignment
                <select
                  value={a.align}
                  onChange={(e) =>
                    patch({ align: e.target.value as Annotation["align"] })
                  }
                >
                  {["left", "center", "right"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          {(
            [
              "start",
              "end",
              "fade",
              "opacity",
              ...(a.kind === "text" || a.kind === "caption"
                ? ["x", "y", "size"]
                : ["width"]),
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
