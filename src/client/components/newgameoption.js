import React, { useState, useEffect, memo } from 'react';
import { makeStyles } from 'tss-react/mui';
import {
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Button,
    Switch,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    TextField,
    FormControlLabel,
    Typography,
    Divider,
} from '@mui/material';
import { defaultAppTheme } from '@src/common/theme';
import { callCreateNewGame } from '@src/client/gameplay';
import { Add } from '@mui/icons-material';
import { useRouter } from 'next/router';

const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
    fonts,
  } = pageTheme;  
  return ({
})});


function NewGameListOption(props) {
  const router = useRouter();
  const { classes } = useStyles(defaultAppTheme);
  const [addGameDialogOpen, setAddGameDialogOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newGameUrl, setNewGameUrl] = useState("");
  

  const handleAddGameDialogOpen = () => {
    setAddGameDialogOpen(true);
  };

  const handleAddGameDialogClose = () => {
    setAddGameDialogOpen(false);
  };

  const handleAddGame = async () => {
    await callCreateNewGame(newGameTitle, newGameUrl);
    handleAddGameDialogClose();
    console.log(`router.push(/editgameversions/${newGameUrl});`)
    router.push(`/editgameversions/${newGameUrl}`);
  };

  const canAddGame = () => {
    return newGameTitle.length > 0 && hasNoUrlParts(newGameUrl);
  };

  const hasNoUrlParts = (url) => {
    const urlPattern = /^(?!.*\/\/)[a-zA-Z0-9-_]+$/;
    return urlPattern.test(url);
  };

  return (
    <React.Fragment>
    <ListItemButton onClick={handleAddGameDialogOpen}>
        <ListItemIcon>
        <Add />
        </ListItemIcon>
        <ListItemText primary="New App" />
    </ListItemButton>
    <Dialog open={addGameDialogOpen} onClose={handleAddGameDialogClose}>
        <DialogTitle>Create New App</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="title"
            label="Title"
            fullWidth
            value={newGameTitle}
            onChange={(e) => setNewGameTitle(e.target.value)}
          />
          <TextField
            margin="dense"
            id="url"
            label="URL"
            fullWidth
            value={newGameUrl}
            onChange={(e) => setNewGameUrl(e.target.value)}
            helperText="No forward slashes or special URL characters"
            error={!hasNoUrlParts(newGameUrl) && newGameUrl.length > 0}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddGameDialogClose}>Cancel</Button>
          <Button onClick={handleAddGame} disabled={!canAddGame()}>
            Add
          </Button>
        </DialogActions>
    </Dialog>
    </React.Fragment>
  );
}

export default memo(NewGameListOption);
