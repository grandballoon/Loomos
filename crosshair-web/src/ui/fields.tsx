/** Small shared form controls for the settings panel. */

import { useEffect, useState } from "react";

import { formatLength, toPoints, type Unit } from "../core/lengths";

/**
 * A length input bound to a value in points, edited in the display unit.
 * Local text state lets the user type freely; the value commits per change
 * when it parses, and snaps back to the formatted value on blur.
 */
export function LengthField(props: {
  label: string;
  points: number;
  unit: Unit;
  min?: number;
  onChange: (points: number) => void;
}) {
  const formatted = formatLength(props.points, props.unit);
  const [text, setText] = useState(formatted);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(formatted);
  }, [formatted, editing]);

  const commit = (raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value) && value >= (props.min ?? 0)) {
      props.onChange(toPoints(value, props.unit));
    }
  };

  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input
          type="text"
          inputMode="decimal"
          value={editing ? text : formatted}
          onFocus={() => {
            setEditing(true);
            setText(formatted);
          }}
          onChange={(event) => {
            setText(event.target.value);
            commit(event.target.value);
          }}
          onBlur={() => setEditing(false)}
        />
        <span className="field-unit">{props.unit}</span>
      </span>
    </label>
  );
}

export function NumberField(props: {
  label: string;
  value: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <input
          type="number"
          value={props.value}
          min={props.min}
          max={props.max}
          step={1}
          onChange={(event) => {
            const value = Math.round(Number(event.target.value));
            if (Number.isFinite(value) && value >= props.min) {
              props.onChange(props.max !== undefined ? Math.min(value, props.max) : value);
            }
          }}
        />
      </span>
    </label>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input">
        <select value={props.value} onChange={(event) => props.onChange(event.target.value as T)}>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function ToggleField(props: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="field field-toggle">
      <span className="field-label">{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
      <span className="toggle-visual" aria-hidden="true" />
    </label>
  );
}
