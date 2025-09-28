"use client";

import React, { useContext } from 'react';
import clsx from 'clsx';
import GameMenu from '@src/client/components/gamemenu';
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
  ...menuProps
}) {
  const { game } = useContext(stateManager);

  if (!game?.gameID) {
    return null;
  }

  const outerClasses = clsx('group/gear inline-flex', outerClassName);
  const innerClasses = clsx(
    'inline-flex h-11 items-center justify-center gap-0 rounded-full border border-border/50 bg-surface/95 px-2 text-muted shadow-soft transition-all duration-300 ease-out group-hover/gear:gap-3 group-hover/gear:justify-start group-hover/gear:border-primary/60 group-hover/gear:px-4 group-hover/gear:text-primary group-focus-within/gear:justify-start',
    innerClassName
  );
  const { className: menuClassNameProp, ...restMenuProps } = menuProps;
  const menuClassName = clsx(
    '!h-9 !w-9 !rounded-full !border-none !bg-transparent !text-current !shadow-none !hover:translate-y-0 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    buttonClassName,
    menuClassNameProp
  );
  const labelClasses = clsx(
    'pointer-events-none hidden whitespace-nowrap text-xs font-semibold uppercase tracking-wide transition-all duration-200 ease-out group-focus-within/gear:inline group-hover/gear:inline',
    labelClassName
  );

  return (
    <div className={outerClasses}>
      <div className={innerClasses}>
        <GameMenu
          placement={placement}
          allowEditOptions={allowEditOptions}
          includePlayOption={includePlayOption}
          className={menuClassName}
          {...restMenuProps}
        />
        <span className={labelClasses}>{label}</span>
      </div>
    </div>
  );
}
