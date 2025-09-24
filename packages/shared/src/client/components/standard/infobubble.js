'use client';

import { Paper, Box } from '@mui/material';

export function InfoBubble(props) {
  const { children } = props;

  return (
    <Paper
      sx={{
        width: '80%',
        maxWidth: '800px',
        padding: 2,
        marginBottom: 2,
        backgroundColor: 'background.paper',
        boxShadow: '0 3px 5px rgba(0, 0, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
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

