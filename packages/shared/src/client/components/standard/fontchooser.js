import React, { useEffect, useState } from 'react';
import { Button, Box, Typography, Popover, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const fonts = [
    { label: 'Abril Fatface', value: 'Abril Fatface, cursive' },
    { label: 'Archivo Black', value: 'Archivo Black, sans-serif' },
    { label: 'Bangers', value: 'Bangers, cursive' },
    { label: 'Barlow', value: 'Barlow, sans-serif' },
    { label: 'Cabin', value: 'Cabin, sans-serif' },
    { label: 'Dancing Script', value: 'Dancing Script, cursive' },
    { label: 'Exo 2', value: 'Exo 2, sans-serif' },
    { label: 'Fira Sans', value: 'Fira Sans, sans-serif' },
    { label: 'Gloria Hallelujah', value: 'Gloria Hallelujah, cursive' },
    { label: 'Indie Flower', value: 'Indie Flower, cursive' },
    { label: 'Josefin Slab', value: 'Josefin Slab, serif' },
    { label: 'Kanit', value: 'Kanit, sans-serif' },
    { label: 'Lato', value: 'Lato, sans-serif' },
    { label: 'Lobster', value: 'Lobster, cursive' },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'Montserrat', value: 'Montserrat, sans-serif' },
    { label: 'Nunito', value: 'Nunito, sans-serif' },
    { label: 'Open Sans', value: 'Open Sans, sans-serif' },
    { label: 'Oswald', value: 'Oswald, sans-serif' },
    { label: 'Pacifico', value: 'Pacifico, cursive' },
    { label: 'Playfair Display', value: 'Playfair Display, serif' },
    { label: 'Quicksand', value: 'Quicksand, sans-serif' },
    { label: 'Raleway', value: 'Raleway, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Sacramento', value: '"acramento, cursive' },
    { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
    { label: 'Tangerine', value: 'Tangerine, cursive' },
    { label: 'Ubuntu', value: 'Ubuntu, sans-serif' },
    { label: 'Varela Round', value: 'Varela Round, sans-serif' },
    { label: 'Work Sans', value: 'Work Sans, sans-serif' },
    { label: 'Zilla Slab', value: 'Zilla Slab, serif' },
];

export function FontChooser(params) {
  const { value, defaultValue, onChange, readOnly } = params;
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFont, setSelectedFont] = useState(null);

  useEffect(() => {
    if (value != selectedFont) {
        if (!nullUndefinedOrEmpty(value)) {
            const fontOption = fonts.find(font => font.value === value);
            setSelectedFont(fontOption);
        } else {
            const fontOption = fonts.find(font => font.value === defaultValue);
            setSelectedFont(fontOption);
            onChange?.(defaultValue);
        }
    }
  }, [value]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleChange = (event) => {
    const newFontOption = event.target.value;
    onChange?.(newFontOption.value);
    setSelectedFont(newFontOption);
    handleClose();
  };

  const open = Boolean(anchorEl);
  const id = open ? 'font-popover' : undefined;

  if (nullUndefinedOrEmpty(selectedFont)) {
    return null;
  }

  return (
    <Box>
        <Button
        aria-describedby={id}
        variant="outlined"
        onClick={handleClick}
        sx={{ fontFamily: selectedFont.value }} // Apply the selected font to the button
        disabled={readOnly}
        >
            {selectedFont.label}
        </Button>
        <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
            }}
        >
            <Box sx={{ p: 2, minWidth: 120 }}>
              <FormControl fullWidth>
                  <InputLabel id="font-select-label">Font</InputLabel>
                  <Select
                  labelId="font-select-label"
                  id="font-select"
                  value={selectedFont}
                  label="Font"
                  onChange={handleChange}
                  disabled={readOnly}
                  >
                  {fonts.map((font, index) => (
                      <MenuItem key={index} value={font} sx={{ fontFamily: font.value }}>
                      {font.label}
                      </MenuItem>
                  ))}
                  </Select>
              </FormControl>
            </Box>
        </Popover>
    </Box>
  );
}
