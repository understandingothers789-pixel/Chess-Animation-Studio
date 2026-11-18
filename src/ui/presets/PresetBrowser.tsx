import { useState } from "react";
import {
  effect,
  effectSchema,
  presets,
  presetId,
  assignPresetIds,
  uid,
  type Effect,
  type Project,
} from "../../core/project";
import { applyPresetEffect } from "../../core/editing";
import { presetLabels } from "./catalog";
import type { Edit } from "../state";
const descriptions: Record<string, string> = {
  slide: "Direct motion with a smooth arrival.",
  soft: "A gentle deceleration into the destination.",
  spin: "Rotate the piece during its journey.",
  somersault: "Turn head over heels and land upright.",
  flip: "Flip the piece as it travels.",
  sway: "Rock through a full sway.",
  "sway-half": "A single gentle sway.",
  hop: "Lift off the board and land softly.",
  dramatic: "An expressive hop and landing.",
  capture: "Emphasize the impact of a capture.",
  finale: "A bold finish for the final move.",
};
function preference(key: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
export function PresetBrowser({
  project: p,
  index,
  checked,
  edit,
  onPreview,
  onCancel,
  previewActive,
  before,
  onBefore,
  report,
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  onPreview: (e: Effect, replaceAll: boolean) => void;
  previewActive: boolean;
  before: boolean;
  onBefore: (before: boolean) => void;
  report: (message: string) => void;
  onCancel: () => void;
}) {
  const [query, search] = useState(""),
    [scope, setScope] = useState("selected"),
    [chosen, choose] = useState<string | null>(null),
    [favorites, setFavorites] = useState<string[]>(() =>
      preference("studio.favorites"),
    ),
    [recent, setRecent] = useState<string[]>(() =>
      preference("studio.presetRecent"),
    ),
    [filter, setFilter] = useState("all"),
    [replaceAll, setReplaceAll] = useState(false);
  const items = [
    ...presets.map((id) => ({
      id,
      name: presetLabels[id],
      effect: effect(id),
      description: descriptions[id],
      custom: -1,
    })),
    ...p.presets.map((v, i) => ({
      id: presetId(p, i),
      name: v.name,
      effect: v.effect,
      description: "Your saved animation.",
      custom: i,
    })),
  ];
  const targets =
    scope === "all"
      ? p.moves
      : scope === "group"
        ? p.moves.filter((m) => checked.has(m.id))
        : p.moves[index]
          ? [p.moves[index]]
          : [];
  const selected = items.find((v) => v.id === chosen);
  return (
    <section className="preset-browser">
      <input
        aria-label="Search animation presets"
        title="Filter animations by name and description before previewing or applying them."
        aria-description="Filter animations by name and description before previewing or applying them."
        placeholder="Search animations…"
        value={query}
        onChange={(e) => search(e.target.value)}
      />
      <div className="button-row">
        {["all", "favorites", "recent", "custom"].map((v) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => setFilter(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="preset-actions">
        <label>
          Apply animation to{" "}
          <select
            aria-label="Preset target scope"
            title="Choose the active move, the checked group, or every move before applying an animation."
            aria-description="Choose the active move, the checked group, or every move before applying an animation."
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="selected">Selected move</option>
            <option value="group">Selected group</option>
            <option value="all">All moves</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            aria-label="Replace all settings"
            title="Also apply the preset's camera, effects and unlocked timing."
            aria-description="Also apply the preset's camera, effects and unlocked timing."
            checked={replaceAll}
            onChange={(event) => {
              setReplaceAll(event.target.checked);
              if (selected && previewActive)
                onPreview(selected.effect, event.target.checked);
            }}
          />{" "}
          Replace all settings
        </label>
        <p className="hint">
          {replaceAll
            ? "Replace animation, camera, effects and unlocked timing."
            : "Apply movement and keep timing, camera, effects and custom keys."}
        </p>
        {previewActive && selected && (
          <>
            <p role="status">
              {before ? "Original" : "Previewing " + selected.name} on{" "}
              {p.moves[index]?.san}
            </p>
            <button aria-pressed={before} onClick={() => onBefore(!before)}>
              {before ? "Show preset" : "Show original"}
            </button>
          </>
        )}
        <div className="button-row">
          <button
            onClick={() => {
              choose(null);
              onCancel();
            }}
          >
            Cancel preview
          </button>
          <button
            disabled={!selected || !targets.length}
            onClick={() => {
              if (!selected) return;
              const ids = new Set(targets.map((m) => m.id));
              edit("Apply animation preset", (p) => {
                for (const m of p.moves)
                  if (ids.has(m.id))
                    m.effect = applyPresetEffect(
                      m.effect,
                      selected.effect,
                      p.format,
                      replaceAll,
                    );
              });
              const next = [
                selected.id,
                ...recent.filter((v) => v !== selected.id),
              ].slice(0, 12);
              setRecent(next);
              localStorage.setItem("studio.presetRecent", JSON.stringify(next));
              onCancel();
            }}
          >
            {scope === "selected" && targets[0]
              ? `Apply to ${targets[0].san}`
              : `Apply to ${targets.length} moves`}
          </button>
        </div>
      </div>
      <div className="animation-grid">
        {items
          .filter(
            (v) =>
              (v.name + " " + v.description)
                .toLowerCase()
                .includes(query.toLowerCase()) &&
              (filter === "all" ||
                (filter === "favorites" && favorites.includes(v.id)) ||
                (filter === "recent" && recent.includes(v.id)) ||
                (filter === "custom" && v.custom >= 0)),
          )
          .map((v) => (
            <article key={v.id} className={chosen === v.id ? "chosen" : ""}>
              <button
                className="animation-card"
                aria-pressed={chosen === v.id}
                onClick={() => {
                  choose(v.id);
                  onPreview(v.effect, replaceAll);
                }}
              >
                <svg viewBox="0 0 140 65" aria-hidden="true">
                  <path d="M12 50H128" stroke="#56735a" strokeWidth="2" />
                  <g className={`preset-motion motion-${v.effect.preset}`}>
                    <circle cx="25" cy="38" r="11" fill="#d5e8bd" />
                    <path d="M19 38H31M25 32V44" stroke="#233c2b" />
                  </g>
                  <circle
                    cx="115"
                    cy="38"
                    r="13"
                    fill="none"
                    stroke="#94b47b"
                    strokeDasharray="3 3"
                  />
                </svg>
                <strong>{v.name}</strong>
                <small>{v.description}</small>
              </button>
              <button
                aria-label={`Favorite ${v.name}`}
                aria-pressed={favorites.includes(v.id)}
                onClick={() => {
                  const next = favorites.includes(v.id)
                    ? favorites.filter((x) => x !== v.id)
                    : [...favorites, v.id];
                  setFavorites(next);
                  localStorage.setItem(
                    "studio.favorites",
                    JSON.stringify(next),
                  );
                }}
              >
                ☆
              </button>
              {v.custom >= 0 && (
                <>
                  <button
                    onClick={() => {
                      const name = prompt("Preset name", v.name);
                      if (name?.trim())
                        edit("Rename preset", (p) => {
                          p.presets[v.custom].name = name.trim().slice(0, 100);
                        });
                    }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() =>
                      edit("Delete preset", (p) => {
                        assignPresetIds(p);
                        p.presets.splice(v.custom, 1);
                        choose(null);
                        onCancel();
                      })
                    }
                  >
                    Delete
                  </button>
                </>
              )}
            </article>
          ))}
      </div>
      {selected && selected.custom >= 0 && p.moves[index] && (
        <button
          onClick={() =>
            edit("Update preset from move", (draft) => {
              assignPresetIds(draft);
              draft.presets[selected.custom].effect = structuredClone(
                draft.moves[index].effect,
              );
            })
          }
        >
          Update from {p.moves[index].san}
        </button>
      )}
      <button
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          const url = URL.createObjectURL(
            new Blob(
              [
                JSON.stringify(
                  { name: selected.name, effect: selected.effect },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            ),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download =
            selected.name.replace(/[^a-z0-9_-]+/gi, "-") + ".chess-preset.json";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download preset
      </button>
      <label className="text-field">
        Import preset
        <input
          type="file"
          accept=".json"
          aria-label="Import preset"
          title="Import a Chess Animation Studio preset JSON file."
          aria-description="Import a previously downloaded preset into this project."
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              if (file.size > 1000000 || p.presets.length >= 100)
                throw Error("Preset file or library exceeds its limit.");
              const { name, effect: source } = JSON.parse(await file.text());
              if (typeof name !== "string" || !name.trim())
                throw Error("The preset name is missing.");
              const imported = effectSchema.parse(source);
              edit("Import preset", (draft) => {
                if (draft.id === p.id && draft.presets.length < 100)
                  draft.presets.push({
                    id: uid(),
                    name: name.trim().slice(0, 100),
                    effect: imported,
                  });
              });
              report("Preset imported.");
            } catch {
              report(
                "Could not import this preset. Choose a Chess Animation Studio preset JSON file and check that the library has space.",
              );
            }
          }}
        />
      </label>
      <button
        disabled={!selected || p.presets.length >= 100}
        onClick={() => {
          if (selected)
            edit("Duplicate preset", (p) => {
              p.presets.push({
                id: uid(),
                name: (selected.name + " copy").slice(0, 100),
                effect: structuredClone(selected.effect),
              });
            });
        }}
      >
        Duplicate selected preset
      </button>
    </section>
  );
}
