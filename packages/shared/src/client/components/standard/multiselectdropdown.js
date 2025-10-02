'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

function getPortalTarget() {
  return typeof window !== 'undefined' ? document.body : null;
}

function resolveOption(option) {
  if (option && typeof option === 'object' && !Array.isArray(option)) {
    return {
      value: option.value ?? option.label ?? option.text ?? option,
      label: option.label ?? option.value ?? option.text ?? String(option),
      description: option.description ?? null,
    };
  }

  return {
    value: option,
    label: String(option ?? ''),
    description: null,
  };
}

export function MultiSelectDropdown({ label, description, options = [], selected = [], onChange = () => {}, className }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [portalElement, setPortalElement] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    setPortalElement(getPortalTarget());
  }, []);

  const normalizedOptions = useMemo(() => options.map(resolveOption), [options]);
  const optionValues = useMemo(() => normalizedOptions.map((option) => option.value), [normalizedOptions]);
  const totalOptions = normalizedOptions.length;
  const allSelected = totalOptions > 0 && selected.length === totalOptions;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...optionValues]);
    }
  }, [allSelected, onChange, optionValues]);

  const toggleOption = useCallback(
    (value) => {
      if (selected.includes(value)) {
        onChange(selected.filter((item) => item !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [onChange, selected]
  );

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  const openMenu = useCallback(() => {
    updateMenuPosition();
    setIsOpen(true);
  }, [updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickAway = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) {
        return;
      }
      closeMenu();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    const handleResize = () => {
      updateMenuPosition();
    };

    document.addEventListener('mousedown', handleClickAway);
    document.addEventListener('touchstart', handleClickAway);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickAway);
      document.removeEventListener('touchstart', handleClickAway);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, closeMenu, updateMenuPosition]);

  const summaryText = useMemo(() => {
    if (selected.length === 0) {
      return 'No items selected';
    }
    if (selected.length === totalOptions) {
      return 'All selected';
    }
    if (selected.length <= 2) {
      return selected.join(', ');
    }
    return `${selected.length} selected`;
  }, [selected, totalOptions]);

  const selectedPreview = useMemo(() => {
    if (selected.length === 0) {
      return null;
    }

    const maxPreview = 3;
    const previewItems = selected.slice(0, maxPreview);
    const remainder = selected.length - previewItems.length;

    return (
      <div className='flex flex-wrap gap-2'>
        {previewItems.map((item) => (
          <span key={item} className='tag bg-primary/5 text-primary'>
            {item}
          </span>
        ))}
        {remainder > 0 ? (
          <span className='tag bg-primary/5 text-primary'>+{remainder} more</span>
        ) : null}
      </div>
    );
  }, [selected]);

  const renderMenu = () => {
    if (!isOpen || !portalElement || !menuPosition) {
      return null;
    }

    return createPortal(
      <div className='fixed inset-0 z-[1200]' role='presentation'>
        <div
          ref={menuRef}
          className='absolute rounded-3xl border border-border/70 bg-surface/95 shadow-2xl backdrop-blur'
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            minWidth: menuPosition.width,
            maxWidth: Math.max(menuPosition.width, 320),
          }}
        >
          <div className='flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.35em] text-muted'>{label}</p>
            {normalizedOptions.length > 0 ? (
              <button
                type='button'
                onClick={toggleAll}
                className='text-xs font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80'
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            ) : null}
          </div>
          <div className='max-h-64 overflow-auto px-2 py-3'>
            {normalizedOptions.length === 0 ? (
              <p className='px-3 text-sm text-muted'>No options available yet.</p>
            ) : (
              normalizedOptions.map((option) => {
                const isActive = selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type='button'
                    onClick={() => toggleOption(option.value)}
                    className={clsx(
                      'flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm transition',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-[0_15px_40px_-30px_rgba(99,102,241,0.45)]'
                        : 'text-emphasis hover:bg-primary/5'
                    )}
                  >
                    <span className='flex flex-col gap-1'>
                      <span className='font-semibold'>{option.label}</span>
                      {option.description ? (
                        <span className='text-xs text-muted'>{option.description}</span>
                      ) : null}
                    </span>
                    {isActive ? <Check className='h-4 w-4' aria-hidden='true' /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>,
      portalElement
    );
  };

  const containerClassName = clsx('space-y-4', className);

  return (
    <div className={containerClassName}>
      {label ? (
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <p className='text-xs font-semibold uppercase tracking-[0.35em] text-muted'>{label}</p>
            {description ? <p className='text-xs text-muted'>{description}</p> : null}
          </div>
          {normalizedOptions.length > 0 ? (
            <button
              type='button'
              onClick={toggleAll}
              className='text-xs font-semibold uppercase tracking-wide text-primary transition hover:text-primary/80'
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type='button'
        ref={triggerRef}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        className='flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface/90 px-4 py-3 text-left text-sm font-semibold text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
      >
        <span className='truncate'>{summaryText}</span>
        <ChevronDown className={clsx('h-4 w-4 transition', isOpen && 'rotate-180 text-primary')} aria-hidden='true' />
      </button>

      {selectedPreview}
      {renderMenu()}
    </div>
  );
}
