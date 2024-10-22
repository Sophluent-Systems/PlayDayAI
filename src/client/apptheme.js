// In apptheme.js
import { createTheme } from '@mui/material/styles';
import { primaryPalette } from '@src/common/theme';

export const theme = createTheme({
  palette: {
    mode: 'dark', // Set the theme to dark mode
    primary: {
      main: primaryPalette["Teal"],
      contrastText: primaryPalette["Deep Space Blue"],
    },
    secondary: {
      main: primaryPalette["Amber"],
      contrastText: primaryPalette["Deep Space Blue"],
    },
    background: {
      default: primaryPalette["Deep Space Blue"],
      main: primaryPalette["Deep Space Blue"],
      paper: primaryPalette["Dark Slate Gray"],
      immersive: process.env.NODE_ENV === 'production' ? primaryPalette["Deep Space Blue"] : 'magenta',
    },
    text: {
      primary: primaryPalette["White Smoke"],
      secondary: primaryPalette["Cool Gray"],
      disabled: primaryPalette["Muted Gray"],
    },
  },
  typography: {
    h1: {
      fontSize: '5rem',
      fontWeight: 500,
      color: primaryPalette["White Smoke"],
    },
    h2: {
      fontSize: '3.5rem',
      fontWeight: 500,
      color: primaryPalette["White Smoke"],
    },
    h3: {
      fontSize: '2.5rem',
      fontWeight: 500,
      color: primaryPalette["White Smoke"],
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      color: primaryPalette["White Smoke"],
    },
    body1: {
      fontSize: '1rem',
      color: primaryPalette["Cool Gray"],
    },
    body2: {
      fontSize: '0.875rem',
      color: primaryPalette["Cool Gray"],
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
        containedPrimary: {
          backgroundColor: primaryPalette["Teal"],
          color: primaryPalette["White Smoke"],
          '&:hover': {
            backgroundColor: primaryPalette["Light Teal"], // Ensure hover contrast
            color: primaryPalette["Deep Space Blue"], // Light text on hover
          },
          '&:active': {
            backgroundColor: primaryPalette["Bright Blue"], // Ensure vibrancy
            color: primaryPalette["White Smoke"],
          },
        },
        containedSecondary: {
          backgroundColor: primaryPalette["Amber"],
          color: primaryPalette["Deep Space Blue"],
          '&:hover': {
            backgroundColor: primaryPalette["Dark Orange"], // More distinct hover color
            color: primaryPalette["White Smoke"],
          },
          '&:active': {
            backgroundColor: primaryPalette["Bright Blue"], // Ensure vibrancy
            color: primaryPalette["White Smoke"],
          },
        },
        outlinedPrimary: {
          borderColor: primaryPalette["Teal"],
          color: primaryPalette["Teal"],
          '&:hover': {
            backgroundColor: primaryPalette["Light Teal"], // Lighter background on hover
            color: primaryPalette["Deep Space Blue"],
          },
          '&:active': {
            backgroundColor: primaryPalette["Bright Blue"],
            color: primaryPalette["White Smoke"],
          },
        },
        outlinedSecondary: {
          borderColor: primaryPalette["Amber"],
          color: primaryPalette["Amber"],
          '&:hover': {
            backgroundColor: primaryPalette["Dark Orange"], // Distinct hover color
            color: primaryPalette["White Smoke"],
          },
          '&:active': {
            backgroundColor: primaryPalette["Bright Blue"],
            color: primaryPalette["White Smoke"],
          },
        },
        textPrimary: {
          color: primaryPalette["White Smoke"],
          '&:hover': {
            backgroundColor: primaryPalette["Cool Gray"],
          },
          '&:active': {
            backgroundColor: primaryPalette["Dark Slate Gray"],
          },
        },
        textSecondary: {
          color: primaryPalette["Cool Gray"],
          '&:hover': {
            backgroundColor: primaryPalette["Light Amber"],
            color: primaryPalette["White Smoke"],
          },
          '&:active': {
            backgroundColor: primaryPalette["Dark Slate Gray"],
            color: primaryPalette["White Smoke"],
          },
        },
      },
    },
  },
});