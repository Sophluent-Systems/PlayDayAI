import React from 'react';
import { Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';


const useStyles = makeStyles()((theme) => ({
  contentContainer: {
    display: 'flex',
    flexDirection:"column",
    justifyContent: 'flex-start',
    alignItems: "center",
    flex: 1,
    paddingTop: theme.spacing(2),
    backgroundColor: theme.palette.background.main, 
  },
}));


export function StandardContentArea(props) {
  const { classes } = useStyles();
  const { children } = props;
  const [vh, setVh] = useAtom(vhState);

  return (<React.Fragment>
       <Box className={classes.contentContainer} minHeight={`${vh}px`} >
        { children }
      </Box>
      </React.Fragment>
  );
}

