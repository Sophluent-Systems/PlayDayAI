import React, { useEffect, useRef, useState } from 'react';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { ChevronDown, Check } from 'lucide-react';

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

const buttonStyles = 'inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus:ring-slate-500';

export function FontChooser({ value, defaultValue, onChange, readOnly }) {
  const [currentFont, setCurrentFont] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    let nextValue = value;
    if (nullUndefinedOrEmpty(nextValue)) {
      nextValue = defaultValue;
      if (!nullUndefinedOrEmpty(defaultValue)) {
        onChange?.(defaultValue);
      }
    }
    const fontOption = fonts.find((font) => font.value === nextValue) || fonts[0];
    setCurrentFont(fontOption);
  }, [value, defaultValue]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (!currentFont) {
    return null;
  }

  const handleSelect = (font) => {
    setCurrentFont(font);
    setIsOpen(false);
    onChange?.(font.value);
  };

  return (
    <div className='relative max-w-xs text-left'>
      <button
        type='button'
        className={buttonStyles}
        style={{ fontFamily: currentFont.value }}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={readOnly}
      >
        <span>{currentFont.label}</span>
        <ChevronDown className='h-4 w-4 opacity-60' />
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className='absolute z-40 mt-2 max-h-64 w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900'
        >
          <ul className='space-y-1'>
            {fonts.map((font) => {
              const isSelected = font.value === currentFont.value;
              return (
                <li key={font.value}>
                  <button
                    type='button'
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${isSelected ? 'bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-slate-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    style={{ fontFamily: font.value }}
                    onClick={() => handleSelect(font)}
                    disabled={readOnly}
                  >
                    <span>{font.label}</span>
                    {isSelected ? <Check className='h-4 w-4' /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
