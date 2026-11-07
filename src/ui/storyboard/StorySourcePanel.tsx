import { useMemo, useState } from "react";
import type { Project } from "../../core/project";
import { highlightGroups, highlightMatches } from "../../core/highlights";
export function StorySourcePanel({
  p,
  selected,
  checked,
  select,
  setChecked,
  add,
  openSource,
  hold,
  audio,
}: {
  audio?: import("react").ReactNode;
  p: Project;
  selected: number;
  checked: Set<string>;
  select: (
    i: number,
    m?: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean },
  ) => void;
  setChecked: (s: Set<string>) => void;
  add: (ids: string[]) => void;
  openSource: (i: number, play?: boolean) => void;
  hold: () => void;
}) {
  const [filters, setFilters] = useState<string[]>([]),
    [query, setQuery] = useState("");
  const groups = useMemo(() => highlightGroups(p), [p]),
    matches = useMemo(
      () =>
        highlightMatches(p, filters).filter(
          (m) =>
            !query ||
            `${m.index + 1} ${m.san} ${m.reasons.join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        ),
      [p, filters, query],
    );
  const selectedIds = p.moves.filter((m) => checked.has(m.id)).map((m) => m.id),
    ids = selectedIds.length
      ? selectedIds
      : p.moves[selected]
        ? [p.moves[selected].id]
        : [];
  return (
    <div className="story-source">
      <div className="story-panel-heading">
        <span className="eyebrow">SOURCE GAME</span>
        <h2>Find moments</h2>
        <p>Source moves stay in legal order. Select moments for your story.</p>
      </div>
      <div className="story-source-actions">
        <button
          className="primary"
          disabled={!ids.length}
          onClick={() => add(ids)}
        >
          Add {ids.length} selected {ids.length === 1 ? "move" : "moves"}
        </button>
        <button onClick={hold}>Hold current position</button>
      </div>
      {audio}
      <label className="story-search">
        Find source moves
        <input
          aria-label="Find source moves"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Move, piece, or event…"
        />
      </label>
      <details className="story-filters" open>
        <summary>Highlight filters · {matches.length} matches</summary>
        <div>
          {Object.entries(groups)
            .filter(([name]) => name !== "All moves")
            .map(([name, ids]) => (
              <label key={name}>
                <input
                  type="checkbox"
                  aria-label={`Filter ${name}`}
                  checked={filters.includes(name)}
                  disabled={!ids.length}
                  onChange={() =>
                    setFilters((old) =>
                      old.includes(name)
                        ? old.filter((v) => v !== name)
                        : [...old, name],
                    )
                  }
                />
                <span>{name}</span>
                <small>{ids.length}</small>
              </label>
            ))}
        </div>
        <button onClick={() => setFilters([])}>Clear filters</button>
      </details>
      <div className="story-match-controls">
        <span>
          {matches.length} matching · {selectedIds.length} selected
        </span>
        <button
          disabled={!matches.length}
          onClick={() =>
            setChecked(new Set([...checked, ...matches.map((m) => m.id)]))
          }
        >
          Select matches
        </button>
        <button onClick={() => setChecked(new Set())}>Clear selection</button>
      </div>
      <div
        className="story-source-list"
        role="list"
        aria-label="Source moments"
      >
        {matches.map((m) => (
          <div
            key={m.id}
            role="listitem"
            className={`source-moment ${selected === m.index ? "active" : ""}`}
          >
            <label>
              <input
                type="checkbox"
                aria-label={`Select source move ${m.index + 1} ${m.san}`}
                checked={checked.has(m.id)}
                onChange={() => {
                  const next = new Set(checked);
                  if (next.has(m.id)) next.delete(m.id);
                  else next.add(m.id);
                  setChecked(next);
                }}
              />
              <button onClick={(e) => select(m.index, e)}>
                {m.index + 1}. {m.san}
              </button>
            </label>
            <small>
              {m.reasons.filter((r) => !r.endsWith("moves")).join(" · ") ||
                "Source move"}
            </small>
            <div>
              <button
                aria-label={`Preview source move ${m.index + 1}`}
                onClick={() => openSource(m.index, true)}
              >
                Preview source
              </button>
              <button
                aria-label={`Add source move ${m.index + 1}`}
                onClick={() => add([m.id])}
              >
                + Shot
              </button>
            </div>
          </div>
        ))}
      </div>
      {!matches.length && (
        <p className="hint">
          No matching moves. Change the filters or import a game in Full Game
          mode.
        </p>
      )}
    </div>
  );
}
