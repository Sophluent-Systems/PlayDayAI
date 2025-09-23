import { createTheme } from '@mui/material/styles';
import { primaryPalette } from '@src/common/theme';

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

  return {
    mode,
    primary: {
      main: primaryPalette['Teal'],
      contrastText: primaryPalette['Deep Space Blue'],
    },
    secondary: {
      main: primaryPalette['Amber'],
      contrastText: primaryPalette['Deep Space Blue'],
    },
    background: {
      default: primaryPalette['Deep Space Blue'],
      paper: primaryPalette['Dark Slate Gray'],
    },
    text: {
      primary: primaryPalette['White Smoke'],
      secondary: primaryPalette['Cool Gray'],
      disabled: primaryPalette['Muted Gray'],
    },
    divider: '#243042',
  };
};

export const createAppTheme = (mode = 'dark') => {
  const palette = buildPalette(mode);
  const baseTheme = createTheme({
    palette,
    typography,
  });

  const primaryAlpha = (alpha) => baseTheme.palette.primary.main + alpha;
  const secondaryAlpha = (alpha) => baseTheme.palette.secondary.main + alpha;

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
            backgroundColor: baseTheme.palette.primary.dark || '#2747c7',
            color: baseTheme.palette.primary.contrastText,
          },
        },
        containedSecondary: {
          backgroundColor: baseTheme.palette.secondary.main,
          color: baseTheme.palette.secondary.contrastText,
          '&:hover': {
            backgroundColor: baseTheme.palette.secondary.dark || '#16a34a',
            color: baseTheme.palette.secondary.contrastText,
          },
        },
        outlinedPrimary: {
          borderColor: baseTheme.palette.primary.main,
          color: baseTheme.palette.primary.main,
          '&:hover': {
            backgroundColor: primaryAlpha('1a'),
            borderColor: baseTheme.palette.primary.main,
          },
        },
        outlinedSecondary: {
          borderColor: baseTheme.palette.secondary.main,
          color: baseTheme.palette.secondary.main,
          '&:hover': {
            backgroundColor: secondaryAlpha('1a'),
            borderColor: baseTheme.palette.secondary.main,
          },
        },
        textPrimary: {
          color: baseTheme.palette.primary.main,
          '&:hover': {
            backgroundColor: primaryAlpha('12'),
          },
        },
        textSecondary: {
          color: baseTheme.palette.secondary.main,
          '&:hover': {
            backgroundColor: secondaryAlpha('12'),
          },
        },
      },
    },
  };

  return baseTheme;
};

export const theme = createAppTheme('dark');
