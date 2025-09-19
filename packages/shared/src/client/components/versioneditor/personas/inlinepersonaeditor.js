import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Typography,
    Tooltip,
} from '@mui/material';
import { PersonaEditor } from './personaeditor';
import {
    Cancel,
    Save
} from '@mui/icons-material';

export function InlinePersonaEditor(props) {
    const { theme, persona, onChange, onCancel, onSave, readOnly } = props;
    const [currentPersona, setCurrentPersona] = useState(persona);

    useEffect(() => {
        if (persona != currentPersona) {
            setCurrentPersona(persona);
        }
    }, [persona]);



    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
        }}>
            
            <Box sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'center',
                width: '100%',
                padding: 1,
            }}>
                <Typography variant="h6" sx={{width: '100%'}}>Persona</Typography>
            
                <Tooltip title="Discard Changes">
                    <Button
                        variant={"outlined"}
                        onClick={onCancel}
                        startIcon={<Cancel />}
                        aria-label="discard"
                    >
                        Discard
                    </Button>
                </Tooltip>
                <Tooltip title="Save">
                    <Button
                        onClick={() => onSave(currentPersona)}
                        startIcon={<Save />}
                        aria-label="save"
                        color="primary"
                        variant="contained" // Optional: Gives the button a more pronounced look
                        sx={{marginLeft: 1}}
                    >
                        Save
                    </Button>
                </Tooltip>
            </Box>

            <PersonaEditor theme={theme} persona={currentPersona} onChange={onChange} readOnly={readOnly} />

        </Box>
    );
}