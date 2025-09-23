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
      <div className={clsx('flex items-center gap-1 rounded-full border border-border/60 bg-surface/80 px-1 py-1 text-muted shadow-soft', className)}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-border/80" />
      </div>
    );
  }

  const activeTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-full border border-border/60 bg-surface/80 px-1 py-1 text-muted shadow-soft backdrop-blur-md',
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
              'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              displayActive
                ? 'bg-primary/10 text-emphasis'
                : 'text-muted hover:text-emphasis'
            )}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
