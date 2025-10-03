"use client";

import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CodeEditor } from "./codeeditor";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const baseInputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const baseLabelClass = "flex flex-col gap-2 text-sm font-semibold text-emphasis";

export function MenuTextField({ field, value, onChange, readOnly, rootObject }) {
  const [currentValue, setCurrentValue] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    if (value !== currentValue) {
      setCurrentValue(typeof value === "string" ? value : "");
    }
  }, [value]);

  if (nullUndefinedOrEmpty(currentValue, true)) {
    return null;
  }

  const isAtLimit = field.maxChar && currentValue.length >= field.maxChar;

  const handleChange = (nextValue) => {
    setCurrentValue(nextValue);
    onChange?.(rootObject, field.path, nextValue);
  };

  const inputStyles = {
    backgroundColor: isAtLimit ? "rgba(248,113,113,0.18)" : undefined,
  };

  return (
    <label className={baseLabelClass} title={field.tooltip}>
      <span>{field.label}</span>
      {field.multiline ? (
        <textarea
          rows={field.lines ?? 3}
          value={currentValue}
          onChange={(event) => {
            event.stopPropagation();
            handleChange(event.target.value);
          }}
          maxLength={field.maxChar}
          disabled={readOnly}
          style={inputStyles}
          className={clsx(baseInputClass, "min-h-[72px] resize-y")}
        />
      ) : (
        <input
          type="text"
          value={currentValue}
          onChange={(event) => {
            event.stopPropagation();
            handleChange(event.target.value);
          }}
          maxLength={field.maxChar}
          disabled={readOnly}
          style={inputStyles}
          className={baseInputClass}
        />
      )}
      {field.maxChar ? (
        <span className="text-xs text-muted">{currentValue.length}/{field.maxChar} characters</span>
      ) : null}
    </label>
  );
}

export function MenuDecimalField(params) {
  return <NumericField {...params} step={1} integerOnly />;
}

export function MenuFloatField(params) {
  return <NumericField {...params} step={0.1} />;
}

function NumericField({ field, value, onChange, readOnly, rootObject, step = 1, integerOnly = false }) {
  const [currentValue, setCurrentValue] = useState(nullUndefinedOrEmpty(value) ? "" : value);
  const timeoutId = useRef(null);

  useEffect(() => {
    if (value !== currentValue) {
      setCurrentValue(nullUndefinedOrEmpty(value) ? "" : value);
    }
  }, [value]);

  const setNewValue = (path, range, inputValue) => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }

    const newValue = nullUndefinedOrEmpty(inputValue) ? "" : inputValue;
    setCurrentValue(newValue);

    let numericValue;
    try {
      numericValue = integerOnly ? parseInt(newValue, 10) : parseFloat(newValue, 10);
    } catch (error) {
      numericValue = undefined;
    }

    const withinRange =
      typeof numericValue === "number" &&
      !Number.isNaN(numericValue) &&
      numericValue >= range[0] &&
      numericValue <= range[1];

    if (withinRange) {
      onChange?.(rootObject, path, numericValue);
    } else {
      timeoutId.current = setTimeout(() => {
        let fallback = newValue;
        if (typeof fallback !== "number") {
          fallback = integerOnly ? parseInt(fallback, 10) : parseFloat(fallback, 10);
        }
        if (Number.isNaN(fallback) || typeof fallback !== "number") {
          fallback = range[0];
        }

        if (integerOnly) {
          fallback = Math.floor(fallback);
        }

        const clamped = Math.min(Math.max(fallback, range[0]), range[1]);
        setCurrentValue(clamped);
        onChange?.(rootObject, path, clamped);
      }, 2000);
    }
  };

  return (
    <label className={baseLabelClass} title={field.tooltip}>
      <span>{field.label}</span>
      <input
        type="number"
        value={currentValue}
        step={step}
        min={field.range?.[0]}
        max={field.range?.[1]}
        onChange={(event) => {
          event.stopPropagation();
          setNewValue(field.path, field.range ?? [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], event.target.value);
        }}
        disabled={readOnly}
        className={baseInputClass}
      />
    </label>
  );
}

export function MenuRadioField({ field, value, onChange, readOnly, rootObject }) {
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    if (!nullUndefinedOrEmpty(value)) {
      setCurrentValue(value);
    }
  }, [value]);

  if (nullUndefinedOrEmpty(currentValue)) {
    return null;
  }

  return (
    <fieldset className="space-y-3" disabled={readOnly}>
      <legend className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">{field.label}</legend>
      <div className="space-y-2">
        {(field.options ?? []).map((option) => (
          <label key={option.value} className="flex items-center gap-3 text-sm text-emphasis">
            <input
              type="radio"
              name={field.path}
              value={option.value}
              checked={currentValue === option.value}
              onChange={(event) => {
                event.stopPropagation();
                setCurrentValue(option.value);
                onChange?.(rootObject, field.path, option.value);
              }}
              disabled={readOnly}
              className="h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function MenuMultiselectField({ field, onChange, rootObject, readOnly, value }) {
  const [checked, setChecked] = useState({});

  useEffect(() => {
    const newChecked = {};
    if (Array.isArray(value)) {
      value.forEach((item) => {
        newChecked[item] = true;
      });
    }
    setChecked(newChecked);
  }, [value]);

  const toggleOption = (optionValue) => {
    const nextChecked = { ...checked, [optionValue]: !checked[optionValue] };
    setChecked(nextChecked);

    const selectedValues = Object.entries(nextChecked)
      .filter(([, isSelected]) => isSelected)
      .map(([optionKey]) => optionKey);

    onChange?.(rootObject, field.path, selectedValues);
  };

  return (
    <div className="space-y-3" title={field.tooltip}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">{field.label}</p>
      <div className="grid gap-2">
        {(field.options ?? []).map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface px-3 py-2 text-sm text-emphasis"
          >
            <input
              type="checkbox"
              checked={Boolean(checked[option.value])}
              onChange={(event) => {
                event.stopPropagation();
                toggleOption(option.value);
              }}
              disabled={readOnly}
              className="h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function MenuCheckboxField({ field, value, onChange, rootObject, readOnly }) {
  const [currentValue, setCurrentValue] = useState(Boolean(value));

  useEffect(() => {
    if (!nullUndefinedOrEmpty(value) && value !== currentValue) {
      setCurrentValue(Boolean(value));
    }
  }, [value]);

  if (nullUndefinedOrEmpty(currentValue)) {
    return null;
  }

  return (
    <label className="flex items-center gap-3 text-sm font-semibold text-emphasis" title={field.tooltip}>
      <input
        type="checkbox"
        checked={currentValue}
        onChange={(event) => {
          event.stopPropagation();
          setCurrentValue(event.target.checked);
          onChange?.(rootObject, field.path, event.target.checked);
        }}
        disabled={readOnly}
        className="h-4 w-4 accent-primary"
      />
      <span>{field.label}</span>
    </label>
  );
}

export function MenuSelectDropdown({ field, value, options: optionsProp, onChange, rootObject, readOnly }) {
  const [options, setOptions] = useState(optionsProp ?? []);
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    if (Array.isArray(optionsProp)) {
      setOptions(optionsProp);
      if (nullUndefinedOrEmpty(currentValue) && optionsProp.length > 0) {
        setCurrentValue(optionsProp[0].value);
      }
    }
  }, [optionsProp]);

  useEffect(() => {
    if (!nullUndefinedOrEmpty(value) && value !== currentValue) {
      setCurrentValue(value);
    }
  }, [value]);

  if (!options || options.length === 0 || currentValue == null) {
    return null;
  }

  return (
    <label className={baseLabelClass} title={field.tooltip}>
      <span>{field.label}</span>
      <select
        value={currentValue}
        onChange={(event) => {
          event.stopPropagation();
          setCurrentValue(event.target.value);
          onChange?.(rootObject, field.path, event.target.value);
        }}
        disabled={readOnly}
        className={clsx(baseInputClass, "appearance-none bg-surface")}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MenuCodeEditor({ field, value, onChange, rootObject, readOnly }) {
  const [currentValue, setCurrentValue] = useState(typeof value !== "undefined" ? value : null);

  useEffect(() => {
    if (value !== currentValue) {
      setCurrentValue(value);
    }
  }, [value]);

  const setNewValue = (newValue) => {
    setCurrentValue(newValue);
    onChange?.(rootObject, field.path, newValue);
  };

  return <CodeEditor code_UNSAFE={currentValue} onChange={setNewValue} readOnly={readOnly} />;
}

export default {
  MenuTextField,
  MenuDecimalField,
  MenuFloatField,
  MenuRadioField,
  MenuMultiselectField,
  MenuCheckboxField,
  MenuSelectDropdown,
  MenuCodeEditor,
};
