"use client";

import React, { memo, useState } from "react";
import { Settings } from "lucide-react";
import { stateManager } from "@src/client/statemanager";
import { GameMenuDropdown } from "@src/client/components/gamemenudropdown-lazy";

function GameMenu({
  theme,
  allowEditOptions = true,
  includePlayOption = true,
  placement = "floating",
  className,
}) {
  const { game } = React.useContext(stateManager);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleButtonClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const buttonBaseClasses = [
    "inline-flex h-11 w-11 items-center justify-center rounded-full",
    "border border-border/70 bg-surface/80 text-muted shadow-soft",
    "transition-colors duration-200 hover:border-primary/50 hover:text-primary",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  ];

  const placementOverrides =
    placement === "inline"
      ? ["relative border-border/60 text-emphasis"]
      : ["absolute top-4 right-6 z-30"];

  const buttonClassName = [...buttonBaseClasses, ...placementOverrides, className]
    .filter(Boolean)
    .join(" ");

  const menuColor = theme?.colors?.menuButtonColor || undefined;

  return (
    <>
      <GameMenuDropdown
        onMenuClose={handleMenuClose}
        anchor={anchorEl}
        gameUrl={game?.url}
        gameID={game?.gameID}
        allowEditOptions={allowEditOptions}
        includePlayOption={includePlayOption}
      />

      <button
        type="button"
        aria-label="Game options"
        onClick={handleButtonClick}
        className={buttonClassName}
        style={menuColor ? { color: menuColor } : undefined}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  );
}

export default memo(GameMenu);
