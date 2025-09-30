import React from 'react';
import { PersonaIcons } from './icons';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { EyeOff } from 'lucide-react';

export function PersonaCard({ persona }) {
  if (nullUndefinedOrEmpty(persona)) {
    return null;
  }

  const theme = persona.theme || {};
  const colors = theme.colors || {};
  const fonts = theme.fonts || {};
  const icon = theme.icon || {};
  const IconComponent = PersonaIcons[icon.iconID];
  const backgroundColor = colors.messageBackgroundColor || '#ffffff';
  const textColor = colors.messageTextColor || '#0f172a';

  return (
    <div
      className='flex w-full items-center gap-3 rounded-xl border border-black/10 px-4 py-2 shadow-sm transition hover:border-black/20 dark:border-white/10 dark:hover:border-white/20'
      style={{ backgroundColor, color: textColor, fontFamily: fonts.fontFamily }}
    >
      <span className='flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10'>
        <IconComponent className='h-5 w-5' color={icon.color || textColor} />
      </span>
      <div className='flex min-w-0 flex-1 flex-col'>
        <span className='truncate text-sm font-semibold'>{persona.displayName}</span>
        {persona.identity ? (
          <span className='truncate text-xs text-black/70 dark:text-white/70'>{persona.identity}</span>
        ) : null}
      </div>
      {persona.hideFromEndUsers ? (
        <EyeOff className='h-4 w-4 text-black/70 dark:text-white/70' />
      ) : null}
    </div>
  );
}
