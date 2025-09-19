import React, { useEffect, useState } from 'react';
import {
    Box, 
    Typography,
    Grid,
} from '@mui/material';
import { IconChooser } from './iconchooser';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getNestedObjectProperty, setNestedObjectProperty } from '@src/common/objects';
import { FontChooser } from '@src/client/components/standard/fontchooser';
import { PersonaPreview } from './personapreview';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { ColorChooser } from './colorchooser';
import { defaultAppTheme } from '@src/common/theme';

const menu = [
    {
        label: "Persona",
        type: "fieldlist",
        fields: [
            {
                label: "Display Name",
                type: "text",
                path: "displayName",
                defaultValue: "AI",
                tooltip: "The display name of the persona",
            },
            {
                label: "Identity (who is this persona's in a nutshell?)",
                type: "text",
                path: "identity",
                maxLength: 2096,
                defaultValue: "AI",
                tooltip: "The display name of the persona",
            },
            {
                label: "Hide from end-users (shown to editors only)",
                type: "checkbox",
                path: "hideFromEndUsers",
                defaultValue: false,
                tooltip: "Display only to editors, not end-users",
            },
        ]
    }
]

const colorsToEdit = [
    {
        label: "Message Background",
        path: "theme.colors.messageBackgroundColor",
    },
    {
        label: "Message Text",
        path: "theme.colors.messageTextColor",
    },
    {
        label: "Icon Color",
        path: "theme.icon.color",
    },
    {
        label: "Button Color",
        path: "theme.colors.buttonColor",
    },
    {
        label: "Audio Color",
        path: "theme.colors.audioVisualizationColor",
    },
];


//
// Edits an individual persona which could
// come from multiple places -- could be 
// used by persona manger, or as a quick
// edit for an individual node
//
export function PersonaEditor(props) {
    const { theme, persona, mediaTypes, onChange, readOnly } = props;
    const [localCopy, setLocalCopy] = useState(persona);

    useEffect(() => {
        setLocalCopy(persona);
    }, [persona]);

    const onVariableChanged = (rootObject, field, value) => {
        if (nullUndefinedOrEmpty(localCopy)) {
            throw new Error("PersonaEditor: onVariableChanged: localCopy is null");
        }
        
        setLocalCopy((prev) => {
            let newObject = {...prev}
            setNestedObjectProperty(newObject, field, value);
            return newObject;
        });
        onChange?.(rootObject, field, value);
    }

    if (nullUndefinedOrEmpty(persona)) {
        return null;
    }

    return (
        <Box>
            
            <SettingsMenu
                  menu={menu}
                  rootObject={persona}
                  onChange={onVariableChanged}
                  readOnly={readOnly}
              />
            <Typography variant="subtitle1">Font</Typography>
            <FontChooser
                    value={persona.theme.fonts.fontFamily}
                    defaultValue={defaultAppTheme.fonts.fontFamily}
					onChange={(nextFont) => onVariableChanged(persona, "theme.fonts.fontFamily", nextFont)}
                    readOnly={readOnly}
				/>
            <Typography variant="subtitle1">Icon</Typography>
            <IconChooser
                value={persona.theme.icon.iconID}
                defaultValue={"Person"}
                onChange={(newValue) => onVariableChanged(persona, 'theme.icon.iconID', newValue)}
                readOnly={readOnly}
            />
            
            <Grid container spacing={1} sx={{ border: 1, borderColor: 'black', borderRadius: 1, marginTop: 1, marginBottom: 1 }}>
                {colorsToEdit.map(colorVar => (
                    <Grid item xs={4} key={colorVar.path} sx={{ padding:1 }}>
                        <ColorChooser key={colorVar.path} label={colorVar.label} value={getNestedObjectProperty(persona, colorVar.path)} onChange={(newValue) => onVariableChanged(persona, colorVar.path, newValue)} readOnly={readOnly} />
                    </Grid>
                    ))}
            </Grid>

            <Typography variant="subtitle1">Preview</Typography>
            <Box sx={{ 
                display: "flex",
                flexGrow: 1,
                border: 1,
                borderColor: 'black', 
                borderRadius: 1, 
                padding: 1, 
                marginBottom: 2,
                justifyContent: 'center',
            }}
            >
                <PersonaPreview 
                    theme={theme}
                    persona={localCopy} 
                    mediaTypes={mediaTypes}
                    extended={true }
                />
            </Box>
        </Box>
    );
}