import React from "react";
import { PersonaIcons } from "@src/client/components/versioneditor/personas/icons";

export function getMessageStyling(mediaTypes, persona) {
    if (!persona) {
        return {};
    }
    
    // Default paper style
    let paperStyle = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxSizing: 'border-box',
        minWidth: '80%',
        maxWidth: '800px',
        padding: 2,
        marginBottom: 2,
        boxShadow: '0 3px 5px rgba(0, 0, 0, 0.2)',
        width: 'auto', // Width based on content
    };

    // Adjust width for media types
    if (mediaTypes.includes("text") || mediaTypes.includes("audio")) {
        paperStyle.width = '100%';
    }

    // Return the styling object
    return {
        backgroundColor: persona.theme.colors.messageBackgroundColor, // Background color
        color: persona.theme.colors.messageTextColor, // Text color
        audioVisualizationColor: persona.theme.colors.audioVisualizationColor || persona.theme.colors.messageTextColor, // Fallback to text color if not defined
        buttonColor: persona.theme.colors.buttonColor || persona.theme.colors.messageBackgroundColor, // Fallback to message background color
        fontFamily: persona.theme.fonts.fontFamily, // Font family
        icon: PersonaIcons[persona.theme.icon.iconID], // Ensure iconID is correct
        iconColor: persona.theme.icon.color, // Icon color
        paperStyle: paperStyle, // Paper style
    };
}
