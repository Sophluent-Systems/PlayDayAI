import React, { useState, useEffect, memo } from 'react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    TextField,
} from '@mui/material';
import { stateManager } from '@src/client/statemanager';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { useAtom } from 'jotai';
import { browserSessionIDState } from '@src/client/states';



export function EditorPreferencesCheck(props) {
  const { account, editMode, globalTemporaryState, setAccountPreference, updateGlobalTemporaryStateSetting, version } = React.useContext(stateManager);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newopenAIkey, setNewopenAIkey] = useState("");
  const [newAnthropicKey, setNewAnthropicKey] = useState("");
  const [newGoogleLLMKey, setNewGoogleLLMKey] = useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [newStabilityAIKey, setNewStabilityAIKey] = useState("");
  const [browserSessionID, browserSetSessionID] = useAtom(browserSessionIDState);

  
  useEffect(() => {

    const needKeys = (editMode || (version && !version.alwaysUseBuiltInKeys));

    if (account && needKeys) {
        
        const APIKeyDialogState = globalTemporaryState.APIKeyDialogShown;
        const dialogShown = !nullUndefinedOrEmpty(APIKeyDialogState);
        const shownThisSession = dialogShown && APIKeyDialogState.browserSessionID === browserSessionID;
        const neverShowAgain = dialogShown && APIKeyDialogState.neverShowAgain;
        // 5 min in MS
        const recentTimeMS = 1000 * 60 * 5;
        const shownRecently = dialogShown && new Date() - new Date(APIKeyDialogState.lastShown) < recentTimeMS;
        const shouldShow = !neverShowAgain && (!dialogShown || (!shownThisSession && !shownRecently));
        const missingKeys = nullUndefinedOrEmpty(account.preferences.openAIkey) && nullUndefinedOrEmpty(account.preferences.anthropicKey) && nullUndefinedOrEmpty(account.preferences.googleLLMKey) && nullUndefinedOrEmpty(account.preferences.stabilityAIKey) && nullUndefinedOrEmpty(account.preferences.elevenLabsKey);

        if (!account.preferences 
            || 
            (missingKeys && shouldShow)
           ) {
          setDialogOpen(true);
        }

        if (account.preferences) {
          setNewopenAIkey(account.preferences.openAIkey);
          setNewAnthropicKey(account.preferences.anthropicKey);
        }
    }
  }, [account, editMode, version]);

  const handleDialogClose = (dontShowAgain) => {
    updateGlobalTemporaryStateSetting("APIKeyDialogShown", {
      neverShowAgain: dontShowAgain,
      lastShown: new Date(),
      browserSessionID: browserSessionID,
    })
    setDialogOpen(false);
  };

  const handleSetPreferences = async () => {
    if (!nullUndefinedOrEmpty(newopenAIkey)) {
      setAccountPreference("openAIkey", newopenAIkey);
    }
    if (!nullUndefinedOrEmpty(newAnthropicKey)) {
      setAccountPreference("anthropicKey", newAnthropicKey);
    }
    if (!nullUndefinedOrEmpty(newGoogleLLMKey)) {
      setAccountPreference("googleLLMKey", newGoogleLLMKey);
    }
    if (!nullUndefinedOrEmpty(newStabilityAIKey)) {
      setAccountPreference("stabilityAIKey", newStabilityAIKey);
    }
    if (!nullUndefinedOrEmpty(elevenLabsKey)) {
      setAccountPreference("elevenLabsKey", elevenLabsKey);
    }
    handleDialogClose();
  };

  
  const canAddKey = (value) => {
    return !nullUndefinedOrEmpty(value);
  };

  return (
    <Dialog open={dialogOpen} onClose={() => handleDialogClose(false)}>
        <DialogTitle>Would you like to add your AI keys to simplify AI editing? You can edit these later in "Preferences" using the menu on the top-left.</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="openAIkey"
            label="OpenAI Key"
            fullWidth
            value={newopenAIkey}
            onChange={(e) => setNewopenAIkey(e.target.value)}
            error={!canAddKey(newopenAIkey)}
          />
          <TextField
            margin="dense"
            id="anthropicKey"
            label="Anthropic (Claude) Key"
            fullWidth
            value={newAnthropicKey}
            onChange={(e) => setNewAnthropicKey(e.target.value)}
            error={!canAddKey(newAnthropicKey)}
          />
          <TextField
            margin="dense"
            id="googleLLMKey"
            label="Google (Gemini) Key"
            fullWidth
            value={newGoogleLLMKey}
            onChange={(e) => setNewGoogleLLMKey(e.target.value)}
            error={!canAddKey(newGoogleLLMKey)}
          />
          <TextField
            margin="dense"
            id="elevenLabsKey"
            label="Eleven Labs Key"
            fullWidth
            value={elevenLabsKey}
            onChange={(e) => setElevenLabsKey(e.target.value)}
            error={!canAddKey(elevenLabsKey)}
          />
          <TextField
            margin="dense"
            id="stabilityAIKey"
            label="Stability AI Key"
            fullWidth
            value={newStabilityAIKey}
            onChange={(e) => setNewStabilityAIKey(e.target.value)}
            error={!canAddKey(newStabilityAIKey)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleDialogClose(false)}>
            Not right now
          </Button>
          <Button onClick={() => handleDialogClose(true)}>
            Never show again
          </Button>
          <Button onClick={handleSetPreferences} disabled={!canAddKey(newopenAIkey) && !canAddKey(newAnthropicKey)}>
            Add Key(s)
          </Button>
        </DialogActions>
    </Dialog>
  );
}
