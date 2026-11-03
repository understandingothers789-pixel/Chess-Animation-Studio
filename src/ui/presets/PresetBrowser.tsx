import { useState } from "react";
import { effect, presets, type Effect, type Project } from "../../core/project";
import { presetLabels } from "./catalog";
import type { Edit } from "../state";
const descriptions: Record<string, string> = {
  slide: "Direct motion with a smooth arrival.",
  soft: "A gentle deceleration into the destination.",
  spin: "Rotate the piece during its journey.",
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
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  onPreview: (e: Effect) => void;
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
    [filter, setFilter] = useState("all");
  const items = [
    ...presets.map((id) => ({
      id,
      name: presetLabels[id],
      effect: effect(id),
      description: descriptions[id],
      custom: -1,
    })),
    ...p.presets.map((v, i) => ({
      id: `custom-${i}`,
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
                  onPreview(v.effect);
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
      <p className="hint">
        Browse without changing your project. The composition preview shows the
        selected animation.
      </p>
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
                if (ids.has(m.id)) m.effect = structuredClone(selected.effect);
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
          Apply to {targets.length} move{targets.length === 1 ? "" : "s"}
        </button>
      </div>
      <button
        disabled={!selected}
        onClick={() => {
          if (selected)
            edit("Duplicate preset", (p) => {
              p.presets.push({
                name: selected.name + " copy",
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
