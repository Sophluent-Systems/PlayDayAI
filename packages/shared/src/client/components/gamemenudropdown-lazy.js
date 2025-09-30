"use client";

import { memo, forwardRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Create a lazy-loaded GameMenuDropdown with proper error boundaries and loading states
const GameMenuDropdownComponent = dynamic(
  () => import('./gamemenudropdown').then(mod => ({ default: mod.GameMenuDropdown })),
  {
    ssr: false,
    loading: () => (
      <div className="fixed z-50 w-[320px] overflow-hidden rounded-3xl border border-border/60 bg-surface/95 shadow-[0_28px_55px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl">
        <div className="border-b border-border/60 bg-gradient-to-r from-primary/12 via-surface/60 to-transparent px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Project actions</p>
              <div className="mt-1 h-4 w-24 animate-pulse rounded bg-border/40" />
            </div>
            <div className="h-6 w-12 animate-pulse rounded-full bg-border/40" />
          </div>
          <div className="mt-3 h-3 w-48 animate-pulse rounded bg-border/30" />
        </div>
        <div className="space-y-4 px-4 pb-5 pt-4">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-surface/80 px-4 py-3">
                <div className="mt-0.5 h-9 w-9 animate-pulse rounded-2xl bg-border/40" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-border/40" />
                  <div className="h-3 w-32 animate-pulse rounded bg-border/30" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
);

// Preload the component during idle time
let preloadScheduled = false;
function schedulePreload() {
  if (preloadScheduled || typeof window === 'undefined') {
    return;
  }
  preloadScheduled = true;
  
  // Preload during idle time or after a short delay
  const preload = () => {
    import('./gamemenudropdown').catch(() => {
      // Ignore preload errors - the component will still load when actually needed
    });
  };
  
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preload, { timeout: 3000 });
  } else {
    setTimeout(preload, 2000);
  }
}

// Create a wrapper component that handles the lazy loading behavior
const LazyGameMenuDropdown = memo(forwardRef(function LazyGameMenuDropdown(props, ref) {
  const { anchor, ...otherProps } = props;
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  
  // Schedule preload on mount
  useEffect(() => {
    schedulePreload();
  }, []);
  
  // Track if the menu has ever been opened to enable caching
  useEffect(() => {
    if (anchor && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
  }, [anchor, hasBeenOpened]);
  
  // Only render if menu is currently open OR has been opened before (for caching)
  if (!anchor && !hasBeenOpened) {
    return null;
  }

  // Pass through all props to the actual component - let it handle anchor logic
  return <GameMenuDropdownComponent ref={ref} anchor={anchor} {...otherProps} />;
}));

export { LazyGameMenuDropdown as GameMenuDropdown };
