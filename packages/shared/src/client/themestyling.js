import { resolvePersonaIcon } from '@src/client/components/versioneditor/personas/icons';

export function getMessageStyling(mediaTypes, persona) {
  if (!persona) {
    return {};
  }

  const paperStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    minWidth: '80%',
    maxWidth: '800px',
    padding: 16,
    marginBottom: 16,
    boxShadow: '0 3px 5px rgba(15, 23, 42, 0.25)',
    width: 'auto',
  };

  if (Array.isArray(mediaTypes) && (mediaTypes.includes('text') || mediaTypes.includes('audio'))) {
    paperStyle.width = '100%';
  }

  const colors = persona.theme?.colors ?? {};
  const fonts = persona.theme?.fonts ?? {};
  const iconSettings = persona.theme?.icon ?? {};

  return {
    backgroundColor: colors.messageBackgroundColor,
    color: colors.messageTextColor,
    audioVisualizationColor: colors.audioVisualizationColor || colors.messageTextColor,
    buttonColor: colors.buttonColor || colors.messageBackgroundColor,
    fontFamily: fonts.fontFamily,
    icon: resolvePersonaIcon(iconSettings.iconID),
    iconColor: iconSettings.color || colors.messageTextColor,
    paperStyle,
  };
}
