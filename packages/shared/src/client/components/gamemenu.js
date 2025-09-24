'use client';

import React, { useState, memo } from 'react';
import { IconButton } from '@mui/material';
import { Settings } from '@mui/icons-material';
import { stateManager } from '@src/client/statemanager';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown';

function GameMenu({
  theme,
  allowEditOptions = true,
  includePlayOption = true,
  placement = 'floating',
  className,
}) {
  const { game } = React.useContext(stateManager);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const [versionsAnchorEl, setVersionsAnchorEl] = useState(null);

  const handleButtonClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const menuColor = theme?.colors?.menuButtonColor || 'currentColor';
  const iconButtonSx =
    placement === 'inline'
      ? {
          position: 'static',
          color: menuColor,
          padding: 0,
          minWidth: 0,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }
      : {
          position: 'absolute',
          top: 15,
          right: 25,
          zIndex: 1200,
          color: menuColor,
          padding: 0,
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        };

  const inlineClasses = [
    'inline-flex h-11 w-11 items-center justify-center rounded-full',
    'border border-border/70 bg-surface/80 text-emphasis shadow-soft',
    'transition-colors duration-200 hover:border-primary/50',
    'hover:text-primary focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  ].join(' ');

  const floatingClasses = [
    'inline-flex h-11 w-11 items-center justify-center rounded-full',
    'border border-border/70 bg-surface/80 text-muted shadow-soft',
    'transition-colors duration-200 hover:border-primary/50 hover:text-primary',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  ].join(' ');

  const buttonClassName =
    placement === 'inline'
      ? [inlineClasses, className].filter(Boolean).join(' ')
      : [floatingClasses, className].filter(Boolean).join(' ');

  return (
    <>
      <GameMenuDropdown
        onMenuClose={() => handleMenuClose()}
        anchor={anchorEl}
        gameUrl={game?.url}
        gameID={game?.gameID}
        allowEditOptions={allowEditOptions}
        includePlayOption={includePlayOption}
      />

      <IconButton
        edge={placement === 'inline' ? false : 'end'}
        aria-label="Game options"
        onClick={(event) => handleButtonClick(event)}
        sx={iconButtonSx}
        className={buttonClassName}
        disableRipple={placement === 'inline'}
        size={placement === 'inline' ? 'large' : 'medium'}
      >
        <Settings fontSize="small" />
      </IconButton>
    </>
  );
}

export default memo(GameMenu);

