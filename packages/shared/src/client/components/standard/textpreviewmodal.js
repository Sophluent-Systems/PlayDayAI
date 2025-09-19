import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  IconButton,
  Slide,
  Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => {
  return ({
  text: {
    flex: 1,
    color: 'black',
    whiteSpace: 'pre-wrap',
    direction: 'ltr', 
  },
})});


function TextPreviewModal({ isOpen, text, onClose }) {
  const classes = useStyles();

  // Transition for the modal appearance
  const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
  });

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth={true}
      maxWidth="md" // can be changed to 'sm', 'xs', etc. to fit your needs
      TransitionComponent={Transition}
    >
      <IconButton
        edge="end"
        color="inherit"
        onClick={onClose}
        aria-label="close"
      >
        <Close />
      </IconButton>
      <DialogContent>
        <Typography variant="body1" display="block" className={classes.text}>
        {text.split('\n').map((str, index, array) => 
            index === array.length - 1 ? str : <React.Fragment key={`${index}`}>
                {str}
                <br />
            </React.Fragment>
        )}
        </Typography>
      </DialogContent>
    </Dialog>
  );
  }
  
export default TextPreviewModal;