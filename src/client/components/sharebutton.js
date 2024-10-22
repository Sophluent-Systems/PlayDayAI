import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  IconButton, 
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogTitle, 
  Typography, 
  Avatar,
  Tooltip,
  DialogContentText,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send'; // Use the "paper airplane" icon
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'; // Use the down-carat icon
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditNoteIcon from '@mui/icons-material/EditNote';
import PreviewIcon from '@mui/icons-material/Preview';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { PermissionsEditor } from './permissionseditor';
import { useConfig } from '@src/client/configprovider';
import { callGetGamePermissionsForEditing } from '@src/client/permissions';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const iconSize = 30;

const getIcon = (key) => {
  switch (key) {
    case 'edit':
      return <Avatar sx={{ width: iconSize, height: iconSize, bgcolor: 'primary.main', margin: 0.5 }}>
                <EditNoteIcon fontSize="small"  />
            </Avatar>;
    case 'viewSource':
      return <Avatar sx={{ width: iconSize, height: iconSize, bgcolor: 'secondary.main', margin: 0.5 }}>
                <PreviewIcon fontSize="small" />
            </Avatar>;
    case 'play':
      return <Avatar sx={{ width: iconSize, height: iconSize, bgcolor: 'success.main', margin: 0.5 }}>
                <PlayArrowIcon fontSize="small"  />
             </Avatar>;
    default:
      return null;
  }
};

export const ShareButton = (props) => {
  const { Constants } = useConfig();
  const { gameID } = props;
  const [open, setOpen] = useState(false);
  const [sharingStatus, setSharingStatus] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [permissions, setPermissions] = useState(null);
  const [startingPermissions, setStartingPermissions] = useState(null);

  const countAccountsWithRole = (accountPermissions, role) => {
    if (nullUndefinedOrEmpty(accountPermissions)) {
      return 0;
    }
    const accounts = Object.keys(accountPermissions);
    let count = 0;
    for (let i = 0; i < accounts.length; i++) {
      if (accountPermissions[accounts[i]].roles.includes(role)) {
        count++;
      }
    }

    return count;
  }

  function getGroupSharingString(roles, postfix) {

    // base it on the most permissive role
    for (let i=Constants.userRoles.length-1; i>=0; i--) {
      const role = Constants.userRoles[i];
      if (roles.includes(role)) {
          return Constants.userRoleDisplayNames[role] + postfix;
      }
    }

    return "No group " + postfix;
  }

  function updateSharingStatus(newPermissions) {
    let newSharingStatus = {
      edit: '',
      viewSource: '',
      play: '',
    };
    // Count specific users with editor role
    const editorCount = countAccountsWithRole(newPermissions.accounts, 'game_editor') +
                          countAccountsWithRole(newPermissions.accounts, 'game_owner');
    const sourceViewerCount = editorCount + 
                          countAccountsWithRole(newPermissions.accounts, 'game_sourceViewer');
    const playerCount = sourceViewerCount + 
                          countAccountsWithRole(newPermissions.accounts, 'game_player');

    if (!nullUndefinedOrEmpty(newPermissions.groups.roles?.game_player)) {
      newSharingStatus.play = getGroupSharingString(newPermissions.groups.roles.game_player, " can play")
    } else {
      // Count specific users with player role
      newSharingStatus.play = `${playerCount} allowed to play`;
    }

    if (!nullUndefinedOrEmpty(newPermissions.groups.roles?.game_sourceViewer)) {
      newSharingStatus.viewSource = getGroupSharingString(newPermissions.groups.roles.game_sourceViewer, " can view source")
    } else {
      // Count specific users with source viewer role
      newSharingStatus.viewSource = `${sourceViewerCount} allowed to view source`
    }

    if (!nullUndefinedOrEmpty(newPermissions.groups.roles?.game_editor)) {
      newSharingStatus.edit = getGroupSharingString(newPermissions.groups.roles.game_editor, " can edit")
    } else {
      newSharingStatus.edit = `${editorCount} allowed to edit`;
    }

    setSharingStatus(newSharingStatus);
  }

  useEffect(() => {
    async function getPermissions() {
      try {
        const newPermissions = await callGetGamePermissionsForEditing(gameID);
        if (newPermissions) {
          setStartingPermissions(newPermissions);
          setPermissions(newPermissions);
          updateSharingStatus(newPermissions);
        }
      } catch (error) {
        // This can happen during a reload when this is still running asynchronously
        // so we can just ignore it
      }
    }

    if (gameID) {
      getPermissions();
    }
  }, [gameID]);

  const handlePermissionsChange = (newPermissions) => {
    updateSharingStatus(newPermissions);
    setPermissions(newPermissions);
  }


  const handleClose = () => {
    setOpen(false);
  };

  const handleExpand = () => setExpanded(!expanded);

  if (!sharingStatus) {
    return null;
  }

  return (
    <Box display="flex" sx={{ width: '100%', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', justifyItems: 'flex-start', flexDirection: 'row' }}>
        <IconButton aria-label="expand" onClick={handleExpand}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="body2" sx={{ marginRight: 1 }}>Sharing</Typography>
        <IconButton aria-label="share" onClick={() => setOpen(true)}>
          <SendIcon sx={{ marginLeft: 'auto' }} />
        </IconButton>
      </Box>
      {expanded && (
        <Box sx={{ width: '100%', mt: 1 }}>
          {Object.keys(sharingStatus).map((key) => (
            <Box display="flex" alignItems="center" key={key}>
              {getIcon(key)}
              <Typography variant="body2" sx={{marginLeft: 1, marginRight: 1}}>{sharingStatus[key]}</Typography>
            </Box>
          ))}
        </Box>
      )}
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Share Your Project</DialogTitle>
        <DialogContent>
          <PermissionsEditor 
              gameID={gameID}
              setSharingStatus={setSharingStatus} 
              startingPermissions={startingPermissions} 
              onPermissionsChange={handlePermissionsChange} 
          />
        </DialogContent>
        <DialogActions>
            <Button
                onClick={handleClose}
                aria-label="save"
                color="primary"
                variant="text"
                sx={{marginLeft: 1}}
            >
                Close
            </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};