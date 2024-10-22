import React, { useState, useEffect } from 'react';
import {
    Box,
    Grid,
    Typography,
} from '@mui/material';
import { MuiColorInput } from 'mui-color-input';


export function ColorChooser(props) {
    const { label, value, defaultValue, onChange, readOnly } = props;
    const [currentValue, setCurrentValue] = useState(value);

    useEffect(() => {
        if (value != currentValue) {
            if (value == null) {
                setCurrentValue(defaultValue);
            } else {
                setCurrentValue(value);
            }
        }
    }, [value]);


    const handleValueChanged = (newValue) => {
        setCurrentValue(newValue);
        onChange?.(newValue);
    };

    if (typeof currentValue == 'undefined') {
        return null;
    }

    return (
        <Box>
              <Box sx={{marginBottom: 2}}>
                <Typography variant="subtitle1">{label}</Typography>
                <MuiColorInput
                  value={value}
                  onChange={(newValue) => handleValueChanged(newValue)}
                  disabled={readOnly}
                  format={'hex8'}
                />
              </Box>
        </Box>
    );
}

