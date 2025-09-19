import React, { useState, useEffect } from 'react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '90%',
  maxHeight: '90%',
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  overflow: 'auto',
};

export function ModalMenu({ children, onCloseRequest, onConfirm }) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");


  const handleClose = async () => {
    onConfirm?.(false);
    if (!onConfirm) {
      onCloseRequest?.();
    } else {
      setConfirmMessage("Are you sure you want to close without saving?");
      setConfirmDialogOpen(true);
      onConfirm?.(false);
    }
  };

  const handleConfirmClose = () => {
    setConfirmDialogOpen(false);
    onCloseRequest?.();
  };

  const handleOnConfirm = (confirmed) => {
    onConfirm(confirmed);
    onCloseRequest?.();
  }

  return (
    <div>
      <Modal
        open={true}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <IconButton 
            aria-label="close" 
            onClick={handleClose} 
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
          {children}

          {onConfirm && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
              <Button onClick={() => handleOnConfirm(false)} variant='outlined' sx={{margin:1}} >Cancel</Button>
              <Button onClick={() => handleOnConfirm(true)} variant='contained' sx={{margin:1}} autoFocus>Done</Button>
            </Box>
          )}
        </Box>
      </Modal>
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>{"Done?"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>No</Button>
          <Button onClick={handleConfirmClose} autoFocus>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
