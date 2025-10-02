import { themePresets } from '@src/common/theme';

const typography = {
  h1: {
    fontSize: '3.5rem',
    fontWeight: 600,
  },
  h2: {
    fontSize: '2.75rem',
    fontWeight: 600,
  },
  h3: {
    fontSize: '2.125rem',
    fontWeight: 600,
  },
  h4: {
    fontSize: '1.75rem',
    fontWeight: 600,
  },
  body1: {
    fontSize: '1rem',
  },
  body2: {
    fontSize: '0.875rem',
  },
};

const fallbackPalette = {
  background: '#020617',
  surface: '#050B1B',
  surfaceAlt: '#0B162E',
  card: '#101D32',
  cardMuted: '#0A1423',
  textPrimary: '#F8FAFF',
  textSecondary: '#A5B4CE',
  accent: '#38BDF8',
  accentSoft: '#0EA5E9',
  accentContrast: '#041019',
  warning: '#FACC15',
  success: '#34D399',
  danger: '#F87171',
  info: '#5EEAD4',
  border: '#1F2A44',
  muted: '#0F1B2F',
};

const buildPalette = (mode) => {
  if (mode === 'light') {
    return {
      mode,
      primary: {
        main: '#4361ee',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#22c55e',
        contrastText: '#052e16',
      },
      background: {
        default: '#f5f7ff',
        paper: '#ffffff',
      },
      text: {
        primary: '#111827',
        secondary: '#475569',
        disabled: '#9ca3af',
      },
      divider: '#e2e8f0',
    };
  }

  const palette = themePresets?.default?.palette ?? fallbackPalette;

  return {
    mode,
    primary: {
      main: palette.accent || fallbackPalette.accent,
      contrastText: palette.accentContrast || fallbackPalette.accentContrast,
    },
    secondary: {
      main: palette.info || fallbackPalette.info,
      contrastText: palette.background || fallbackPalette.background,
    },
    background: {
      default: palette.background || fallbackPalette.background,
      paper: palette.surface || fallbackPalette.surface,
    },
    text: {
      primary: palette.textPrimary || fallbackPalette.textPrimary,
      secondary: palette.textSecondary || fallbackPalette.textSecondary,
      disabled: palette.muted || fallbackPalette.muted,
    },
    divider: palette.border || fallbackPalette.border,
  };
};

export const createAppTheme = (mode = 'dark') => ({
  mode,
  palette: buildPalette(mode),
  typography,
});

export const theme = createAppTheme('dark');