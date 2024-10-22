import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Popover,
    IconButton,
    Grid,
} from '@mui/material';
import { PersonaIcons } from './icons';
import { nullUndefinedOrEmpty } from '@src/common/objects';



const squareIconStyle = {
    width: 56, // Set a fixed width for the square
    height: 56, // Set the same fixed height to make it a square
    display: 'flex', // Use flex to center the icon inside
    justifyContent: 'center', // Center horizontally
    alignItems: 'center', // Center vertically
};

export function IconChooser(props) {
    const { value, defaultValue, onChange, readOnly } = props;
    const [anchorEl, setAnchorEl] = useState(null);
    const [currentValue, setCurrentValue] = useState(null);

    useEffect(() => {
        if (value !== currentValue) {
            if (nullUndefinedOrEmpty(value)) {
                setCurrentValue(defaultValue || "Person");
            } else {
                setCurrentValue(value);
            }
        }
    }, [value]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleValueChanged = (icon) => {
        if (readOnly) {
            return;
        }
        setCurrentValue(icon); // Fixed from setCurrentIcon
        handleClose();
        onChange?.(icon);
    };

    const open = Boolean(anchorEl);
    const id = open ? 'icon-popover' : undefined;

    if (typeof currentValue == 'undefined') {
        return null;
    }

    if (currentValue == null || typeof currentValue === 'undefined') {
        return null;
    }

    const PersonaIcon = PersonaIcons[currentValue];

    return (
        <Box sx={{marginTop: 1, marginBottom: 1}}>
            <IconButton 
                    aria-describedby={id} 
                    variant="outlined" 
                    onClick={handleClick} 
                    sx={{ width: 50, height: 50, border: 1, borderColor: 'black', borderRadius: 1 }}
                    disabled={readOnly}
            >
                {PersonaIcon && <PersonaIcon  />}
            </IconButton>
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
                <Box sx={{ p: 2 }}>
                    <Grid container spacing={1}>
                        {Object.keys(PersonaIcons).map((key) => {
                            // Determine if the current icon is selected
                            const isSelected = currentValue === key;
                            const ThisIcon = PersonaIcons[key];

                            return (
                                <Grid item xs={1.5} key={key} sx={{ balignContent: 'center', justifyContent: 'center' }}>
                                    <Box sx={{
                                        ...squareIconStyle,
                                        border: isSelected ? '2px solid teal' : '1px solid transparent',
                                        borderRadius: '4px',
                                        '&:hover': {
                                            borderColor: 'rgba(0, 128, 128, 0.5)', // Adjust as per your theme or preference
                                        },
                                    }}>
                                        <IconButton onClick={() => handleValueChanged(key)} sx={{ width: '100%', height: '100%' }} disabled={readOnly}>
                                            <ThisIcon />
                                        </IconButton>
                                    </Box>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>

            </Popover>
        </Box>
    );
}