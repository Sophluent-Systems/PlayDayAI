
import React from 'react';
import { defaultAppTheme } from '@src/common/theme';

function Title({ title, theme }) {
  const themeToUse = theme || defaultAppTheme;
  const backgroundColor = themeToUse.colors?.titleBackgroundColor || '#0f172a';
  const textColor = themeToUse.colors?.titleFontColor || '#f8fafc';
  const fontFamily = themeToUse.fonts?.titleFont || 'Inter, sans-serif';
  const textShadow = themeToUse.palette?.textSecondary
    ? `0px 0px 10px ${themeToUse.palette.textSecondary}`
    : '0px 0px 10px rgba(15,23,42,0.35)';

  return (
    <div
      className='flex h-[75px] w-full items-center justify-center bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4'
      style={{ backgroundColor }}
    >
      <h1
        className='text-center text-2xl font-bold uppercase tracking-[0.2em] text-white'
        style={{ color: textColor, fontFamily, textShadow }}
      >
        {title}
      </h1>
    </div>
  );
}

export default Title;
