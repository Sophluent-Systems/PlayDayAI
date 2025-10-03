"use client";

import React, { useEffect, useState } from "react";
import ChatBotView from "@src/client/components/chatbotview";
import { defaultAppTheme } from "@src/common/theme";

export function ThemePreview({ gameInfo, previewMessages = [], theme: themeProp }) {
  const [theme, setTheme] = useState(themeProp ?? null);

  useEffect(() => {
    if (gameInfo?.theme) {
      setTheme(gameInfo.theme);
    }
  }, [gameInfo]);

  const themeToUse = theme ?? defaultAppTheme;

  const handleCardActionSelected = async () => {
    return undefined;
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl">
      <h3 className="text-lg font-semibold text-emphasis">Preview</h3>
      <div className="mt-4">
        <ChatBotView
          messages={previewMessages}
          theme={themeToUse}
          title={gameInfo?.title}
          onCardActionSelected={handleCardActionSelected}
          responseFeedbackMode={{ user: "readonly", admin: "edit" }}
          editMode
        />
      </div>
    </div>
  );
}

export default ThemePreview;
