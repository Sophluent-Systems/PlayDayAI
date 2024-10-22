export const primaryPalette = {
  "Deep Space Blue": "#0D1117", // Background color
  "Cool Gray": "#A0AEC0", // Light text
  "Teal": "#4FD1C5", // User messages
  "Amber": "#F6E05E", // Default button color
  "Dark Orange": "#FF8C00", // Hover color for buttons and debug messages
  "Crimson": "#E53E3E", // Error color
  "Dark Slate Gray": "#2D3748", // Dark gray
  "Slate Gray": "#4A5568", // Medium gray
  "Gray": "#CBD5E0", // Light gray
  "White Smoke": "#F7FAFC", // Off white
  "Muted Gray": "#718096", // Disabled text
  "Bright Blue": "#1DA1F2", // Active states
  "Light Teal": "#B2F5EA", // Button hover states
  "Light Amber": "#FAF089", // Original light amber for other uses
  "Dark Teal": "#388B8C", // Darker teal for contrast
  "Dark Gray": "#4A4A4A", // Darker gray for text contrast
};

export const defaultAppTheme = {
  colors: {
    titleBackgroundColor: primaryPalette["Slate Gray"],
    titleFontColor: primaryPalette["White Smoke"],
    menuButtonColor: primaryPalette["White Smoke"],
    chatbotMessageBackgroundColor: primaryPalette["Cool Gray"],
    chatbotMessageTextColor: primaryPalette["Dark Teal"], // Changed for better contrast
    userMessageBackgroundColor: primaryPalette["Teal"],
    userMessageTextColor: primaryPalette["White Smoke"], // Changed to a lighter color for better contrast
    debugMessageBackgroundColor: primaryPalette["Dark Orange"],
    debugMessageTextColor: primaryPalette["White Smoke"], // Changed to ensure high contrast
    messagesAreaBackgroundColor: primaryPalette["Dark Slate Gray"],
    inputAreaBackgroundColor: primaryPalette["Deep Space Blue"],
    inputAreaTextEntryBackgroundColor: primaryPalette["Dark Gray"],
    inputTextEnabledColor: primaryPalette["White Smoke"], // Changed for better contrast
    inputTextDisabledColor: primaryPalette["Muted Gray"],
    inputAreaInformationTextColor: primaryPalette["Slate Gray"],
    sendMessageButtonInactiveColor: primaryPalette["Amber"],
    sendMessageButtonActiveColor: primaryPalette["Dark Orange"],
    sendMessageButtonActiveHoverColor: primaryPalette["Slate Gray"],
    suggestionsButtonColor: primaryPalette["Slate Gray"],
    suggestionsButtonTextColor: primaryPalette["White Smoke"],
    suggestionsButtonHoverColor: primaryPalette["Gray"],
    suggestionsButtonHoverTextColor: primaryPalette["Deep Space Blue"],
  },
  fonts: {
    titleFont: "Roboto, sans-serif",
    fontFamily: 'Roboto, sans-serif',
  },
};