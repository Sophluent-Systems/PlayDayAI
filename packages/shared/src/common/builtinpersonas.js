import { defaultAppTheme } from "@src/common/theme";

export const BuiltInPersonas = [
    {
        personaID: "builtInAssistant",
        displayName: "Assistant",
        identity: "An assistant that follows the instructions provided.",
        hideFromEndUsers: false,
        theme: {
            colors: {
                messageBackgroundColor: defaultAppTheme.colors.chatbotMessageBackgroundColor,
                messageTextColor: defaultAppTheme.colors.chatbotMessageTextColor,
                audioVisualizationColor: defaultAppTheme.colors.chatbotMessageTextColor,
                buttonColor: defaultAppTheme.colors.chatbotMessageBackgroundColor,
            },
            fonts: {
                fontFamily: 'Roboto, sans-serif',
            },
            icon: {
                iconID: "Psychology",
                color: defaultAppTheme.colors.chatbotMessageTextColor,
            },
        },
    },    
    {
        personaID: "builtInUserInput",
        displayName: "Human",
        identity: "The human interacting with the system",
        hideFromEndUsers: false,
        theme: {
            colors: {
                messageBackgroundColor: defaultAppTheme.colors.userMessageBackgroundColor,
                messageTextColor: defaultAppTheme.colors.userMessageTextColor,
                audioVisualizationColor: defaultAppTheme.colors.userMessageTextColor,
                buttonColor: defaultAppTheme.colors.userMessageBackgroundColor, // Changed for better visibility
            },
            fonts: {
                fontFamily: 'Roboto, sans-serif',
            },
            icon: {
                iconID: "RunCircle",
                color: defaultAppTheme.colors.userMessageTextColor,
            },
        },
    },    
    {
        personaID: "builtInDebug",
        displayName: "Debug (internal)",
        identity: "An assistant that follows the instructions provided.",
        hideFromEndUsers: true,
        theme: {
            colors: {
                messageBackgroundColor: defaultAppTheme.colors.debugMessageBackgroundColor,
                messageTextColor: defaultAppTheme.colors.debugMessageTextColor,
                audioVisualizationColor: defaultAppTheme.colors.debugMessageTextColor,
                buttonColor: defaultAppTheme.colors.chatbotMessageBackgroundColor,
            },
            fonts: {
                fontFamily: 'Roboto, sans-serif',
            },
            icon: {
                iconID: "Handyman",
                color: defaultAppTheme.colors.debugMessageTextColor,
            },
        },
    }
];
