import React, { useEffect, useState } from "react";
import { Modal } from "./ui/modal";
import { stateManager } from "@src/client/statemanager";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { useAtom } from "jotai";
import { browserSessionIDState } from "@src/client/states";

export function EditorPreferencesCheck() {
  const { account, editMode, globalTemporaryState, setAccountPreference, updateGlobalTemporaryStateSetting, version } = React.useContext(stateManager);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOpenAIKey, setNewOpenAIKey] = useState("");
  const [newAnthropicKey, setNewAnthropicKey] = useState("");
  const [newGoogleLLMKey, setNewGoogleLLMKey] = useState("");
  const [elevenLabsKey, setElevenLabsKey] = useState("");
  const [newStabilityAIKey, setNewStabilityAIKey] = useState("");
  const [browserSessionID] = useAtom(browserSessionIDState);

  useEffect(() => {
    const needsKeys = editMode || (version && !version.alwaysUseBuiltInKeys);

    if (!account || !needsKeys) {
      return;
    }

    const dialogState = globalTemporaryState.APIKeyDialogShown;
    const dialogShown = !nullUndefinedOrEmpty(dialogState);
    const shownThisSession = dialogShown && dialogState.browserSessionID === browserSessionID;
    const neverShowAgain = dialogShown && dialogState.neverShowAgain;
    const shownRecently = dialogShown && new Date() - new Date(dialogState.lastShown) < 5 * 60 * 1000;
    const shouldShow = !neverShowAgain && (!dialogShown || (!shownThisSession && !shownRecently));

    const missingKeys =
      nullUndefinedOrEmpty(account.preferences?.openAIkey) &&
      nullUndefinedOrEmpty(account.preferences?.anthropicKey) &&
      nullUndefinedOrEmpty(account.preferences?.googleLLMKey) &&
      nullUndefinedOrEmpty(account.preferences?.stabilityAIKey) &&
      nullUndefinedOrEmpty(account.preferences?.elevenLabsKey);

    if (!account.preferences || (missingKeys && shouldShow)) {
      setDialogOpen(true);
    }

    if (account.preferences) {
      setNewOpenAIKey(account.preferences.openAIkey ?? "");
      setNewAnthropicKey(account.preferences.anthropicKey ?? "");
      setNewGoogleLLMKey(account.preferences.googleLLMKey ?? "");
      setNewStabilityAIKey(account.preferences.stabilityAIKey ?? "");
      setElevenLabsKey(account.preferences.elevenLabsKey ?? "");
    }
  }, [account, editMode, version, globalTemporaryState, browserSessionID]);

  const handleDialogClose = (dontShowAgain) => {
    updateGlobalTemporaryStateSetting("APIKeyDialogShown", {
      neverShowAgain: dontShowAgain,
      lastShown: new Date(),
      browserSessionID,
    });
    setDialogOpen(false);
  };

  const canAddKey = (value) => !nullUndefinedOrEmpty(value);

  const handleSetPreferences = async () => {
    if (canAddKey(newOpenAIKey)) {
      setAccountPreference("openAIkey", newOpenAIKey);
    }
    if (canAddKey(newAnthropicKey)) {
      setAccountPreference("anthropicKey", newAnthropicKey);
    }
    if (canAddKey(newGoogleLLMKey)) {
      setAccountPreference("googleLLMKey", newGoogleLLMKey);
    }
    if (canAddKey(newStabilityAIKey)) {
      setAccountPreference("stabilityAIKey", newStabilityAIKey);
    }
    if (canAddKey(elevenLabsKey)) {
      setAccountPreference("elevenLabsKey", elevenLabsKey);
    }
    handleDialogClose(false);
  };

  const footerButtons = [
    <button key="later" type="button" className="button-secondary" onClick={() => handleDialogClose(false)}>
      Not right now
    </button>,
    <button key="never" type="button" className="button-secondary" onClick={() => handleDialogClose(true)}>
      Never show again
    </button>,
    <button
      key="save"
      type="button"
      className="button-primary"
      onClick={handleSetPreferences}
      disabled={!canAddKey(newOpenAIKey) && !canAddKey(newAnthropicKey)}
    >
      Add key(s)
    </button>,
  ];

  return (
    <Modal
      open={dialogOpen}
      onClose={() => handleDialogClose(false)}
      title="Add your API keys to speed up editing"
      description="You can manage these later in Preferences from the workspace menu."
      size="md"
      footer={footerButtons}
    >
      <div className="grid gap-4">
        <InputRow label="OpenAI key" value={newOpenAIKey} onChange={setNewOpenAIKey} placeholder="sk-..." />
        <InputRow label="Anthropic (Claude) key" value={newAnthropicKey} onChange={setNewAnthropicKey} placeholder="anthropic-..." />
        <InputRow label="Google (Gemini) key" value={newGoogleLLMKey} onChange={setNewGoogleLLMKey} placeholder="AIza..." />
        <InputRow label="Eleven Labs key" value={elevenLabsKey} onChange={setElevenLabsKey} />
        <InputRow label="Stability AI key" value={newStabilityAIKey} onChange={setNewStabilityAIKey} />
      </div>
    </Modal>
  );
}

function InputRow({ label, value, onChange, placeholder }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
      />
    </label>
  );
}
