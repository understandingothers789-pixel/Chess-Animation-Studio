import { settingHelp } from "./help";
import {
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
export function ScrubNumber({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  ...rest
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "min" | "max" | "step"
> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
}) {
  const drag = useRef<{ x: number; y: number; value: number } | null>(null);
  return (
    <input
      {...rest}
      title={`${rest.title ?? "Adjust value"} Drag left/right or up/down to adjust; hold Shift for finer control.`}
      type="number"
      value={rest["data-mixed" as keyof typeof rest] ? "" : value}
      min={min}
      max={max}
      step={step}
      style={{ ...rest.style, cursor: "ew-resize" }}
      onChange={(e) => {
        const v = e.currentTarget.valueAsNumber;
        if (Number.isFinite(v)) onValueChange(Math.max(min, Math.min(max, v)));
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, value };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (!start || !(e.buttons & 1)) return;
        const distance = e.clientX - start.x + start.y - e.clientY;
        if (Math.abs(distance) < 3) return;
        e.preventDefault();
        const amount = Math.round(distance / (e.shiftKey ? 40 : 8));
        const v = Math.max(min, Math.min(max, start.value + amount * step));
        onValueChange(Number(v.toFixed(6)));
      }}
      onPointerUp={(e) => {
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
}
const sectionState = new Map<string, boolean>();
export const SettingsScope = createContext("settings");
export function Section({
  title,
  children,
  open = true,
  onReset,
  status,
}: {
  title: string;
  status?: string;
  children: ReactNode;
  open?: boolean;
  onReset?: () => void;
}) {
  const scope = useContext(SettingsScope);
  const key = scope + ":" + title;
  const [expanded, setExpanded] = useState(() => sectionState.get(key) ?? open);
  return (
    <details
      className="section"
      open={expanded}
      onToggle={(e) => {
        const v = e.currentTarget.open;
        sectionState.set(key, v);
        setExpanded(v);
      }}
    >
      <summary>
        <span>{title}</span>
        {status && (
          <span className="effect-status" data-status={status}>
            {status}
          </span>
        )}
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
  mixed = false,
  disabled = false,
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
  mixed?: boolean;
  disabled?: boolean;
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
          {mixed && <em className="mixed-value">Mixed</em>}
          {(onReset || resetValue !== undefined) && (
            <button
              disabled={disabled}
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
          <ScrubNumber
            disabled={disabled}
            aria-label={label + " value"}
            title={
              settingHelp(label) +
              ` Range: ${min}–${max}${unit ? " " + unit : ""}.`
            }
            aria-description={settingHelp(label)}
            min={min}
            max={max}
            step={step}
            value={Number(value.toFixed(4))}
            data-mixed={mixed || undefined}
            placeholder={mixed ? "Mixed" : undefined}
            onValueChange={onChange}
          />
          {unit}
        </span>
      </span>
      <input
        disabled={disabled}
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={mixed ? "Mixed values" : undefined}
        data-mixed={mixed || undefined}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
export function Select<T extends string>({
  label,
  mixed = false,
  value,
  options,
  onChange,
}: {
  label: string;
  mixed?: boolean;
  value: T;
  options: readonly T[] | readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="select-field" title={settingHelp(label)}>
      <span>
        {label}
        {mixed && <em className="mixed-value">Mixed</em>}
      </span>
      <select
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        value={mixed ? "__mixed__" : value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {mixed && (
          <option value="__mixed__" disabled>
            Mixed values
          </option>
        )}
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
  mixed = false,
  checked,
  onChange,
}: {
  label: string;
  mixed?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle" title={settingHelp(label)}>
      <span>
        {label}
        {mixed && <em className="mixed-value">Mixed</em>}
      </span>
      <input
        aria-label={label}
        title={settingHelp(label)}
        aria-description={settingHelp(label)}
        type="checkbox"
        ref={(el) => {
          if (el) el.indeterminate = mixed;
        }}
        aria-checked={mixed ? "mixed" : checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
export function Color({
  label,
  mixed = false,
  value,
  onChange,
}: {
  label: string;
  mixed?: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field" title={settingHelp(label)}>
      <span>{label}</span>
      <span>
        <code>{mixed ? "Mixed" : value.toUpperCase()}</code>
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
