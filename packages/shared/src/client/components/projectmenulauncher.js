"use client";

import React, { useContext, useState, useCallback } from 'react';
import clsx from 'clsx';
import { Settings } from 'lucide-react';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown-lazy';
import { stateManager } from '@src/client/statemanager';

export function ProjectMenuLauncher({
  allowEditOptions = true,
  includePlayOption = true,
  placement = 'inline',
  outerClassName,
  innerClassName,
  buttonClassName,
  labelClassName,
  label = 'Project menu',
  onMenuClose: externalOnMenuClose,
  className: triggerClassName,
  ...dropdownProps
}) {
  const menuProps = dropdownProps;

  const { game } = useContext(stateManager);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleToggleMenu = useCallback((event) => {
    const target = event.currentTarget;
    setAnchorEl((current) => {
      if (current) {
        externalOnMenuClose?.();
        return null;
      }
      return target;
    });
  }, [externalOnMenuClose]);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    externalOnMenuClose?.();
  }, [externalOnMenuClose]);

  if (!game?.gameID) {
    return null;
  }

  const outerClasses = clsx('inline-flex', outerClassName);

  const baseButtonClasses = 'group inline-flex h-11 items-center rounded-full border border-border/50 bg-surface/95 text-muted shadow-soft transition-all duration-300 ease-out';
  const interactiveClasses = 'hover:border-primary/60 hover:text-primary hover:px-4 hover:gap-3 hover:justify-start focus-visible:border-primary/60 focus-visible:text-primary focus-visible:px-4 focus-visible:gap-3 focus-visible:justify-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
  const closedLayoutClasses = 'px-2 gap-0 justify-center';
  const openLayoutClasses = 'px-4 gap-3 justify-start border-primary/60 text-primary';
  const placementOverrides = placement === 'inline' ? '' : 'absolute top-4 right-6 z-30';

  const buttonClasses = clsx(
    baseButtonClasses,
    interactiveClasses,
    anchorEl ? openLayoutClasses : closedLayoutClasses,
    placementOverrides,
    innerClassName,
    buttonClassName,
    triggerClassName
  );

  const iconWrapperClasses = clsx(
    'flex h-9 w-9 items-center justify-center rounded-2xl border border-border/70 bg-surface/80 transition-all duration-200',
    anchorEl && 'border-primary/40 bg-primary/10 text-primary',
    'group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary group-focus-visible:border-primary/40 group-focus-visible:bg-primary/10 group-focus-visible:text-primary'
  );

  const labelClasses = clsx(
    'hidden whitespace-nowrap text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-out group-hover:inline group-focus-visible:inline',
    anchorEl && 'inline',
    labelClassName
  );

  return (
    <div className={outerClasses}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        onClick={handleToggleMenu}
        className={buttonClasses}
      >
        <span className={iconWrapperClasses}>
          <Settings className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className={labelClasses}>{label}</span>
      </button>
      <GameMenuDropdown
        anchor={anchorEl}
        onMenuClose={handleMenuClose}
        allowEditOptions={allowEditOptions}
        includePlayOption={includePlayOption}
        gameUrl={game?.url}
        gameID={game?.gameID}
        {...menuProps}
      />
    </div>
  );
}
