import React, { useState, memo } from 'react';
import { 
  IconButton,
 } from "@mui/material";
import { useRouter } from 'next/router';
import { Settings } from '@mui/icons-material';
import { stateManager } from '@src/client/statemanager';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown';

function GameMenu(props) {
  const router = useRouter();
  const { theme, allowEditOptions, includePlayOption } = props;
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


    return (
    <React.Fragment>
        <GameMenuDropdown
            onMenuClose={() => handleMenuClose()}
            anchor={anchorEl}
            gameUrl={game?.url}
            gameID={game?.gameID}
            allowEditOptions={allowEditOptions}
            includePlayOption={includePlayOption}
        />


        <IconButton
          edge="end" 
          aria-label="menu" 
          onClick={(event) => handleButtonClick(event)}
          sx={{ position: 'absolute', top: 15, right: 25, zIndex: 1200, color: theme.colors.menuButtonColor }}
          >
            <Settings />
        </IconButton>
    </React.Fragment>
    );
}

export default memo(GameMenu);




