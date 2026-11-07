import type { Project } from "../../core/project";
import type { ExportOptions } from "../../bridge";
import { productionChecks } from "../../core/productionChecks";
export function ProductionChecks({
  p,
  options,
  close,
}: {
  p: Project;
  options: ExportOptions;
  close: () => void;
}) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  const issues = productionChecks(p, options, (text, size, font, weight) => {
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(text).width;
  });
  return (
    <details className="production-checks" open>
      <summary>
        Production checks ·{" "}
        {issues.filter((i) => i.severity === "error").length} errors ·{" "}
        {issues.filter((i) => i.severity === "warning").length} warnings
      </summary>
      {issues.length ? (
        issues.map((i, n) => (
          <p key={n} className={i.severity === "error" ? "danger" : "hint"}>
            <strong>{i.severity}</strong> · {i.message}
            {i.shotId && (
              <button
                onClick={() => {
                  close();
                  requestAnimationFrame(() => {
                    const card = document.querySelector<HTMLElement>(
                      `[data-shot-id="${i.shotId}"]`,
                    );
                    card?.click();
                    card?.scrollIntoView({
                      block: "nearest",
                      inline: "center",
                    });
                  });
                }}
              >
                Open shot
              </button>
            )}
          </p>
        ))
      ) : (
        <p className="hint">
          Caption geometry, shot references, music timing, and output settings
          checked.
        </p>
      )}
    </details>
  );
}
