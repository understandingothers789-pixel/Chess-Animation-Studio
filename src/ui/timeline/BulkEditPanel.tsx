import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { settingsKinds, type SettingsKind } from "../../core/editing";
import type { Project } from "../../core/project";
import type { Edit } from "../state";
import {
  applyMoveSettings,
  bulkGroups,
  settingsLabel,
} from "../commands/bulkEditing";
export function BulkEditPanel({
  project: p,
  sourceId,
  checked,
  initialKind,
  edit,
  report,
  close,
}: {
  project: Project;
  sourceId: string;
  checked: Set<string>;
  initialKind: SettingsKind;
  edit: Edit;
  report: (s: string) => void;
  close: () => void;
}) {
  const scale =
    Number(
      getComputedStyle(
        document.querySelector(".workspace") || document.body,
      ).getPropertyValue("--ui-scale"),
    ) || 1;
  const sourceIndex = p.moves.findIndex((m) => m.id === sourceId),
    source = p.moves[sourceIndex];
  const groups = bulkGroups(p, sourceId, checked),
    [kind, setKind] = useState(initialKind);
  const [target, setTarget] = useState(
    checked.size > 1 ? "Selected moves" : "All moves",
  );
  const ids = groups[target as keyof typeof groups] ?? [],
    locked = p.moves.filter(
      (m) => ids.includes(m.id) && m.effect.locked,
    ).length;
  const dialog = useRef<HTMLDivElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLSelectElement>("select")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  if (!source) return null;
  return createPortal(
    <div
      className="bulk-editor-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeRef.current();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-edit-title"
        className="bulk-editor"
        style={{ fontSize: 13 * scale, width: 430 * scale }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeRef.current();
          }
          if (e.key === "Tab") {
            const controls = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "select,button:not(:disabled)",
                ),
              ),
              index = controls.indexOf(document.activeElement as HTMLElement);
            if (
              (e.shiftKey && index === 0) ||
              (!e.shiftKey && index === controls.length - 1)
            ) {
              e.preventDefault();
              controls[e.shiftKey ? controls.length - 1 : 0].focus();
            }
          }
        }}
      >
        <h3 id="bulk-edit-title">Apply move settings</h3>
        <p className="bulk-source">
          Source: Move {sourceIndex + 1} · <strong>{source.san}</strong>
        </p>
        <label>
          Settings category
          <select
            aria-label="Bulk settings category"
            value={kind}
            onChange={(e) => setKind(e.target.value as SettingsKind)}
          >
            {settingsKinds.map((k) => (
              <option key={k} value={k}>
                {settingsLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Target group
          <select
            aria-label="Bulk target group"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            {Object.entries(groups).map(([name, ids]) => (
              <option key={name} value={name} disabled={!ids.length}>
                {name} · {ids.length}
              </option>
            ))}
          </select>
        </label>
        <p className="bulk-summary" aria-live="polite">
          <strong>{ids.length} moves will be updated</strong>
          <br />
          {locked} timing-locked {locked === 1 ? "move" : "moves"}{" "}
          {locked === 1
            ? "will preserve its timing"
            : "will preserve their timing"}
          .<br />
          {kind === "camera"
            ? `Camera configuration: ${p.format}.`
            : kind === "everything"
              ? "Includes all output formats."
              : "Other settings categories stay as they are."}
        </p>
        <p className="hint">
          Changes apply when you choose Apply. Undo restores the whole
          operation.
        </p>
        <div className="button-row">
          <button onClick={close}>Cancel</button>
          <button
            className="primary"
            disabled={!ids.length}
            onClick={() => {
              applyMoveSettings(
                p,
                edit,
                report,
                kind,
                ids,
                source.effect,
                p.format,
                target.toLowerCase(),
              );
              close();
            }}
          >
            Apply {settingsLabel(kind).toLowerCase()} to {ids.length}{" "}
            {ids.length === 1 ? "move" : "moves"}
          </button>
        </div>
      </div>
    </div>,
    document.fullscreenElement || document.body,
  );
}
