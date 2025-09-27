export const THEME_SCHEMA_VERSION = '2025.06';

const baseTypography = {
  display: '"Satoshi", "Plus Jakarta Sans", "Space Grotesk", sans-serif',
  body: '"Inter", "Geist", "SF Pro Text", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
};

const baseTokens = {
  radius: {
    none: '0px',
    sm: '10px',
    md: '18px',
    lg: '26px',
    xl: '38px',
    full: '999px',
  },
  spacing: {
    gutter: '2.75rem',
    card: '2.25rem',
    inset: '1.5rem',
    compact: '0.75rem',
  },
  blur: {
    glass: '18px',
  },
};

const PRESET_DEFINITIONS = [
  {
    id: 'default',
    name: 'Celestial Tide',
    description: 'Deep navy glass and luminous cyan accents ideal for conversational agents.',
    palette: {
      background: '#020617',
      surface: '#050B1B',
      surfaceAlt: '#0B162E',
      card: '#101D32',
      cardMuted: '#0A1423',
      textPrimary: '#F8FAFF',
      textSecondary: '#A5B4CE',
      accent: '#38BDF8',
      accentSoft: '#0EA5E9',
      accentMuted: '#153654',
      accentContrast: '#041019',
      warning: '#FACC15',
      success: '#34D399',
      danger: '#F87171',
      info: '#5EEAD4',
      border: '#1F2A44',
      muted: '#0F1B2F',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora Vignette',
    description: 'A cinematic indigo base with ultraviolet gradients and soft neon glows.',
    palette: {
      background: '#070212',
      surface: '#0F0A1F',
      surfaceAlt: '#17122F',
      card: '#1D1A3B',
      cardMuted: '#14102D',
      textPrimary: '#F4F3FF',
      textSecondary: '#C8C6F0',
      accent: '#A855F7',
      accentSoft: '#C084FC',
      accentMuted: '#392567',
      accentContrast: '#130A2C',
      warning: '#F97316',
      success: '#4ADE80',
      danger: '#FB7185',
      info: '#60A5FA',
      border: '#2C2251',
      muted: '#1A1632',
    },
  },
  {
    id: 'solstice',
    name: 'Solstice Bloom',
    description: 'Sunlit neutrals with coral and saffron for narrative-forward experiences.',
    palette: {
      background: '#0A0B10',
      surface: '#12131A',
      surfaceAlt: '#1B1D27',
      card: '#232531',
      cardMuted: '#1A1C26',
      textPrimary: '#FAFAF6',
      textSecondary: '#B8B9C5',
      accent: '#F97362',
      accentSoft: '#F7905D',
      accentMuted: '#3A2B2B',
      accentContrast: '#160806',
      warning: '#FACC15',
      success: '#4ADE80',
      danger: '#F43F5E',
      info: '#38BDF8',
      border: '#2F3039',
      muted: '#1E202A',
    },
  },
  {
    id: 'neonwave',
    name: 'Neon Wave',
    description: 'High-contrast carbon fiber base with electric teal and magenta accents.',
    palette: {
      background: '#020202',
      surface: '#08090F',
      surfaceAlt: '#10121E',
      card: '#161A28',
      cardMuted: '#0E111C',
      textPrimary: '#E9F5FF',
      textSecondary: '#9AA6C6',
      accent: '#22D3EE',
      accentSoft: '#0EA5E9',
      accentMuted: '#133A4C',
      accentContrast: '#021012',
      warning: '#FACC15',
      success: '#34D399',
      danger: '#FB7185',
      info: '#C084FC',
      border: '#1C2438',
      muted: '#101525',
    },
  },
  {
    id: 'minimalMist',
    name: 'Minimal Mist',
    description: 'Calm monochrome with polar highlights for productivity and research flows.',
    palette: {
      background: '#050506',
      surface: '#0C0C10',
      surfaceAlt: '#15151B',
      card: '#1C1C25',
      cardMuted: '#12121A',
      textPrimary: '#F5F6FA',
      textSecondary: '#B6B8C7',
      accent: '#7DD3FC',
      accentSoft: '#BAE6FD',
      accentMuted: '#284560',
      accentContrast: '#0B1016',
      warning: '#FACC15',
      success: '#86EFAC',
      danger: '#FCA5A5',
      info: '#A855F7',
      border: '#242530',
      muted: '#181822',
    },
  },
];

export const themePresetsCatalog = PRESET_DEFINITIONS.map((definition) => ({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  palette: definition.palette,
}));

export const themePresets = PRESET_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.id] = finalizeTheme(definition);
  return acc;
}, {});

export const defaultAppTheme = cloneTheme(themePresets.default);

export function normalizeTheme(theme) {
  if (!theme) {
    return cloneTheme(themePresets.default);
  }

  if (theme.meta?.schemaVersion === THEME_SCHEMA_VERSION) {
    const presetId = theme.meta?.preset && themePresets[theme.meta.preset] ? theme.meta.preset : 'default';
    const baseDefinition = getPresetDefinition(presetId);
    const mergedDefinition = mergeDefinitions(baseDefinition, theme);
    return finalizeTheme(mergedDefinition);
  }

  if (isLegacyTheme(theme)) {
    return cloneTheme(themePresets.default);
  }

  if (theme.preset && themePresets[theme.preset]) {
    return cloneTheme(themePresets[theme.preset]);
  }

  return cloneTheme(themePresets.default);
}

export function createThemeFromPreset(presetId) {
  const definition = getPresetDefinition(presetId);
  return finalizeTheme(definition);
}

function mergeDefinitions(baseDefinition, overrideTheme) {
  const paletteOverride = overrideTheme.palette || overrideTheme.colors || {};
  const typographyOverride = overrideTheme.typography || {};
  const fontOverrides = overrideTheme.fonts || {};
  const tokenOverrides = overrideTheme.tokens || {};

  return {
    id: overrideTheme.meta?.preset || baseDefinition.id,
    name: overrideTheme.meta?.name || baseDefinition.name,
    description: overrideTheme.meta?.description || baseDefinition.description,
    palette: {
      ...baseDefinition.palette,
      ...paletteOverride,
    },
    typography: {
      ...baseDefinition.typography,
      ...typographyOverride,
      ...mapLegacyFonts(fontOverrides),
    },
    tokens: deepMerge(baseDefinition.tokens || {}, tokenOverrides),
  };
}

function finalizeTheme(definition) {
  const palette = { ...definition.palette };
  const typography = {
    ...baseTypography,
    ...(definition.typography || {}),
  };
  const tokens = deepMerge(baseTokens, definition.tokens || {});

  const theme = {
    meta: {
      schemaVersion: THEME_SCHEMA_VERSION,
      preset: definition.id,
      name: definition.name,
      description: definition.description,
    },
    palette,
    typography,
    tokens: buildTokens(tokens, palette),
  };

  theme.colors = buildLegacyColors(palette);
  theme.fonts = buildLegacyFonts(typography);
  theme.effects = buildEffects(palette);
  theme.gradients = buildGradients(palette);
  theme.cssVariables = buildCssVariables(palette, typography);

  return theme;
}

function buildTokens(tokens, palette) {
  const computed = {
    ...tokens,
    border: {
      subtle: `1px solid ${hexWithAlpha(palette.border, 0.35)}`,
      strong: `1px solid ${hexWithAlpha(palette.border, 0.65)}`,
      accent: `1px solid ${hexWithAlpha(palette.accent, 0.55)}`,
    },
    shadow: {
      soft: `0 32px 120px -48px ${hexWithAlpha(palette.accent, 0.35)}`,
      lifted: `0 18px 60px -35px ${hexWithAlpha('#000000', 0.55)}`,
    },
    glassBorder: hexWithAlpha(palette.border, 0.55),
  };

  return computed;
}

function buildLegacyColors(palette) {
  return {
    titleBackgroundColor: palette.surfaceAlt,
    titleFontColor: palette.textPrimary,
    menuButtonColor: palette.accent,
    chatbotMessageBackgroundColor: palette.card,
    chatbotMessageTextColor: palette.textPrimary,
    userMessageBackgroundColor: palette.accent,
    userMessageTextColor: palette.accentContrast,
    debugMessageBackgroundColor: palette.warning,
    debugMessageTextColor: palette.background,
    messagesAreaBackgroundColor: palette.surface,
    inputAreaBackgroundColor: palette.surfaceAlt,
    inputAreaTextEntryBackgroundColor: palette.cardMuted,
    inputTextEnabledColor: palette.textPrimary,
    inputTextDisabledColor: palette.textSecondary,
    inputAreaInformationTextColor: palette.textSecondary,
    sendMessageButtonInactiveColor: palette.muted,
    sendMessageButtonActiveColor: palette.accent,
    sendMessageButtonActiveHoverColor: palette.accentSoft,
    suggestionsButtonColor: palette.cardMuted,
    suggestionsButtonTextColor: palette.textSecondary,
    suggestionsButtonHoverColor: palette.card,
    suggestionsButtonHoverTextColor: palette.textPrimary,
  };
}

function buildLegacyFonts(typography) {
  return {
    titleFont: typography.display,
    fontFamily: typography.body,
  };
}

function buildEffects(palette) {
  return {
    focusRing: `0 0 0 3px ${hexWithAlpha(palette.accent, 0.35)}`,
    cardShadow: `0 40px 140px -60px ${hexWithAlpha(palette.accent, 0.45)}`,
    ambient: `0 25px 70px -45px ${hexWithAlpha('#000000', 0.5)}`,
    accentGlow: `0 0 24px ${hexWithAlpha(palette.accent, 0.55)}`,
  };
}

function buildGradients(palette) {
  return {
    hero: `radial-gradient(circle at 20% 15%, ${hexWithAlpha(palette.accent, 0.25)}, transparent 55%), radial-gradient(circle at 80% 0%, ${hexWithAlpha(palette.info, 0.2)}, transparent 55%), radial-gradient(circle at 40% 90%, ${hexWithAlpha(palette.accentSoft, 0.18)}, transparent 60%)`,
    card: `linear-gradient(135deg, ${hexWithAlpha(palette.card, 0.92)} 0%, ${hexWithAlpha(palette.cardMuted, 0.92)} 100%)`,
  };
}

function buildCssVariables(palette, typography) {
  return {
    '--color-background': hexToHsl(palette.background),
    '--color-surface': hexToHsl(palette.surface),
    '--color-primary': hexToHsl(palette.accent),
    '--color-secondary': hexToHsl(palette.info),
    '--color-accent': hexToHsl(palette.accentSoft),
    '--color-muted': hexToHsl(palette.muted),
    '--color-emphasis': hexToHsl(palette.textPrimary),
    '--color-border': hexToHsl(palette.border),
    '--font-sans': typography.body,
    '--font-display': typography.display,
    '--font-mono': typography.mono,
  };
}

function getPresetDefinition(id) {
  return PRESET_DEFINITIONS.find((definition) => definition.id === id) || PRESET_DEFINITIONS[0];
}

function isLegacyTheme(theme) {
  if (!theme) {
    return false;
  }
  if (theme.meta?.schemaVersion === THEME_SCHEMA_VERSION) {
    return false;
  }
  return Boolean(theme.colors?.chatbotMessageBackgroundColor || theme.fonts?.fontFamily);
}

function mapLegacyFonts(fonts) {
  if (!fonts) {
    return {};
  }
  const mapped = {};
  if (fonts.titleFont) {
    mapped.display = fonts.titleFont;
  }
  if (fonts.fontFamily) {
    mapped.body = fonts.fontFamily;
  }
  if (fonts.mono) {
    mapped.mono = fonts.mono;
  }
  return mapped;
}

function deepMerge(target, source) {
  if (!source) {
    return { ...target };
  }
  const output = { ...target };
  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      output[key] = deepMerge(target[key] || {}, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  });
  return output;
}

function cloneTheme(theme) {
  return JSON.parse(JSON.stringify(theme));
}

function hexWithAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexToRgb(hex) {
  if (!hex) {
    return { r: 0, g: 0, b: 0 };
  }
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => char + char).join('');
  }
  const intValue = parseInt(normalized, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      default:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  const hue = Math.round(h * 360);
  const saturation = Math.round(s * 100);
  const lightness = Math.round(l * 100);

  return `${hue} ${saturation}% ${lightness}%`;
}
