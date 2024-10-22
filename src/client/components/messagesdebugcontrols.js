import React, { useRef, useEffect, useState, use } from 'react';
import {
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Button,
  TextField,
  IconButton, // Import IconButton for the toggle button
  Collapse, // Import Collapse for smooth expansion and collapse
 } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useConfig } from '@src/client/configprovider';
import { SettingsMenu } from './settingsmenus/settingsmenu';
import { getNestedObjectProperty, setNestedObjectProperty } from '@src/common/objects';
import { stateManager } from '@src/client/statemanager';
import { SkipNext, ExpandMore, ExpandLess, VisibilityOff, Visibility } from '@mui/icons-material';


const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
  } = pageTheme;
  return ({
    switchesContainer: {
      position: 'absolute',
      display: 'flex',
      flexWrap: 'wrap', // Add this
      justifyContent: 'center',
      alignItems: 'center',
      left: '50%',
      transform: 'translateX(-50%)',
      top: '100px',
      padding: 0,
      backgroundColor: colors.inputAreaTextEntryBackgroundColor,
      borderRadius: '15px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(1),
    },
    toggleButton: {
      marginBottom: theme.spacing(1), // Add some space below the toggle button
    },
    label: {
      marginLeft: theme.spacing(1),
      fontSize: '1.0rem', // Small font size for the label
      marginRight: theme.spacing(1), // Align the label to the left
    },
    switch: {
      color: colors.inputAreaTextEntryBackgroundColor,
    },
    switchLabel: {
      color: colors.inputTextEnabledColor,
    },
  });
});

export function MessagesDebugControls(props) {
  const { Constants } = useConfig();
  const {
    theme,
    onDebugSingleStep,
    onToggleSingleStep,
  } = props;
  const { classes } = useStyles(theme);
  const [seedOverrideValueText, setSeedOverrideValueText] = useState(-1);
  const localDebugSettingsRef = useRef(null);
  const { account, updateSignedInAccount } = React.useContext(stateManager);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (account) {
      if (account.preferences?.debugSettings) {
        localDebugSettingsRef.current = JSON.parse(JSON.stringify(account.preferences.debugSettings));
      } else {
        localDebugSettingsRef.current = JSON.parse(JSON.stringify(Constants.defaultDebugSettings));
      }
      localDebugSettingsRef.current.messageFilters = localDebugSettingsRef.current.messageFilters ? [...localDebugSettingsRef.current.messageFilters] : [];
      if (typeof localDebugSettingsRef.current.seedOverrideValue == 'number' && localDebugSettingsRef.current.seedOverrideValue != seedOverrideValueText) {
        setSeedOverrideValueText(localDebugSettingsRef.current.seedOverrideValue);
      }
    }
  }, [account]);

  
  function onVariableChanged(rootObject, path, newValue) {
    const curValue = getNestedObjectProperty(rootObject, path);
    if (curValue !== newValue) {
      const newDebugSettings = { ...localDebugSettingsRef.current };
      if (path === "seedOverrideValue") {
        setSeedOverrideValueText(newValue);
      }

      setNestedObjectProperty(newDebugSettings, path, newValue);

      let newAccount = {...account};
      newAccount.preferences = {...account.preferences};
      newAccount.preferences.debugSettings = newDebugSettings;
      updateSignedInAccount(newAccount);

      localDebugSettingsRef.current = newDebugSettings;

      if (path === "singleStep") {
        onToggleSingleStep && onToggleSingleStep(newValue);
      }
    }
  }

  if (!localDebugSettingsRef.current) {
    return null;
  }

  return (
        <Box className={classes.switchesContainer}>
        <Box className={classes.header}>
          <IconButton
            onClick={() => setShowSettings(!showSettings)}
            size="small"
            aria-label="Show or hide settings"
          >
            {showSettings ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          <Typography className={classes.label} color="textSecondary">
            Debug Settings
          </Typography>
        </Box>
  
        <Collapse in={showSettings}>
          
              <FormControlLabel
                control={
                  <Checkbox
                    checked={localDebugSettingsRef.current.showHidden}
                    onChange={(e) => onVariableChanged(localDebugSettingsRef.current, "showHidden", e.target.checked)}
                    name="showHidden"
                    icon={<VisibilityOff />}
                    checkedIcon={<Visibility />} 
                  />
                }
                label={localDebugSettingsRef.current.showHidden ? "Showing debug messages" : "Hiding debug messages"}
                labelPlacement="end"
                sx={{ 
                  color: theme.colors.inputTextEnabledColor,
                  ml: 1, // Adjust spacing as needed
                  alignItems: "center", // Align checkbox and label vertically
                }}
                disabled={!localDebugSettingsRef.current}
              />
              <FormControlLabel
                key={"singlestepform"}
                control={
                  <Checkbox
                      checked={localDebugSettingsRef.current.singleStep}
                      onChange={(e) => onVariableChanged(localDebugSettingsRef.current, "singleStep", e.target.checked)}
                      name={"singlestep"}
                      key={"singlestep"}
                  />
                }
                sx={{
                  color: theme.colors.inputTextEnabledColor,
                  ml: 1, mr: 1,
                }}
                label={"Single Step"}
                disabled={!localDebugSettingsRef.current}
              />
              {localDebugSettingsRef.current.singleStep &&
              <Button 
                variant="contained" 
                size="small"
                startIcon={<SkipNext />} 
                onClick={() => onDebugSingleStep && onDebugSingleStep()}
                sx={{ 
                  borderRadius: '8px', // Makes the button more square
                  minWidth: 'auto', // Prevents the button from being too wide
                  padding: '8px', // Adjust padding to make the button more square
                  mr: 1,
                }}
              >
                Step
              </Button>}
              
              <FormControlLabel
                key={"seedoverrideform"}
                control={
                  <Checkbox
                      checked={localDebugSettingsRef.current.seedOverrideEnabled}
                      onChange={(e) => onVariableChanged(localDebugSettingsRef.current, "seedOverrideEnabled", e.target.checked)}
                      name={"seedOverrideEnabled"}
                      key={"seedOverrideEnabled"}
                  />
                }
                sx={{
                  color: theme.colors.inputTextEnabledColor,
                  mr: 1,
                }}
                label={"Seed Override"}
                disabled={!localDebugSettingsRef.current}
              />
              {localDebugSettingsRef.current.seedOverrideEnabled &&
              <TextField 
                key={"seedoverridevalue"}
                variant='outlined'
                value={seedOverrideValueText}
                onChange={(e) => {
                  setSeedOverrideValueText(e.target.value);
                  let numVal = -1;
                  try {
                    numVal = parseInt(e.target.value);
                    if (typeof numVal == 'number' && !isNaN(numVal) && numVal != localDebugSettingsRef.current.seedOverrideValue) {
                      console.log("Setting seed override to " + numVal);
                      onVariableChanged(localDebugSettingsRef.current, "seedOverrideValue", numVal);
                    }
                  } catch (e) {
                    // ignore
                  }
                }}
                size="small"
                sx={{
                  minWidth: '20px', // Minimal width to prevent too much space
                  maxWidth: '100px', // Limiting max width for compact appearance
                  fontSize: '0.8rem', // Smaller font size to fit compact design
                  padding: 0, // Reduced padding to decrease overall field height
                  margin: '0px', // No extra space around the field
                  height: 'auto', // Fixed height to make the field shorter
                  lineHeight: 'normal', // Normal line height based on new height
                  mr: 1, // Margin right for spacing if needed
                }}
                disabled={!localDebugSettingsRef.current}
              />}
          </Collapse>
        </Box>
  );
};
