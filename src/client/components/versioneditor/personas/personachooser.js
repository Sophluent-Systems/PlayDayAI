import React, { useEffect, useState, useRef } from 'react';
import {
    Box,
    Popover,
    IconButton,
    Grid,
    Typography,
    Paper,
} from '@mui/material';
import { BuiltInPersonas } from '@src/common/builtinpersonas';
import { PersonaCard } from './personacard';
import { InlinePersonaEditor } from './inlinepersonaeditor';
import { 
    Add,
    Edit,
    KeyboardArrowDown,
 } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { setNestedObjectProperty } from '@src/common/objects';
import { getMetadataForNodeType } from '@src/common/nodeMetadata';

const newOptionPersona = {
    personaID: "new",
    displayName: "Create New",
    theme: {
        colors: {
            messageBackgroundColor: "#ffffff",
            messageTextColor:"#000000",
            audioVisualizationColor: "#000000",
            buttonColor: "#f0f0f0",
        },
        fonts: {
            fontFamily: 'Roboto, sans-serif',
        },
        icon: {
            iconID: "Add",
            color: "#000000",
        },
    },
};

const areaTitles = {
    inline: "Custom to this node",
    builtin: "Built-in",
    version: "Shared (available to any node in this version)",
}


export function PersonaChooser(props) {
    const { theme, versionInfo, node, onChange, onPersonaListChange, onNodeStructureChange, readOnly } = props;
    const [anchorEl, setAnchorEl] = useState(null);
    const [personaOptions, setPersonaOptions] = useState(undefined);
    const [selectedIndex, setSelectedIndex] = useState({ index: undefined, category: undefined });
    const [mode, setMode] = useState("select");
    const selectedRef = useRef(null); // Ref for the selected item
    const editingPersonaRef = useRef(null); // Ref for the editing item


    function updatePersonaOptions(personaLocation) {
        let inlinePersonas = [];
        let builtinPersonas = [];
        let versionPersonas = []; // Assuming version personas are shared

        // always a "new" option
        inlinePersonas.push({
            persona: newOptionPersona,
            source: "new",
        });
        
        if (personaLocation && personaLocation.source === "inline") {
            inlinePersonas.push(personaLocation);
        }

        builtinPersonas = BuiltInPersonas.map(persona => ({
            persona,
            source: "builtin"
        }));
    
        if (versionInfo && versionInfo.personas) {
            versionPersonas = versionInfo.personas.map(persona => ({
                source: "version",
                persona
            }));
        }
    
        setSelectedIndexToLocation(personaLocation, inlinePersonas, builtinPersonas, versionPersonas);

        setPersonaOptions({ inline: inlinePersonas, builtin: builtinPersonas, version: versionPersonas });
    }
    

    useEffect(() => {
        updatePersonaOptions(node.personaLocation);
    }, [versionInfo, node]);

    useEffect(() => {
        if (selectedRef.current) {
            selectedRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
            });
        }
    }, [selectedIndex]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = (doSave) => {
        if (mode === "editpersona" && doSave) {
            savePersona();
        }
        setMode("select");
        setAnchorEl(null);
    };

    function createNewPersona(templatePersona) {
        let newPersona = {
            persona: JSON.parse(JSON.stringify(templatePersona)),
            source: "version",
        }
        newPersona.persona.personaID = uuidv4();
        return newPersona;
    }

    function startEditPersona(personaCopy) {
        editingPersonaRef.current = personaCopy;
        setMode("editpersona");
    }

    const handleSelectionChanged = (option, index, category) => {
        if (option.source === "new") {
            // Need to create a new persona and edit it
            startEditPersona(  createNewPersona(BuiltInPersonas[0])  );
        } else {
            setSelectedIndex({ index, category });
            let newPersonaLocation = {
                source: option.source
            };
            if (option.source === "builtin") {
                newPersonaLocation.personaID = option.persona.personaID;
            } else if (option.source === "inline") {
                newPersonaLocation = JSON.parse(JSON.stringify(option));
            } else if (option.source === "version") {
                newPersonaLocation.personaID = option.persona.personaID;
            }

            onChange?.(node, "personaLocation", newPersonaLocation);
            handleClose();
        }
    };


    const open = Boolean(anchorEl);
    const id = open ? 'popover' : undefined;

    const handleEditCurrentPersonaPressed = (event) => {
        if (selectedIndex.category == "inline" && selectedIndex.index === 0) {
            // Can't edit the "+/New" persona option
            console.log("Can't edit the new persona option");
            return;
        }
        
        const currentPersona = personaOptions[selectedIndex.category][selectedIndex.index];

        if (currentPersona.source === "builtin") {
            
            // Create a new inline persona based on the selected built-in persona
            let newPersona = createNewPersona(currentPersona.persona);
            newPersona.persona.personaID = uuidv4();
            newPersona.source = "inline"; // Ensure the new persona is marked as inline
            startEditPersona( newPersona );

        } else {
            
            startEditPersona( JSON.parse(JSON.stringify(currentPersona)) );        
        }

        setAnchorEl(event.currentTarget);
    };
    
    function setSelectedIndexToLocation(personaLocation, inline, builtin, version) {
        let personaLocationToUse = personaLocation;
        if (!personaLocationToUse) {
            const nodeMetadata = getMetadataForNodeType(node.nodeType);
            const nodeAttributes =  nodeMetadata.nodeAttributes;
            personaLocationToUse = {
                source: "builtin",
                personaID: nodeMetadata.defaultPersona,
            };
            onChange?.(node, "personaLocation", personaLocationToUse);
        }
                  
        if (personaLocationToUse.source === "inline") {
            const index = inline.findIndex((personaLocation) => personaLocation.persona.personaID === personaLocationToUse.persona?.personaID);
            setSelectedIndex({ index, category: "inline" });
        } else if (personaLocationToUse.source === "builtin") {
            const index = builtin.findIndex((persona) => persona.persona.personaID === personaLocationToUse.personaID);
            setSelectedIndex({ index, category: "builtin" });
        } else if (personaLocationToUse.source === "version") {
            const index = version.findIndex((persona) => persona.persona.personaID === personaLocationToUse.personaID);
            setSelectedIndex({ index, category: "version" });
        } else {
            throw new Error("PersonaChooser: setSelectedIndexToLocation: unknown source: " + personaLocationToUse.source);
        }
    }

    function savePersona() {
        const newPersona = editingPersonaRef.current.source == "new";
        if (newPersona) {
            // Save to version
            editingPersonaRef.current.source = "version";
        }
        if (editingPersonaRef.current.source == "version" || newPersona) {
            onPersonaListChange?.(editingPersonaRef.current.persona, "upsert", {});
            onChange?.(node, "personaLocation", {
                source: "version",
                personaID: editingPersonaRef.current.persona.personaID,            
            });
        } else {

            if (!editingPersonaRef.current.source == "inline") {
                throw new Error("savePersona: unexpected source: " + editingPersonaRef.current.source);
            }

            // Save to inline
            onChange?.(node, "personaLocation", editingPersonaRef.current );
        }
        
        onNodeStructureChange?.(node, "visualUpdateNeeded", {});

        editingPersonaRef.current = null;
    }

    const handlePersonaEditSave = () => {
        handleClose(true);
    };

    const handlePersonaEditCancel = () => {
        handleClose(false);
    };

    if (!personaOptions || typeof selectedIndex.index == 'undefined') {
        return null;
    }
    
    function renderItem(option) {
        return (
                <PersonaCard persona={option.persona} />
        );
    }
    
    return (
        <Box sx={{display: 'flex', flexGrow: 1, width: '100%', maxWidth: '1000px'}}>
            <IconButton
                aria-describedby={id}
                variant="contained"
                onClick={handleClick}
                sx={{ flexGrow: 1, p: 0, mr: 1, mt: 0, mb: 0 }}  // Adjust margins and padding as needed
            >
                {renderItem(personaOptions[selectedIndex.category][selectedIndex.index])}
                <KeyboardArrowDown />
            </IconButton>

            <IconButton
                variant="outlined"
                onClick={() => { setAnchorEl(event.currentTarget); startEditPersona(  createNewPersona(BuiltInPersonas[0]) ); }}
                sx={{ mt: 0, mb: 0, ml: 1, mr: 1 }}
                disabled={readOnly}
            >
                <Add />
            </IconButton>

            <IconButton
                variant="outlined"
                onClick={handleEditCurrentPersonaPressed}
                sx={{ mt: 0, mb: 0, ml: 1, mr: 1 }}
            >
                <Edit />
            </IconButton>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={() => handleClose(true)}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                {mode === "select" &&
                    <Box sx={{ p: 1, width: '100%', maxWidth: '1000px', backgroundColor: "#cccccc" }}>
                        {['inline', 'builtin', 'version'].map((category) => (
                            <Box key={category} >
                                <Grid container spacing={0.5} >
                                    {personaOptions[category].map((option, index) => {
                                        const isSelected = selectedIndex.index === index && selectedIndex.category === category;
                                        return (
                                        <Grid item xs={12} key={option.persona.personaID} sx={{
                                            border: isSelected ? '2px solid teal' : '1px solid transparent',
                                            mt: 0.5,
                                            mb: 0.5,
                                            alignContent: 'center',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            '&:hover': {
                                                borderColor: 'rgba(0, 128, 128, 0.5)', // Change as per your theme or preference
                                            },
                                        }} >
                                            <IconButton onClick={() => handleSelectionChanged(option, index, category)} sx={{   
                                                    alignContent: 'center',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    width: '100%', height: '100%', m:0,  pb: 0.5, pt: 0 
                                                }}
                                                disabled={readOnly}
                                            >
                                                {renderItem(option)}
                                            </IconButton>
                                        </Grid>
                                        );
                                    })}
                                </Grid>
                            </Box>
                        ))}
                    </Box>
                }
                {mode == "editpersona" &&
                    <Box sx={{ p: 2 }}>
                        <InlinePersonaEditor 
                            theme={theme}
                            persona={editingPersonaRef.current.persona}
                            onChange={(rootObject, path, value) => {
                                setNestedObjectProperty(editingPersonaRef.current.persona, path, value);
                            }}
                            onCancel={handlePersonaEditCancel}
                            onSave={handlePersonaEditSave}
                            readOnly={readOnly}
                        />
                    </Box>
                }
            </Popover>
        </Box>
    );
}