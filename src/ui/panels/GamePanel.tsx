import { settingHelp } from "../help";
import { useState } from "react";
import {
  effect,
  cinematicPresets,
  rainbowDefaults,
  blank,
  presets,
  formats,
  badgeNames,
  type Project,
  type Asset,
  type Preset,
  type Effect,
} from "../../core/project";
import { selectLine } from "../../core/chess";
import { align, syncMarkers } from "../../core/audio";
import { badge, segments } from "../../core/timeline";
import {
  Section,
  Range,
  Toggle,
  Color,
  Select,
  ScrubNumber,
  clock,
} from "../controls";
import { presetLabels } from "../presets/catalog";
import type { Edit } from "../state";
import type { Settings } from "../../bridge";
import type { PanelProps } from "./types";
export function GamePanel(q: PanelProps) {
  const { project: p, edit } = q;
  const [text, setText] = useState(""),
    [kind, setKind] = useState<"pgn" | "fen">("pgn"),
    [preserve, setPreserve] = useState(true);
  return (
    <>
      <Section title="Game & variations">
        <Select
          label="Variation"
          value={String(p.line)}
          options={p.lines.map((l, i) => [String(i), l.name] as const)}
          onChange={(v) => q.run(async () => q.replace(selectLine(p, +v)))}
        />
        <button className="wide" onClick={q.onOpen}>
          Open saved composition…
        </button>
        <label className="text-field">
          Composition name
          <input
            title={settingHelp("Composition name")}
            aria-description={settingHelp("Composition name")}
            aria-label={"Composition name"}
            value={p.title}
            onChange={(e) =>
              edit("Title", (p) => {
                p.title = e.target.value;
              })
            }
          />
        </label>
      </Section>
      <Section title="Import a game">
        <div className="segmented">
          {(["pgn", "fen"] as const).map((v) => (
            <button
              className={kind === v ? "active" : ""}
              title={
                v === "pgn"
                  ? "Import a game with PGN moves and variations."
                  : "Import a starting board position from a FEN string."
              }
              aria-description={
                v === "pgn"
                  ? "Import a game with PGN moves and variations."
                  : "Import a starting board position from a FEN string."
              }
              key={v}
              onClick={() => setKind(v)}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>
        <textarea
          title={settingHelp("Game text")}
          aria-description={settingHelp("Game text")}
          aria-label="Game text"
          rows={5}
          placeholder={
            kind === "pgn" ? "1. e4 e5 2. Nf3 Nc6…" : "Paste a FEN position…"
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Toggle
          label="Preserve matching move effects"
          checked={preserve}
          onChange={setPreserve}
        />
        <div className="button-row">
          <button
            onClick={() =>
              q.run(async () => {
                const t = await window.studio.chooseText(kind);
                if (t !== null) setText(t);
              })
            }
          >
            Choose file…
          </button>
          <button
            className="primary"
            disabled={!text.trim()}
            onClick={() => q.importText(text, kind, preserve)}
          >
            Import {kind.toUpperCase()}
          </button>
        </div>
        <p className="hint">
          Click a piece in the preview, then a legal destination to enter a
          move. New board input creates a separate variation.
        </p>
        <Select
          label="Promote pawn to"
          value={q.promotion}
          options={[
            ["q", "Queen"],
            ["r", "Rook"],
            ["b", "Bishop"],
            ["n", "Knight"],
          ]}
          onChange={q.setPromotion}
        />
      </Section>
      <div className="list-heading">
        <span>{p.moves.length} PLIES</span>
        <button
          onClick={() =>
            q.setChecked(
              q.checked.size === p.moves.length
                ? new Set()
                : new Set(p.moves.map((m) => m.id)),
            )
          }
        >
          {q.checked.size ? "Clear checks" : "Check all"}
        </button>
      </div>
      <div className="move-list">
        {p.moves.map((m, i) => (
          <div
            className={"move-row " + (q.selected === i ? "active" : "")}
            key={m.id}
          >
            <input
              title={settingHelp("Check move " + (i + 1))}
              aria-description={settingHelp("Check move " + (i + 1))}
              aria-label={"Check move " + (i + 1)}
              type="checkbox"
              checked={q.checked.has(m.id)}
              onChange={(e) => {
                const s = new Set(q.checked);
                if (e.target.checked) s.add(m.id);
                else s.delete(m.id);
                q.setChecked(s);
              }}
            />
            <button onClick={(event) => q.select(i, event)}>
              <span className="muted">
                {i % 2 === 0 ? Math.floor(i / 2) + 1 + "." : "…"}
              </span>
              <strong>{m.san}</strong>
              <span className="badge-mini">{badge(m) ?? ""}</span>
              <small>{m.effect.duration.toFixed(2)}s</small>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
