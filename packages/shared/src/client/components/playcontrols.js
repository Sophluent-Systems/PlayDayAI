import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton, 
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
 } from '@mui/material';
 import PlayArrowIcon from '@mui/icons-material/PlayArrow';
 import PauseIcon from '@mui/icons-material/Pause';
 import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useAtom } from 'jotai';
import { editorSaveRequestState, dirtyEditorState } from '@src/client/states';
import { nullUndefinedOrEmpty } from '@src/common/objects';

export function PlayControls(props) {
  const { isRunning, onRequestStateChange, sessionID } = props;
  const [editorSaveRequest, setEditorSaveRequest] = useAtom(editorSaveRequestState);
  const [dirtyEditor, setDirtyEditor] = useAtom(dirtyEditorState);
  const [waitingForPlay, setWaitingForPlay] = useState(false);
  const [waitingForPause, setWaitingForPause] = useState(false);
  const [waitingForRestart, setWaitingForRestart] = useState(false);
  const [openConfirmModal, setOpenConfirmModal] = useState(false);
  const lastSessionRef = useRef(null);

  useEffect(() => {
    if (editorSaveRequest === "saved") {
      setEditorSaveRequest(null);

      if (!dirtyEditor) {
        onRequestStateChange('play');
      }
    }
  }, [editorSaveRequest]);

  useEffect(() => {
    if (waitingForPlay && isRunning) {
      setWaitingForPlay(false);
    }
    if (waitingForPause && !isRunning) {
      setWaitingForPause(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (waitingForRestart && sessionID !== lastSessionRef.current && !nullUndefinedOrEmpty(sessionID)) {
      setWaitingForRestart(false);
    }
  }, [sessionID]);

  const handlePlayButton = (event) => {

    if (dirtyEditor) {
      setEditorSaveRequest('save');
    } else {
      onRequestStateChange('play');
      setWaitingForPlay(true);
    }
  }

  const handlePauseButton = (event) => {
    onRequestStateChange('pause');
    setWaitingForPause(true);
  }
  
  const handleRestart = async () => {
    setOpenConfirmModal(false);
    lastSessionRef.current = sessionID;
    onRequestStateChange('restart');
    setWaitingForRestart(true);
  }

  const showPlay = !isRunning || dirtyEditor;
  const isDisabled = waitingForPlay || waitingForPause || waitingForRestart;

  return (
    <Paper sx={{
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      bgcolor: 'background.paper',
      // center-align
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '5px',
      height: '40px',
      boxShadow: 3,
      p: 1,
      backgroundColor: isDisabled ? 'grey.300' : 'grey.100',
      pointerEvents: isDisabled ? 'none' : 'auto',  // Disable pointer events when disabled
      borderRadius: '15px',
    }}>
      <IconButton
        color="primary"
        onClick={() => setOpenConfirmModal(true)}
        aria-label="restart"
        disabled={isDisabled}
      >
        <RestartAltIcon />
      </IconButton>
      {showPlay ? (
        <IconButton
          color="primary"
          onClick={handlePlayButton}
          aria-label="play"
          disabled={isDisabled}
        >
          <PlayArrowIcon />
        </IconButton>
      ) : (
        <IconButton
          color="primary"
          onClick={handlePauseButton}
          aria-label="pause"
          disabled={isDisabled}
        >
          <PauseIcon />
        </IconButton>
      )}
      <Typography variant="caption" sx={{ ml: 2 }}>
        {isRunning ? 'Running' : 'Paused'}
      </Typography>
      
      <Dialog
      open={openConfirmModal}
      onClose={() => setOpenConfirmModal(false)}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      >
          <DialogTitle id="alert-dialog-title">{"Delete Session"}</DialogTitle>
          <DialogContent>
          <DialogContentText id="alert-dialog-description">
              Are you sure you want to delete your session? There is no way to get it back.
          </DialogContentText>
          </DialogContent>
          <DialogActions>
          <Button onClick={() => setOpenConfirmModal(false)} color="primary">
              Cancel
          </Button>
          <Button onClick={handleRestart} color="primary" autoFocus>
              Confirm
          </Button>

          </DialogActions>
      </Dialog>
    </Paper>
  );
}