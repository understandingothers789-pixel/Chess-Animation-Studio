import { useState } from "react";
import type { Annotation } from "../../core/annotations";
import type { Format } from "../../core/project";
import { placements, safeDefaults } from "../../core/captions/safeAreas";
import {
  captionPresets,
  applyCaptionPreset,
} from "../../core/captions/presets";
import { layoutCaption } from "../../core/captions/layout";
import { sizes } from "../../core/project";
export function CaptionControls({
  a,
  format,
  patch,
}: {
  a: Annotation;
  format: Format;
  patch: (v: Partial<Annotation>) => void;
}) {
  const [candidate, setCandidate] =
    useState<(typeof captionPresets)[number]>("Clean Tutorial");
  const measure = (t: string, size: number, font: string, weight: number) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(t).width;
  };
  const l = layoutCaption(a, ...sizes[format], format, measure);
  const settings = (v: Partial<Annotation["layout"]>) =>
    patch({ layout: { ...a.layout, ...v } });
  const numeric = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    update: (n: number) => void,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = +e.target.value;
          if (Number.isFinite(n) && n >= min && n <= max) update(n);
        }}
      />
    </label>
  );
  return (
    <div className="caption-controls">
      <label>
        Placement
        <select
          aria-label="Caption placement"
          value={a.layout.placement}
          onChange={(e) => {
            const placement = e.target
              .value as Annotation["layout"]["placement"];
            patch({
              x: 0.5,
              y: safeDefaults(format, placement).y,
              layout: { ...a.layout, placement, customMargins: false },
            });
          }}
        >
          {placements.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        <input
          aria-label="Auto-size caption"
          type="checkbox"
          checked={a.layout.autoSize}
          onChange={(e) => settings({ autoSize: e.target.checked })}
        />
        Auto-size within readable limits
      </label>
      {numeric("Caption font size", a.size, 12, 160, 1, (size) =>
        patch({ size }),
      )}
      {numeric(
        "Caption maximum lines",
        a.layout.maxLines,
        1,
        20,
        1,
        (maxLines) => settings({ maxLines }),
      )}
      <label>
        Caption alignment
        <select
          aria-label="Caption alignment"
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
      {l.overflow && (
        <p className="danger" role="status">
          Caption exceeds the available safe area. Reduce text length, allow
          more lines, or increase the caption area.
        </p>
      )}
      <details>
        <summary>Caption presets · selected caption</summary>
        <select
          aria-label="Caption preset"
          value={candidate}
          onChange={(e) => setCandidate(e.target.value as typeof candidate)}
        >
          {captionPresets.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <p
          style={{ fontFamily: applyCaptionPreset(a, candidate, format).font }}
        >
          {candidate}: {a.text || "Your caption"} ·{" "}
          {applyCaptionPreset(a, candidate, format).layout.placement}
        </p>
        <button onClick={() => patch(applyCaptionPreset(a, candidate, format))}>
          Apply caption preset
        </button>
      </details>
      <details>
        <summary>Advanced caption layout</summary>
        <label>
          Caption font
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
        {numeric(
          "Minimum caption size",
          a.layout.minSize,
          12,
          160,
          1,
          (minSize) => settings({ minSize }),
        )}
        {numeric("Caption text scale", a.layout.scale, 0.5, 2, 0.05, (scale) =>
          settings({ scale }),
        )}
        {numeric(
          "Caption maximum width",
          a.layout.maxWidth,
          0.1,
          1,
          0.01,
          (maxWidth) => settings({ maxWidth }),
        )}
        {numeric(
          "Caption line spacing",
          a.layout.lineSpacing,
          1,
          2,
          0.05,
          (lineSpacing) => settings({ lineSpacing }),
        )}
        {numeric("Caption weight", a.layout.weight, 100, 900, 100, (weight) =>
          settings({ weight }),
        )}
        {numeric("Caption X", a.x, 0, 1, 0.01, (x) => patch({ x }))}
        {numeric("Caption Y", a.y, 0, 1, 0.01, (y) => patch({ y }))}
        <label>
          <input
            type="checkbox"
            checked={a.layout.customMargins}
            onChange={(e) => settings({ customMargins: e.target.checked })}
          />
          Custom safe margins (frame fraction)
        </label>
        {a.layout.customMargins &&
          (["top", "bottom", "left", "right"] as const).map((key) => (
            <div key={key}>
              {numeric(
                `Safe ${key}`,
                a.layout[key],
                0,
                key === "left" || key === "right" ? 0.4 : 0.45,
                0.01,
                (n) => settings({ [key]: n }),
              )}
            </div>
          ))}
        <label>
          Caption color
          <input
            type="color"
            value={a.color}
            onChange={(e) => patch({ color: e.target.value })}
          />
        </label>
        <label>
          Caption background
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
          Outline
        </label>
        <label>
          <input
            type="checkbox"
            checked={a.shadow}
            onChange={(e) => patch({ shadow: e.target.checked })}
          />
          Shadow
        </label>
      </details>
    </div>
  );
}
