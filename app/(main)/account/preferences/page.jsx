'use client';

import React, { useState, useEffect } from 'react';
import { 
  Button,
  TextField, 
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
 } from '@mui/material';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { stateManager } from '@src/client/statemanager';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { getNestedObjectProperty, setNestedObjectProperty } from '@src/common/objects';
import Title  from '@src/client/components/standard/title';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { useConfig } from '@src/client/configprovider';

export default function Home(props) {
  const { Constants } = useConfig();
  const { loading, account, updateSignedInAccount, editMode } = React.useContext(stateManager);
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    if (account) {
      let newPreferences = {...account.preferences};
      newPreferences.openAIkey = !nullUndefinedOrEmpty(newPreferences.openAIkey, true) ? newPreferences.openAIkey : "";
      newPreferences.anthropicKey = !nullUndefinedOrEmpty(newPreferences.anthropicKey, true) ? newPreferences.anthropicKey : "";
      newPreferences.googleLLMKey = !nullUndefinedOrEmpty(newPreferences.googleLLMKey, true) ? newPreferences.googleLLMKey : "";
      newPreferences.stabilityAIKey = !nullUndefinedOrEmpty(newPreferences.stabilityAIKey, true) ? newPreferences.stabilityAIKey : "";
      newPreferences.elevenLabsKey = !nullUndefinedOrEmpty(newPreferences.elevenLabsKey, true) ? newPreferences.elevenLabsKey : "";
      setPreferences(newPreferences);
    }
  }, [account]);
  
  function updateAccount() {
    let newAccount = {...account};
    newAccount.preferences = preferences;
    updateSignedInAccount(newAccount);
  }

  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
          <InfoBubble>
            {children}
          </InfoBubble>
      </StandardContentArea>
    );
  }
  
  function renderTextPreference(name, path, defaultValue) {
    const value = getNestedObjectProperty(preferences, path);
    return (
        <TextField label={name} value={nullUndefinedOrEmpty(value, true) ? defaultValue : value} sx={{margin:5}} onChange={(event) => {
          let newPreferences = {...preferences}
          setNestedObjectProperty(newPreferences, path, event.target.value);
          setPreferences(newPreferences);
          console.log("updated preferences: ", newPreferences)
        }}  />
    );
  }
  
  function renderDropdownPreference(name, path, options, defaultValue) {
    const value = getNestedObjectProperty(preferences, path);
    return (
      <FormControl variant="filled" fullWidth key={path + "form"}   id={path}>
        <InputLabel >{name}</InputLabel>
        <Select
          value={nullUndefinedOrEmpty(value, true) ? defaultValue : value}
          onChange={(event) => {
            let newPreferences = {...preferences}
            setNestedObjectProperty(newPreferences, path, event.target.value);
            setPreferences(newPreferences);
            console.log("updated preferences: ", newPreferences)
          }}
        >
          {Object.keys(options).map((option) => (
            <MenuItem value={option} key={`${path}-menu-${option}`}>{options[option]}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (<RequireAuthentication>
    <DefaultLayout  title={"Account Preferences"}>
      <StandardContentArea> 
      {(loading || !account || !preferences) ? renderWithFormatting(<h1>Loading...</h1>) 
      : (
          <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 800, flexDirection: 'column', margin: 5 }}>
              {renderTextPreference("Open AI Key", "openAIkey", "")}
              {renderTextPreference("Anthropic (Claude) Key", "anthropicKey", "")}
              {renderTextPreference("Google (Gemini) Key", "googleLLMKey", "")}
              {renderTextPreference("Stability AI Key", "stabilityAIKey", "")}
              {renderTextPreference("Eleven Labs Key", "elevenLabsKey", "")}
              {renderDropdownPreference("Auto-scroll behavior", "scrollingMode", Constants.scrollingModeOptions, Constants.defaultScrollingMode)}
              <Button variant="contained" width={30} sx={{margin:5}} onClick={() => updateAccount()} >Update</Button>
          </Box>
      )}
      </StandardContentArea>
    </DefaultLayout>
  </RequireAuthentication> 
  );
}


