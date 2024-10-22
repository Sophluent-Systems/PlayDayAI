import React from 'react';
import { 
    Box, 
    Typography,
    FormControl,
    InputLabel,
    OutlinedInput,
} from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { PersonaChooser } from './personas/personachooser';
import { setNestedObjectProperty } from '@src/common/objects';
import { CustomInputControl } from '../standard/custominputcontrol';

const personaLabel = `"Who" is performing this work, and what should the output look like?`;

export function NodeInitMenu(props) {
    const { node, menu, versionInfo, onVariableChanged, onPersonaListChange, gameTheme, readOnly } = props;

    return (
    <Box sx={{ justifyContent: 'center'}}>
        <Box sx={{display: 'flex', flexDirection: 'row', alignContent: 'center', paddingBottom: 2}}>
        <AutoAwesome />
        <Typography variant="h6" sx={{marginLeft: 1}}>Quick settings</Typography>
        </Box>
        <Typography variant="body1" sx={{marginLeft: 1}}>{}</Typography>
        
        <CustomInputControl label={personaLabel}>
            <PersonaChooser
                theme={gameTheme}
                node={node}
                versionInfo={versionInfo}
                onChange={(object, relativePath, newValue) => setNestedObjectProperty(object, relativePath, newValue)}
                onPersonaListChange={onPersonaListChange}
                readOnly={readOnly}
            />
        </CustomInputControl>

        <SettingsMenu
            menu={menu}
            rootObject={node}
            onChange={(object, relativePath, newValue) => setNestedObjectProperty(object, relativePath, newValue)}
            readOnly={readOnly}
            key={"nodeInitMenu"}
        />
    </Box>
    );
}