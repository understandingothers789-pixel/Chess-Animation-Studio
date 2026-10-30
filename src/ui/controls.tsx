import { settingHelp } from "./help";
import type { ReactNode } from "react";
export function Section({
  title,
  children,
  open = true,
  onReset,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
  onReset?: () => void;
}) {
  return (
    <details className="section" open={open}>
      <summary>
        <span>{title}</span>
        {onReset && (
          <button
            type="button"
            className="control-reset"
            aria-label={`Reset ${title}`}
            title="Restore defaults"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReset();
            }}
          >
            Reset
          </button>
        )}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  );
}
export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  unit = "",
  resetValue,
  onReset,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  resetValue?: number;
  onReset?: () => void;
}) {
  return (
    <label className="range-field" title={settingHelp(label)}>
      <span>
        <span>
          {label}
          {(onReset || resetValue !== undefined) && (
            <button
              type="button"
              className="control-reset"
              aria-label={`Reset ${label}`}
              title="Restore default"
              onClick={(e) => {
                e.preventDefault();
                if (onReset) onReset();
                else onChange(resetValue!);
              }}
            >
              ↺
            </button>
          )}
        </span>
        <span className="number-wrap">
          <input
            aria-label={label + " value"}
            title={
              settingHelp(label) +
              ` Range: ${min}–${max}${unit ? " " + unit : ""}.`
            }
            aria-description={settingHelp(label)}
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number(value.toFixed(4))}
            onChange={(e) => {
              const v = e.target.valueAsNumber;
              if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
            }}
          />
          {unit}
        </span>
      </span>
      <input
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[] | readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="select-field" title={settingHelp(label)}>
      <span>{label}</span>
      <select
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => {
          const [v, l] = typeof o === "string" ? [o, o] : o;
          return (
            <option value={v} key={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle" title={settingHelp(label)}>
      <span>{label}</span>
      <input
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field" title={settingHelp(label)}>
      <span>{label}</span>
      <span>
        <code>{value.toUpperCase()}</code>
        <input
          aria-label={label}
          title={settingHelp(label)}
          aria-description={settingHelp(label)}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}
export const clock = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`;
