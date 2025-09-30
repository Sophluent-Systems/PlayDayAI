import React, { useEffect, useRef, useState } from 'react';
import { PersonaIcons, personaIconOptions } from './icons';
import { ChevronDown, Check } from 'lucide-react';

const buttonStyles = {
  outline: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-500',
};

export function IconChooser({ value, defaultValue = 'Person', onChange, readOnly }) {
  const [currentValue, setCurrentValue] = useState(value || defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!value) {
      setCurrentValue(defaultValue);
    } else {
      setCurrentValue(value);
    }
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

  const IconComponent = PersonaIcons[currentValue];

  const handleSelect = (key) => {
    if (readOnly) {
      return;
    }
    setCurrentValue(key);
    setIsOpen(false);
    onChange?.(key);
  };

  return (
    <div className='relative inline-block text-left'>
      <button
        type='button'
        className={`${buttonStyles.outline} min-h-[2.5rem]`}
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={readOnly}
      >
        <IconComponent className='h-5 w-5' />
        <span className='text-sm font-medium'>{currentValue}</span>
        <ChevronDown className='h-4 w-4 opacity-60' />
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className='absolute right-0 z-50 mt-2 max-h-72 w-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900'
        >
          <div className='grid grid-cols-4 gap-3'>
            {personaIconOptions.map((key) => {
              const Icon = PersonaIcons[key];
              const isSelected = key === currentValue;
              return (
                <button
                  key={key}
                  type='button'
                  className={`flex h-16 flex-col items-center justify-center rounded-xl border text-xs font-medium transition ${isSelected ? 'border-slate-900 bg-slate-900/10 text-slate-900 dark:border-slate-100 dark:bg-slate-100/10 dark:text-slate-100' : 'border-transparent bg-slate-50 hover:border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700'}`}
                  onClick={() => handleSelect(key)}
                  disabled={readOnly}
                >
                  <Icon className='h-5 w-5' />
                  <span className='mt-1 truncate px-1'>{key}</span>
                  {isSelected ? <Check className='mt-1 h-3 w-3' /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
