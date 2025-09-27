import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const fonts = [
  { label: 'Abril Fatface', value: 'Abril Fatface, cursive' },
  { label: 'Archivo Black', value: 'Archivo Black, sans-serif' },
  { label: 'Bangers', value: 'Bangers, cursive' },
  { label: 'Barlow', value: 'Barlow, sans-serif' },
  { label: 'Cabin', value: 'Cabin, sans-serif' },
  { label: 'Dancing Script', value: 'Dancing Script, cursive' },
  { label: 'Exo 2', value: 'Exo 2, sans-serif' },
  { label: 'Fira Sans', value: 'Fira Sans, sans-serif' },
  { label: 'Gloria Hallelujah', value: 'Gloria Hallelujah, cursive' },
  { label: 'Indie Flower', value: 'Indie Flower, cursive' },
  { label: 'Josefin Slab', value: 'Josefin Slab, serif' },
  { label: 'Kanit', value: 'Kanit, sans-serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Lobster', value: 'Lobster, cursive' },
  { label: 'Merriweather', value: 'Merriweather, serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Nunito', value: 'Nunito, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'Oswald', value: 'Oswald, sans-serif' },
  { label: 'Pacifico', value: 'Pacifico, cursive' },
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
  { label: 'Quicksand', value: 'Quicksand, sans-serif' },
  { label: 'Raleway', value: 'Raleway, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Sacramento', value: 'Sacramento, cursive' },
  { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
  { label: 'Tangerine', value: 'Tangerine, cursive' },
  { label: 'Ubuntu', value: 'Ubuntu, sans-serif' },
  { label: 'Varela Round', value: 'Varela Round, sans-serif' },
  { label: 'Work Sans', value: 'Work Sans, sans-serif' },
  { label: 'Zilla Slab', value: 'Zilla Slab, serif' },
];

export function FontChooser({ value, defaultValue, onChange, readOnly }) {
  const [selectedValue, setSelectedValue] = useState('');

  useEffect(() => {
    if (!nullUndefinedOrEmpty(value) && value !== selectedValue) {
      setSelectedValue(value);
    } else if (nullUndefinedOrEmpty(value) && !nullUndefinedOrEmpty(defaultValue)) {
      setSelectedValue(defaultValue);
      onChange?.(defaultValue);
    }
  }, [value, defaultValue]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setSelectedValue(nextValue);
    onChange?.(nextValue);
  };

  const currentFont = fonts.find((font) => font.value === selectedValue) ?? fonts[0];

  return (
    <div className="w-full">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
        Font Family
      </label>
      <div className="relative">
        <select
          value={currentFont?.value}
          onChange={handleChange}
          disabled={readOnly}
          className={clsx(
            'w-full appearance-none rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-white shadow-soft backdrop-blur focus:border-[color:var(--pd-highlight,#38bdf8)]/60 focus:outline-none focus:ring-2 focus:ring-[color:var(--pd-highlight,#38bdf8)]/30',
            readOnly && 'cursor-not-allowed opacity-60',
          )}
          style={{ fontFamily: currentFont?.value }}
        >
          {fonts.map((font) => (
            <option key={font.value} value={font.value} style={{ fontFamily: font.value, color: '#0f172a' }}>
              {font.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-white/60">?</span>
      </div>
    </div>
  );
}
