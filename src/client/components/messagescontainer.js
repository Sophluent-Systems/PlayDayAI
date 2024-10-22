import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Typography,
 } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import Title from './standard/title';

const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
  } = pageTheme;
  return ({
    contentContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flexGrow: 1,
      overflowY: 'auto',
      paddingBottom: '30px',
      backgroundColor: colors.messagesAreaBackgroundColor,
      position: 'relative',
    },
  });
});


export function MessagesContainer(props) {
  const {
    theme, 
    title,
    footer,
    children
  } = props;
  const { classes } = useStyles(theme);

  return (
    <Box style={{ 
      height: '100%',  
      overflow:"hidden",
      display: 'flex', 
      flexDirection: 'column', 
      position: 'relative' }}>
      <Box flexGrow={1} overflow="hidden" display="flex" flexDirection="column" justifyContent="flex-end"
              >
            <Box
              className={classes.contentContainer}
              display="fixed"
              flexDirection="column"
              alignItems="center"
              flexGrow={1}
            >
              <Title theme={theme} title={title} mb={4} mt={0} paddingTop={2} paddingBottom={2} />
              
              {children}

              <Typography sx={{ alignSelf: 'flex-end',  marginRight: 5, color: theme.colors.inputTextDisabledColor}}>{footer}</Typography>
            </Box>
      </Box>
    </Box>
  );
};