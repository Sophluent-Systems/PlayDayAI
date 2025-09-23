/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './packages/shared/src/**/*.{js,jsx,ts,tsx}',
    './packages/shared/src/**/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--color-background) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        primary: 'hsl(var(--color-primary) / <alpha-value>)',
        secondary: 'hsl(var(--color-secondary) / <alpha-value>)',
        accent: 'hsl(var(--color-accent) / <alpha-value>)',
        muted: 'hsl(var(--color-muted) / <alpha-value>)',
        emphasis: 'hsl(var(--color-emphasis) / <alpha-value>)',
        border: 'hsl(var(--color-border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        display: ['var(--font-display)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-mono)', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        soft: '0 20px 60px -25px hsl(var(--color-emphasis) / 0.35)',
        glow: '0 0 0 1px hsl(var(--color-primary) / 0.15), 0 12px 40px -20px hsl(var(--color-primary) / 0.55)',
      },
      backgroundImage: {
        'mesh-gradient': 'radial-gradient(circle at 20% 20%, hsl(var(--color-primary) / 0.25), transparent 45%), radial-gradient(circle at 80% 0%, hsl(var(--color-secondary) / 0.2), transparent 55%), radial-gradient(circle at 50% 80%, hsl(var(--color-accent) / 0.2), transparent 50%)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: 0, transform: 'translateY(18px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease both',
        shimmer: 'shimmer 3s linear infinite',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
};
