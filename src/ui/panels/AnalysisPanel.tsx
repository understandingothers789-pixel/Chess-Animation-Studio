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
export function AnalysisPanel(q: PanelProps) {
  const p = q.project,
    [scope, setScope] = useState<"selected" | "checked" | "all">("all"),
    [busy, setBusy] = useState(false);
  const analyze = (kind: "book" | "engine" | "starter" | "review") =>
    q.run(async () => {
      setBusy(true);
      try {
        const indices = p.moves.flatMap((m, i) =>
          scope === "all" ||
          (scope === "selected" && i === q.selected) ||
          (scope === "checked" && q.checked.has(m.id))
            ? [i]
            : [],
        );
        if (kind === "review") {
          const book = await window.studio.analyze(p, "starter", indices);
          const engine = await window.studio.analyze(p, "engine", indices);
          q.edit("Game review", (p) => {
            for (const m of p.moves) {
              if (book[m.id]?.book || engine[m.id]?.engine) {
                m.analysis = {
                  ...m.analysis,
                  ...(book[m.id]?.book ? { book: book[m.id].book } : {}),
                  ...(engine[m.id]?.engine
                    ? { engine: engine[m.id].engine }
                    : {}),
                };
              }
            }
          });
        } else {
          const result = await window.studio.analyze(p, kind, indices);
          q.edit("Analysis results", (p) => {
            for (const m of p.moves)
              if (result[m.id]) m.analysis = { ...m.analysis, ...result[m.id] };
          });
        }
      } finally {
        setBusy(false);
      }
    });
  return (
    <>
      <Section title="Evaluation bar">
        <Toggle
          label="Show evaluation bar"
          checked={p.evalBar}
          onChange={(v) =>
            q.edit("Evaluation bar", (p) => {
              p.evalBar = v;
            })
          }
        />
        <p className="hint">
          Run Stockfish review to update the bar for each move.
        </p>
      </Section>
      <Section title="Analysis suggestions">
        <Select
          label="Analyze"
          value={scope}
          options={[
            ["selected", "Selected move"],
            ["checked", "Checked moves"],
            ["all", "All moves"],
          ]}
          onChange={setScope}
        />
        <button
          className="wide primary"
          disabled={busy || !q.settings.stockfish}
          onClick={() => analyze("review")}
        >
          Review game with Stockfish
        </button>
        <button
          className="wide"
          disabled={busy}
          onClick={() => analyze("starter")}
        >
          Mark built-in opening moves
        </button>
        <p className="hint">
          The built-in opening repertoire covers selected common lines through
          four moves; it is not a database of master games. Select Stockfish in
          Files first. Adjust depth below; six is a quick, approximate review.
        </p>
        <button
          className="wide"
          disabled={busy}
          onClick={() => analyze("book")}
        >
          Look up Masters opening moves
        </button>
        <button
          className="wide"
          disabled={busy || !q.settings.stockfish}
          onClick={() => analyze("engine")}
        >
          Analyze with local Stockfish
        </button>
        {busy && (
          <button
            className="wide"
            onClick={() => q.run(() => window.studio.cancelAnalysis())}
          >
            Cancel analysis{" "}
            {q.analysisProgress
              ? `${q.analysisProgress.done}/${q.analysisProgress.total}`
              : ""}
          </button>
        )}
        <p className="hint">
          Manual badges always win. Engine labels use centipawn loss, not
          Chess.com's proprietary classifications.
        </p>
      </Section>
      <Section
        title="Review highlight colors"
        onReset={() =>
          q.edit("Reset review colors", (p) => {
            p.reviewColors = blank().reviewColors;
          })
        }
      >
        <Toggle
          label="Color moves by review"
          checked={p.reviewColors.enabled}
          onChange={(v) =>
            q.edit("Review colors", (p) => {
              p.reviewColors.enabled = v;
            })
          }
        />
        <p className="hint">
          Reviewed destination and route squares use these colors for either
          side. Manual badges take priority.
        </p>
        {(
          [
            "book",
            "brilliant",
            "best",
            "good",
            "inaccuracy",
            "mistake",
            "blunder",
          ] as const
        ).map((k) => (
          <Color
            key={k}
            label={"Review " + k + " color"}
            value={p.reviewColors[k]}
            onChange={(v) =>
              q.edit("Review color " + k, (p) => {
                p.reviewColors[k] = v;
              })
            }
          />
        ))}
      </Section>
      <Section title="Resource limits">
        {(
          [
            "depth",
            "milliseconds",
            "threads",
            "hash",
            "minGames",
            "frequency",
            "cutoff",
          ] as const
        ).map((k) => (
          <Range
            key={k}
            label={
              {
                depth: "Maximum depth",
                milliseconds: "Time per position",
                threads: "Engine threads",
                hash: "Engine hash MB",
                minGames: "Minimum Masters games",
                frequency: "Minimum book frequency",
                cutoff: "Opening cutoff (plies)",
              }[k]
            }
            value={p.analysis[k]}
            resetValue={blank().analysis[k]}
            min={
              k === "depth"
                ? 4
                : k === "milliseconds"
                  ? 100
                  : k === "threads" || k === "minGames"
                    ? 1
                    : k === "hash"
                      ? 16
                      : 0
            }
            max={
              k === "depth"
                ? 24
                : k === "milliseconds"
                  ? 15000
                  : k === "threads"
                    ? 8
                    : k === "hash"
                      ? 512
                      : k === "minGames"
                        ? 1000000
                        : k === "frequency"
                          ? 1
                          : 80
            }
            step={k === "frequency" ? 0.001 : 1}
            onChange={(v) =>
              q.edit("Analysis " + k, (p) => {
                p.analysis[k] = v;
              })
            }
          />
        ))}
      </Section>
      <Section title="Selected move results">
        {(() => {
          const a = p.moves[q.selected]?.analysis;
          return a ? (
            <>
              {a.book ? (
                <p>
                  Masters: <strong>{a.book.state}</strong>
                  <br />
                  {a.book.message}
                </p>
              ) : (
                <p className="hint">Opening not analyzed.</p>
              )}
              {a.engine ? (
                <p>
                  Engine:{" "}
                  <strong>
                    {a.engine.state === "done"
                      ? a.engine.label
                      : a.engine.state}
                  </strong>
                  <br />
                  Loss {a.engine.loss} cp · depth {a.engine.depth}
                  <br />
                  {a.engine.message}
                </p>
              ) : (
                <p className="hint">Engine not analyzed.</p>
              )}
            </>
          ) : null;
        })()}
      </Section>
    </>
  );
}
