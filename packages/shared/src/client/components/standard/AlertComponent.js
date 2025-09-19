
import { 
    Dialog, 
    DialogTitle,
    DialogContent, 
    DialogActions,
    DialogContentText,
    Button,
  } from '@mui/material';

export const AlertComponent = ({ title, message, actions, onClose }) => {
  return (
    <Dialog open={true} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {actions.map((action, index) => (
          <Button key={index} onClick={() => { action.onPress(); onClose(); }} color="primary">
            {action.text}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};
