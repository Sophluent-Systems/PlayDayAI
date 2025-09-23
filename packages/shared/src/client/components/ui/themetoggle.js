"use client";

import React from 'react';
import clsx from 'clsx';
import { useTheme } from 'next-themes';
import { Moon, Monitor, Sun } from 'lucide-react';

const options = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'Auto',
    icon: Monitor,
  },
];

export function ThemeToggle({ className }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className={clsx(
          'flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/80 px-3 py-1.5 text-muted shadow-soft',
          className
        )}
      >
        <div className="h-3 w-3 animate-pulse rounded-full bg-border/70" />
        <div className="h-3 w-3 animate-pulse rounded-full bg-border/60" />
        <div className="h-3 w-3 animate-pulse rounded-full bg-border/50" />
      </div>
    );
  }

  const activeTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-2xl border border-border/60 bg-surface/90 px-1.5 py-1 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.35)] backdrop-blur-sm',
        className
      )}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const isActive = value === theme || (value === 'system' && theme === 'system');
        const displayActive = value === activeTheme || (value === 'system' && theme === 'system');

        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={clsx(
              'flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              displayActive
                ? 'bg-primary/15 text-emphasis shadow-[0_10px_24px_-18px_rgba(99,102,241,0.45)]'
                : 'text-muted hover:text-emphasis'
            )}
            aria-pressed={isActive}
          >
            <Icon className={clsx('h-4 w-4', displayActive ? 'text-primary' : 'text-muted')} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
            {displayActive ? (
              <span className="inline-flex sm:hidden">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
