import { createTheme } from '@mui/material/styles';
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

export const createAppTheme = (mode = 'dark') => {
  const palette = buildPalette(mode);
  const baseTheme = createTheme({
    palette,
    typography,
  });

  const withAlpha = (color, alphaHex) => `${color}${alphaHex}`;

  baseTheme.components = {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 999,
          paddingInline: baseTheme.spacing(2.5),
          paddingBlock: baseTheme.spacing(1),
          fontWeight: 600,
        },
        containedPrimary: {
          backgroundColor: baseTheme.palette.primary.main,
          color: baseTheme.palette.primary.contrastText,
          '&:hover': {
            backgroundColor: baseTheme.palette.primary.dark || baseTheme.palette.primary.main,
            color: baseTheme.palette.primary.contrastText,
          },
        },
        containedSecondary: {
          backgroundColor: baseTheme.palette.secondary.main,
          color: baseTheme.palette.secondary.contrastText,
          '&:hover': {
            backgroundColor: baseTheme.palette.secondary.dark || baseTheme.palette.secondary.main,
            color: baseTheme.palette.secondary.contrastText,
          },
        },
        outlinedPrimary: {
          borderColor: baseTheme.palette.primary.main,
          color: baseTheme.palette.primary.main,
          '&:hover': {
            backgroundColor: withAlpha(baseTheme.palette.primary.main, '1a'),
            borderColor: baseTheme.palette.primary.main,
          },
        },
        outlinedSecondary: {
          borderColor: baseTheme.palette.secondary.main,
          color: baseTheme.palette.secondary.main,
          '&:hover': {
            backgroundColor: withAlpha(baseTheme.palette.secondary.main, '1a'),
            borderColor: baseTheme.palette.secondary.main,
          },
        },
        textPrimary: {
          color: baseTheme.palette.primary.main,
          '&:hover': {
            backgroundColor: withAlpha(baseTheme.palette.primary.main, '12'),
          },
        },
        textSecondary: {
          color: baseTheme.palette.secondary.main,
          '&:hover': {
            backgroundColor: withAlpha(baseTheme.palette.secondary.main, '12'),
          },
        },
      },
    },
  };

  return baseTheme;
};

export const theme = createAppTheme('dark');
