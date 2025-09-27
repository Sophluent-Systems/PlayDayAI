import { PersonaIcons } from "@src/client/components/versioneditor/personas/icons";

export function getMessageStyling(mediaTypes, persona) {
  if (!persona) {
    return {};
  }

  const personaTheme = persona.theme || {};
  const personaColors = personaTheme.colors || {};
  const personaFonts = personaTheme.fonts || {};
  const personaIcon = personaTheme.icon || {};

  const backgroundColor = personaColors.messageBackgroundColor || '#101D32';
  const textColor = personaColors.messageTextColor || '#F8FAFF';
  const accentColor = personaColors.buttonColor || personaColors.audioVisualizationColor || '#38BDF8';
  const audioColor = personaColors.audioVisualizationColor || accentColor;
  const borderColor = personaColors.borderColor || withAlpha(accentColor, 0.35);

  const widthHint = mediaTypes?.includes('text') || mediaTypes?.includes('audio') ? '100%' : 'auto';

  return {
    backgroundColor,
    color: textColor,
    accent: accentColor,
    buttonColor: accentColor,
    audioVisualizationColor: audioColor,
    borderColor,
    hoverTint: withAlpha(accentColor, 0.12),
    chipColor: withAlpha(accentColor, 0.2),
    badgeColor: personaColors.badgeColor || withAlpha(accentColor, 0.25),
    glowColor: withAlpha(accentColor, 0.45),
    overlayTint: withAlpha(backgroundColor, 0.55),
    fontFamily: personaFonts.fontFamily || '"Inter", sans-serif',
    icon: PersonaIcons[personaIcon.iconID],
    iconColor: personaIcon.color || accentColor,
    layoutHint: {
      width: widthHint,
    },
  };
}

function withAlpha(color, alpha) {
  if (!color) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  if (color.startsWith('rgba')) {
    return color.replace(/rgba\(([^)]+)\)/, (_, components) => {
      const [r, g, b] = components.split(',').map((value) => value.trim()).slice(0, 3);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  if (color.startsWith('rgb')) {
    return color.replace(/rgb\(([^)]+)\)/, (_, components) => {
      const [r, g, b] = components.split(',').map((value) => value.trim());
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }
  return hexToRgba(color, alpha);
}

function hexToRgba(hex, alpha) {
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map((char) => char + char).join('');
  }
  const intValue = parseInt(normalized, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
