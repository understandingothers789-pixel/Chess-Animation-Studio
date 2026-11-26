import { animationPreset } from "../../core/animationPresets";
import { settingsLabel } from "../commands/bulkEditing";
import { useState } from "react";
import {
  effectSchema,
  presets,
  presetId,
  assignPresetIds,
  uid,
  type Effect,
  type Project,
  type Preset,
} from "../../core/project";
import { personalPresets, storePersonalPreset } from "./personalLibrary";
import {
  applyPresetEffect,
  type SettingsKind,
  settingsKinds,
} from "../../core/editing";
import { presetDescriptions, presetLabels } from "./catalog";
import { PresetPreview } from "./PresetPreview";
import type { Edit } from "../state";
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
  onPausePreview,
  onCancel,
  onFineTune,
  previewActive,
  before,
  onBefore,
  report,
}: {
  project: Project;
  index: number;
  checked: Set<string>;
  edit: Edit;
  onPreview: (effects: ReadonlyMap<string, Effect>, index: number) => void;
  onFineTune: (ids: string[], index: number, kind: SettingsKind) => void;
  previewActive: boolean;
  before: boolean;
  onBefore: (before: boolean) => void;
  report: (message: string) => void;
  onCancel: () => void;
  onPausePreview: () => void;
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
    [replaceAll, setReplaceAll] = useState(false),
    [kind, setKind] = useState<SettingsKind>("movement"),
    [preserveKeys, setPreserveKeys] = useState(true);
  const [demoPreset, setDemoPreset] = useState<Preset | null>(null);
  const items = [
    ...presets.map((id) => ({
      id,
      name: presetLabels[id],
      effect: animationPreset(id),
      description: presetDescriptions[id],
      custom: -1,
      kind: "movement" as SettingsKind,
    })),
    ...p.presets.map((v, i) => ({
      id: presetId(p, i),
      name: v.name,
      effect: v.effect,
      description: "Your saved animation.",
      custom: i,
      kind: v.kind ?? "movement",
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
  const checkedCount = p.moves.filter((m) => checked.has(m.id)).length;
  const selected = items.find((v) => v.id === chosen);
  const previewMove =
    targets.find((m) => m.id === p.moves[index]?.id) ?? targets[0];
  const previewIndex = p.moves.indexOf(previewMove);
  const applyKind = replaceAll ? "everything" : kind;
  const transform = (
    target: Effect,
    source: Effect,
    category = kind,
    replace = replaceAll,
    keep = preserveKeys,
  ) =>
    applyPresetEffect(target, source, p.format, replace, category, keep, false);
  const preview = (
    source: Effect,
    category = kind,
    replace = replaceAll,
    keep = preserveKeys,
    moves = targets,
  ) => {
    const active = moves.find((m) => m.id === p.moves[index]?.id) ?? moves[0];
    if (!active) {
      onCancel();
      return;
    }
    onPreview(
      new Map(
        moves.map((m) => [
          m.id,
          transform(m.effect, source, category, replace, keep),
        ]),
      ),
      p.moves.indexOf(active),
    );
  };
  function apply(tune: boolean) {
    if (!selected || !previewMove) return;
    const ids = new Set(targets.map((m) => m.id));
    edit.begin();
    try {
      edit("Apply animation preset", (draft) => {
        for (const move of draft.moves)
          if (ids.has(move.id))
            move.effect = transform(move.effect, selected.effect);
      });
    } finally {
      edit.end();
    }
    const next = [
      selected.id,
      ...recent.filter((v) => v !== selected.id),
    ].slice(0, 12);
    setRecent(next);
    localStorage.setItem("studio.presetRecent", JSON.stringify(next));
    onCancel();
    if (tune) onFineTune([...ids], previewIndex, applyKind);
    report(
      `${selected.name} applied to ${ids.size === 1 ? previewMove.san : ids.size + " moves"}.`,
    );
  }
  return (
    <section className="preset-browser">
      {demoPreset && (
        <PresetPreview
          initial={demoPreset}
          style={p.style}
          onClose={() => setDemoPreset(null)}
        />
      )}
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
            onChange={(event) => {
              const next = event.target.value;
              setScope(next);
              if (selected && previewActive)
                preview(
                  selected.effect,
                  kind,
                  replaceAll,
                  preserveKeys,
                  next === "all"
                    ? p.moves
                    : next === "group"
                      ? p.moves.filter((m) => checked.has(m.id))
                      : p.moves.slice(index, index + 1),
                );
            }}
          >
            <option value="selected">Selected move</option>
            <option value="group">Checked moves ({checkedCount})</option>
            <option value="all">All moves</option>
          </select>
        </label>
        <label>
          Settings to apply{" "}
          <select
            aria-label="Preset settings category"
            title="Choose the settings category to preview and apply to the target moves."
            aria-description="Choose the settings category to preview and apply to the target moves."
            value={applyKind}
            disabled={replaceAll}
            onChange={(event) => {
              const next = event.target.value as SettingsKind;
              setKind(next);
              if (selected && previewActive) preview(selected.effect, next);
            }}
          >
            {settingsKinds.map((k) => (
              <option key={k} value={k}>
                {settingsLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <details className="preset-advanced">
          <summary>Advanced apply options</summary>
          <p className="hint">
            Timing locks stay in effect. Custom curves can override the preset
            on the channels they control.
          </p>
          <label>
            <input
              type="checkbox"
              checked={!replaceAll && preserveKeys}
              title="Keep custom keyframes that may override the chosen preset channels."
              aria-description="Keep custom keyframes that may override the chosen preset channels."
              disabled={replaceAll}
              onChange={(event) => {
                setPreserveKeys(event.target.checked);
                if (selected && previewActive)
                  preview(
                    selected.effect,
                    kind,
                    replaceAll,
                    event.target.checked,
                  );
              }}
            />{" "}
            Keep existing custom curves
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
                  preview(selected.effect, kind, event.target.checked);
              }}
            />{" "}
            Replace all settings
          </label>
        </details>
        {selected && (
          <p className="preset-selection" role="status">
            <strong>{selected.name}</strong>
            {previewMove
              ? ` · ${settingsLabel(applyKind)} · ${targets.length === 1 ? previewMove.san : targets.length + " moves"}`
              : " · Check moves in the timeline to apply to a group."}
            {previewActive && previewMove && (
              <small>
                {before ? "Original" : "Preview"} · {previewMove.san}
              </small>
            )}
          </p>
        )}
        <div className="button-row preset-playback">
          <button
            disabled={!selected || !previewMove}
            onClick={() => selected && preview(selected.effect)}
          >
            {previewActive ? "Replay preset" : "Preview preset"}
          </button>
          {previewActive && (
            <button aria-pressed={before} onClick={() => onBefore(!before)}>
              {before ? "Play preset" : "Play original"}
            </button>
          )}
          <button
            disabled={!selected}
            onClick={() => {
              choose(null);
              onCancel();
            }}
          >
            Cancel preview
          </button>
        </div>
        <div className="button-row preset-apply">
          <button
            className="primary"
            disabled={!selected || !previewMove}
            onClick={() => apply(false)}
          >
            {scope === "selected" && previewMove
              ? `Apply to ${previewMove.san}`
              : `Apply to ${targets.length} moves`}
          </button>
          <button
            disabled={!selected || !previewMove}
            onClick={() => apply(true)}
          >
            Apply &amp; fine-tune
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
                title={v.description}
                aria-description={v.description}
                aria-pressed={chosen === v.id}
                onClick={() => {
                  choose(v.id);
                  setKind(v.kind);
                  preview(v.effect, v.kind);
                }}
              >
                {v.custom < 0 && (
                  <svg viewBox="0 0 140 65" aria-hidden="true">
                    <path d="M12 50H128" stroke="#56735a" strokeWidth="2" />
                    <g className={`preset-motion motion-${v.effect.preset}`}>
                      <text x="12" y="48" fontSize="32" fill="#d5e8bd">
                        ♞
                      </text>
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
                )}
                <strong>{v.name}</strong>
                <small>
                  {v.custom >= 0
                    ? `Saved ${v.kind} · select to preview actual settings on the board`
                    : v.description}
                </small>
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
              {v.custom < 0 && (
                <button
                  type="button"
                  title={v.description}
                  aria-label={`Pop-up preview for ${v.name}`}
                  onClick={() => {
                    onPausePreview();
                    setDemoPreset(v.effect.preset);
                  }}
                >
                  Preview demo
                </button>
              )}
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
              draft.presets[selected.custom].kind = kind;
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
                  {
                    name: selected.name,
                    effect: selected.effect,
                    kind,
                  },
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
              const {
                name,
                effect: source,
                kind: importedKind,
              } = JSON.parse(await file.text());
              if (
                importedKind !== undefined &&
                !settingsKinds.includes(importedKind)
              )
                throw Error("Invalid settings category");
              if (typeof name !== "string" || !name.trim())
                throw Error("The preset name is missing.");
              const imported = effectSchema.parse(source);
              edit("Import preset", (draft) => {
                if (draft.id === p.id && draft.presets.length < 100)
                  draft.presets.push({
                    id: uid(),
                    name: name.trim().slice(0, 100),
                    effect: imported,
                    kind: importedKind,
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
      <details>
        <summary>Personal preset library · this computer</summary>
        <button
          disabled={!selected}
          onClick={() => {
            if (selected) {
              try {
                storePersonalPreset({
                  id: uid(),
                  name: selected.name,
                  effect: selected.effect,
                  kind,
                });
                report("Saved to personal library.");
              } catch {
                report(
                  "Could not save personal library. Download the preset to keep a copy.",
                );
              }
            }
          }}
        >
          Save selected to personal library
        </button>
        <button
          onClick={() => {
            const saved = personalPresets();
            edit("Import personal presets", (draft) => {
              for (const v of saved)
                if (
                  draft.presets.length < 100 &&
                  !draft.presets.some((p) => p.id === v.id)
                )
                  draft.presets.push(structuredClone(v));
            });
            report("Personal presets copied into this project.");
          }}
        >
          Load personal presets into project
        </button>
      </details>
      <button
        disabled={!selected || p.presets.length >= 100}
        onClick={() => {
          if (selected)
            edit("Duplicate preset", (p) => {
              p.presets.push({
                id: uid(),
                name: (selected.name + " copy").slice(0, 100),
                effect: structuredClone(selected.effect),
                kind,
              });
            });
        }}
      >
        Duplicate selected preset
      </button>
    </section>
  );
}
