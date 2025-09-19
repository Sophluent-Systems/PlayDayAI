import React, { useState, useEffect } from 'react';
import { FormControl, InputLabel, OutlinedInput } from '@mui/material';

export const CustomInputControl = ({ label, children }) => {

  return (
    <FormControl sx={{display: 'flex', flexGrow: 1, p:0, m:0}} variant="outlined">
      <InputLabel shrink={true}  htmlFor="custom-input">{label}</InputLabel>
      <OutlinedInput
        id="custom-input"
        label={label}
        inputComponent="div" // Use "div" or another suitable element for your custom content
        notched
        inputProps={{ 
          children: children, // Pass custom control as children
        }}
        sx={{
            '& .MuiOutlinedInput-input': {
                display: 'flex',
                alignItems: 'center', // Adjust vertical alignment
                pt: 3, // Adjust padding to reduce gap at the top and overflow at the bottom
                pb: 3,
            },
        }}
      />
    </FormControl>
  );
};
