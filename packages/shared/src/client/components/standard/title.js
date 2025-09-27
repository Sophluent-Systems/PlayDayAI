import React from 'react';
import { defaultAppTheme } from '@src/common/theme';

function Title(props) {
  const { title, theme } = props;
  const themeToUse = theme || defaultAppTheme;
  const palette = {
    background: themeToUse?.colors?.titleBackgroundColor ?? '#111827',
    font: themeToUse?.colors?.titleFontColor ?? '#f8fafc',
    fontFamily: themeToUse?.fonts?.titleFont ?? 'var(--font-display, "Inter", sans-serif)',
  };

  return (
    <div
      className="relative flex h-24 items-center justify-center overflow-hidden rounded-t-3xl border-b border-white/10"
      style={{ backgroundColor: palette.background }}
    >
      <div className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.06), transparent 50%)',
        }}
      />
      <h1
        className="relative text-center text-2xl font-semibold tracking-[0.3em] uppercase text-white drop-shadow-md sm:text-3xl"
        style={{ color: palette.font, fontFamily: palette.fontFamily }}
      >
        {title}
      </h1>
    </div>
  );
}

export default Title;
