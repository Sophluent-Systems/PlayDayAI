import React, { useState, useEffect } from 'react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    TextField,
} from '@mui/material';



export function TextDialog(props) {
  const { shown, label, currentText, onNewText, ...otherProps } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [text, setText] = useState("");
  
  useEffect(() => {
    if (shown) {
        setText(currentText);
        setDialogOpen(true);
    } else {
        setDialogOpen(false);
    }
  }, [shown]);


  function handleDone(OKselected) {
    if (dialogOpen) {
      onNewText(OKselected ? text : currentText);
      setDialogOpen(false);
    }
  }
  
  return (
    <Dialog open={dialogOpen} onClose={() => handleDone(false)} {...otherProps}>
        <DialogTitle>{label}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="textField"
            label={label}
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDone(false)}>Cancel</Button>
          <Button onClick={() => handleDone(true)}>Save</Button>
        </DialogActions>
    </Dialog>
  );
}
