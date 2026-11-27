import { forcedMateLost, reviewNotation } from "../../core/badgeNotation";
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
        const book =
          kind === "engine"
            ? undefined
            : await window.studio.analyze(
                p,
                kind === "review" ? "starter" : kind,
                indices,
              );
        const engine =
          kind === "engine" || kind === "review"
            ? await window.studio.analyze(p, "engine", indices)
            : undefined;
        q.edit(
          kind === "review" ? "Game review" : "Analysis results",
          (draft) => {
            if (draft.id !== p.id || draft.line !== p.line) return;
            for (const m of draft.moves) {
              const opening = book?.[m.id]?.book;
              const evaluation = engine?.[m.id]?.engine;
              if (opening) m.analysis.book = opening;
              if (evaluation) m.analysis.engine = evaluation;
            }
          },
        );
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
          A move that loses more than 0.50 pawns gets ?. Stockfish adds !! to
          near-best piece sacrifices after a deeper tactical check. Manual
          badges and hidden badges take priority.
        </p>
      </Section>
      <Section
        title="Move notation colors"
        onReset={() =>
          q.edit("Reset review colors", (p) => {
            p.reviewColors = blank().reviewColors;
          })
        }
      >
        <Toggle
          label="Match squares to move notation"
          checked={p.reviewColors.enabled}
          onChange={(v) =>
            q.edit("Review colors", (p) => {
              p.reviewColors.enabled = v;
            })
          }
        />
        <p className="hint">
          The source and destination match the move badge. Set a palette here or
          override individual moves under Effects → Highlights &amp; trail.
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
                      ? reviewNotation(a.engine)
                      : a.engine.state}
                  </strong>
                  <br />
                  {a.engine.state === "done" && (
                    <>
                      {a.engine.mate !== undefined ||
                      a.engine.bestMate !== undefined
                        ? [
                            forcedMateLost(a.engine.mate, a.engine.bestMate)
                              ? "Missed or allowed a forced mate"
                              : null,
                            a.engine.mate === undefined
                              ? "Played move has a centipawn evaluation"
                              : a.engine.mate > 0
                                ? `Forces mate in ${a.engine.mate}`
                                : `Opponent has mate in ${Math.abs(a.engine.mate)}`,
                            a.engine.bestMate && a.engine.bestMate > 0
                              ? `Best move mates in ${a.engine.bestMate}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : a.engine.score >= 90000
                          ? "Saved winning mate · reanalyze for mate distance"
                          : `Loss ${a.engine.loss} cp`}{" "}
                      · depth {a.engine.depth}
                      <br />
                    </>
                  )}
                  {a.engine.message}
                  {a.engine.sacrifice && (
                    <>
                      <br />
                      If accepted: {a.engine.sacrifice.reply}{" "}
                      {a.engine.sacrifice.continuation}
                      {" · "}
                      {a.engine.sacrifice.material} pawn units offered
                    </>
                  )}
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
