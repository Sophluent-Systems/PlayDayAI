import React, { useEffect, useState } from 'react';

function normalizeHex(value, fallback) {
  if (!value) {
    return fallback;
  }
  const hex = value.trim();
  if (!hex.startsWith('#')) {
    return `#${hex}`;
  }
  return hex;
}

function toSixDigitHex(hex) {
  const normalized = normalizeHex(hex, '#000000');
  if (normalized.length >= 7) {
    return normalized.slice(0, 7);
  }
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return '#000000';
}

function isValidHex(input) {
  return /^#?[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(input);
}

export function ColorChooser({ label, value, defaultValue = '#000000', onChange, readOnly }) {
  const [currentValue, setCurrentValue] = useState(normalizeHex(value, defaultValue));
  const [manualValue, setManualValue] = useState(normalizeHex(value, defaultValue));

  useEffect(() => {
    const normalized = normalizeHex(value, defaultValue);
    setCurrentValue(normalized);
    setManualValue(normalized);
  }, [value, defaultValue]);

  const handleColorInput = (event) => {
    if (readOnly) {
      return;
    }
    const baseHex = event.target.value;
    const alpha = manualValue.length === 9 ? manualValue.slice(7) : '';
    const nextValue = `${baseHex}${alpha}`;
    setCurrentValue(nextValue);
    setManualValue(nextValue);
    onChange?.(nextValue);
  };

  const handleManualInput = (event) => {
    if (readOnly) {
      return;
    }
    const next = normalizeHex(event.target.value, defaultValue);
    setManualValue(next);
    if (isValidHex(next)) {
      setCurrentValue(next);
      onChange?.(next);
    }
  };

  return (
    <div className='space-y-2'>
      <p className='text-sm font-medium text-slate-700 dark:text-slate-200'>{label}</p>
      <div className='flex items-center gap-3'>
        <input
          type='color'
          value={toSixDigitHex(currentValue)}
          onChange={handleColorInput}
          disabled={readOnly}
          className='h-10 w-14 cursor-pointer rounded-md border border-slate-300 bg-transparent dark:border-slate-600'
        />
        <input
          type='text'
          value={manualValue}
          onChange={handleManualInput}
          disabled={readOnly}
          className='flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wide text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-slate-500'
          placeholder='#RRGGBB or #RRGGBBAA'
        />
      </div>
    </div>
  );
}
