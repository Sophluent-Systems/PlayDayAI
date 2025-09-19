import React, { useState, useEffect, memo } from 'react';
import { 
  Box,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu, 
  MenuItem,
 } from "@mui/material";
import { useRouter } from 'next/router';
import { 
  Refresh, Edit, Palette, Build, Visibility, ModelTraining, 
  PlayArrow, Security, Layers, PlaylistAdd, PlaylistRemove
} from '@mui/icons-material';
import { stateManager } from '@src/client/statemanager';
import { callGetAccountPermissionsForGame } from '@src/client/permissions';
import { callListGameVersions } from '@src/client/editor';
import { ShareButton } from '@src/client/components/sharebutton';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  listItem: {
    position: 'relative',
    '&::before, &::after': {
      content: '""',
      position: 'absolute',
      left: 0,
      right: 0,
      height: '1px',
      backgroundColor: theme.palette.divider,
    },
    '&::before': {
      top: 0,
    },
    '&::after': {
      bottom: 0,
    },
  },
}));

export function GameMenuDropdown(props) {
  const { classes } = useStyles();
  const { 
    gameUrl, 
    gameID, 
    allowEditOptions, 
    includePlayOption, 
    anchor, 
    onMenuClose, 
    onMenuUpdated,
    customMenuItems,
    onToggleFeatured,
    isFeatured
  } = props;
  const { 
    loading, 
    account, 
    game, 
    versionList, 
    gamePermissions,
    switchVersionByName, 
    navigateTo, 
    editMode, 
    hasServicePerms 
  } = React.useContext(stateManager);
  const [versionsAnchorEl, setVersionsAnchorEl] = useState(null);
  const [gamePermissionsToUse, setGamePermissionsToUse] = useState(null);
  const [menuListItems, setMenuListItems] = useState([]);

  const isAdmin = hasServicePerms("service_modifyGlobalPermissions");

  async function getGamePermissionsToUse() {
    const newGamePermissions = await callGetAccountPermissionsForGame(account.accountID, null, gameUrl);
    setGamePermissionsToUse(newGamePermissions);
  }

  useEffect(() => {
    if (gameUrl == game?.url) {
      setGamePermissionsToUse(gamePermissions);
    } else {
      getGamePermissionsToUse();
    }
  }, [gameUrl, game, gamePermissions]);

  useEffect(() => {
    if (!anchor && versionsAnchorEl) {
      setVersionsAnchorEl(null);
    }
  }, [anchor]);

  const handleVersionsMenuClick = (event) => {
    setVersionsAnchorEl(event.currentTarget);
  };

  const handleVersionsMenuClose = () => {
    setVersionsAnchorEl(null);
  };

  const handleSetVersion = async (newVersion) => {
    setVersionsAnchorEl(null);
    onMenuClose();

    const switchingGames = gameUrl != game?.url;
    if (switchingGames) {
      handleNavigation(`/play`);
    }
    switchVersionByName(newVersion, gameID);
  };

  const handleNavigation = (relativePath) => {
    const switchingGames = gameUrl != game?.url;
    navigateTo(relativePath, gameUrl, switchingGames);    
  }

  async function updateMenuListItems() {
    try{
        const newMenuListItems = [];
        if (gamePermissionsToUse) {
            let thisGameVersionList = [];

            if (allowEditOptions && gamePermissionsToUse.includes('game_viewSource')) {
              thisGameVersionList = await callListGameVersions(null, gameUrl, false);
            }

      
            if (allowEditOptions && editMode) {
              if (gamePermissionsToUse.includes('game_modifyPermissions')) {
                newMenuListItems.push(<ListItemButton className={classes.listItem} key="modifyPermissions"> 
                                        <ShareButton gameID={gameID} />
                                      </ListItemButton>);
              }
              if (gamePermissionsToUse.includes('game_edit')) {
                newMenuListItems.push(<ListItemButton className={classes.listItem} onClick={() => handleNavigation('/editdetails')} key='description'>
                <ListItemIcon>
                    <Palette />
                </ListItemIcon>
                <ListItemText primary="Edit Metadata" />
                </ListItemButton>);
              }
              if (gamePermissionsToUse.includes('game_edit') || gamePermissionsToUse.includes('game_viewSource')) {
                newMenuListItems.push(<ListItemButton className={classes.listItem} onClick={() =>  handleNavigation('/editgameversions')} key='gameplay'>
                <ListItemIcon>
                    <Build />
                </ListItemIcon>
                <ListItemText primary="Edit Code" />
                </ListItemButton>);
              }
              if (gamePermissionsToUse.includes('game_viewUsageData')) {
                newMenuListItems.push(<ListItemButton className={classes.listItem} onClick={() =>  handleNavigation('/sessionlist')} key='viewplays'>
              <ListItemIcon>
                  <Visibility />
              </ListItemIcon>
                <ListItemText primary="View Sessions" />
                </ListItemButton>);
              }
              
              if (gamePermissionsToUse.includes('game_viewTrainingData')) {
                newMenuListItems.push(<ListItemButton className={classes.listItem} onClick={() =>  handleNavigation('/trainingdata')} key='trainingdata'>
              <ListItemIcon>
                  <ModelTraining />
              </ListItemIcon>
              <ListItemText primary="Training data" />
              </ListItemButton>);
              }
              if ((gamePermissionsToUse.includes('game_viewSource') || gamePermissionsToUse.includes('game_edit')) && thisGameVersionList && thisGameVersionList.length > 0) {
                newMenuListItems.push(
                      <div key="versions">
                      <MenuItem onClick={(event) => handleVersionsMenuClick(event)}>
                          <ListItemIcon>
                          <Layers />
                          </ListItemIcon>
                          <ListItemText primary="Versions" />
                      </MenuItem>
                      <Menu
                          id="versions-menu"
                          anchorEl={versionsAnchorEl}
                          keepMounted
                          open={Boolean(versionsAnchorEl)}
                          onClose={() => handleVersionsMenuClose()}
                      >
                          {thisGameVersionList?.map((version, index) => (
                          <MenuItem
                              key={index}
                              onClick={() => handleSetVersion(version.versionName)}
                          >
                              {version.versionName}
                          </MenuItem>
                          ))}
                      </Menu>
                      </div>
                  );
              }
              {includePlayOption && gamePermissionsToUse.includes('game_play') && 
                newMenuListItems.push(<ListItemButton className={classes.listItem} onClick={() => handleNavigation(`/play`)} key='play'>
              <ListItemIcon>
                  <PlayArrow />
              </ListItemIcon>
              <ListItemText primary="Play" />
              </ListItemButton>);}

              
              if (isAdmin && onToggleFeatured) {
                newMenuListItems.push(
                  <ListItemButton 
                    className={classes.listItem} 
                    onClick={() => {
                      onToggleFeatured(gameID);
                      onMenuClose();
                    }}
                    key="featured"
                  >
                    <ListItemIcon>
                      {isFeatured ? <PlaylistRemove /> : <PlaylistAdd />}
                    </ListItemIcon>
                    <ListItemText primary={isFeatured ? "Remove from Featured" : "Add to Featured"} />
                  </ListItemButton>
                );
              }
          }
      }

      if (customMenuItems) {
        newMenuListItems.push(...customMenuItems);
      }

      setMenuListItems(newMenuListItems);
      onMenuUpdated?.(newMenuListItems);
    } catch (error) {
      // This can happen during a reload when this is still running asynchronously
      // so we can just ignore it
    }
  }


  useEffect(() => {
    if (!loading) {
      updateMenuListItems();
    }
  }, [loading, gameUrl, versionList, gamePermissionsToUse, includePlayOption, allowEditOptions, editMode, versionsAnchorEl, isAdmin, isFeatured]);

  return (
    <Menu
      id="settings-menu"
      anchorEl={anchor}
      keepMounted
      open={Boolean(anchor)}
      onClose={onMenuClose}
    >
      {menuListItems}
    </Menu>
  );
}

