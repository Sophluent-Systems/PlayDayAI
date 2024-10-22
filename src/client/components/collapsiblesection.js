import React from 'react';
import {
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export function CollapsibleSection({ title, collapsedView, children, defaultExpanded }) {
  return (
    <Paper elevation={3} style={{ borderRadius: '8px', margin: '10px 0', width:'98%' }}>
      <Accordion defaultExpanded={defaultExpanded} >
        <AccordionSummary
          expandicon={<ExpandMore />}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', alignContent: 'flex-start', justifyContent: 'flex-start' }} >
            {title ? <Typography>{title}</Typography> : <React.Fragment />}
            {collapsedView ? collapsedView : <React.Fragment />}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {children}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}


