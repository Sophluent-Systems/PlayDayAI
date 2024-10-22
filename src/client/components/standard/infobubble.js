import { Paper, Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: '80%',
    maxWidth: '800px',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    boxShadow: '0 3px 5px rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: "center",
  },
}));


export function InfoBubble(props) {
  const { classes } = useStyles();
  const { children } = props;

  return (
    <Paper className={classes.paper} >
      <Box
        color="text.primary"
        display="flex"
        alignItems="center"
        width="100%"
      >
        {children}
      </Box>
    </Paper>);
}

