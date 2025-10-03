'use client';

import React, { useEffect, useState } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { stateManager } from '@src/client/statemanager';
import { GlassCard } from '@src/client/components/ui/card';
import { PrimaryButton, SecondaryButton } from '@src/client/components/ui/button';
import { StatusPanel } from '@src/client/components/ui/statuspanel';
import { getNestedObjectProperty, setNestedObjectProperty, nullUndefinedOrEmpty } from '@src/common/objects';
import { useConfig } from '@src/client/configprovider';
import { Key, Settings } from 'lucide-react';

function TextPreference({ label, path, preferences, setPreferences }) {
  const value = getNestedObjectProperty(preferences, path) ?? '';

  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      <input
        type="password"
        value={value}
        placeholder="Paste your API key"
        onChange={(event) => {
          const next = { ...preferences };
          setNestedObjectProperty(next, path, event.target.value);
          setPreferences(next);
        }}
        className="rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function SelectPreference({ label, path, options, defaultValue, preferences, setPreferences }) {
  const current = getNestedObjectProperty(preferences, path);
  const value = nullUndefinedOrEmpty(current, true) ? defaultValue : current;

  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      <div className="rounded-2xl border border-border/60 bg-surface">
        <select
          value={value}
          onChange={(event) => {
            const next = { ...preferences };
            setNestedObjectProperty(next, path, event.target.value);
            setPreferences(next);
          }}
          className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-emphasis focus:outline-none"
        >
          {Object.entries(options).map(([key, labelText]) => (
            <option key={key} value={key}>
              {labelText}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export default function Home() {
  const { Constants } = useConfig();
  const { loading, account, updateSignedInAccount } = React.useContext(stateManager);
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) {
      return;
    }
    const base = {
      openAIkey: '',
      anthropicKey: '',
      googleLLMKey: '',
      stabilityAIKey: '',
      elevenLabsKey: '',
      ...account.preferences,
    };
    setPreferences(base);
  }, [account]);

  const handleSave = async () => {
    if (!account || !preferences) {
      return;
    }
    setSaving(true);
    try {
      const nextAccount = { ...account, preferences };
      await updateSignedInAccount(nextAccount);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !account || !preferences) {
    return (
      <RequireAuthentication>
        <DefaultLayout title="Account Preferences">
          <StandardContentArea className="bg-transparent px-0">
            <StatusPanel
              icon={Settings}
              iconClassName="animate-spin"
              title="Loading your preferences"
              description="We are syncing your account configuration."
            />
          </StandardContentArea>
        </DefaultLayout>
      </RequireAuthentication>
    );
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title="Account Preferences">
        <StandardContentArea className="bg-transparent px-0">
          <div className="space-y-8">
            <GlassCard>
              <div className="flex gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Key className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.35em] text-muted">Integrations</p>
                  <h1 className="text-2xl font-semibold text-emphasis">Manage API keys</h1>
                  <p className="text-sm text-muted">
                    Store provider credentials securely so your projects can access external models and media services.
                  </p>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="grid gap-6 md:grid-cols-2">
                <TextPreference
                  label="OpenAI"
                  path="openAIkey"
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
                <TextPreference
                  label="Anthropic"
                  path="anthropicKey"
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
                <TextPreference
                  label="Google Gemini"
                  path="googleLLMKey"
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
                <TextPreference
                  label="Stability AI"
                  path="stabilityAIKey"
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
                <TextPreference
                  label="ElevenLabs"
                  path="elevenLabsKey"
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
                <SelectPreference
                  label="Auto-scroll behaviour"
                  path="scrollingMode"
                  options={Constants.scrollingModeOptions}
                  defaultValue={Constants.defaultScrollingMode}
                  preferences={preferences}
                  setPreferences={setPreferences}
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <SecondaryButton onClick={() => setPreferences(account.preferences ?? {})}>
                  Reset
                </SecondaryButton>
                <PrimaryButton onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </PrimaryButton>
              </div>
            </GlassCard>
          </div>
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}
