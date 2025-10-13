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
import { Key, Settings, Eye, EyeOff } from 'lucide-react';

function TextPreference({
  label,
  path,
  preferences,
  setPreferences,
  placeholder = 'Paste your value',
  isSecret = true,
  multiline = false,
}) {
  const value = getNestedObjectProperty(preferences, path) ?? '';
  const sharedClassName =
    'rounded-2xl border border-border/60 bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none';
  const [isVisible, setIsVisible] = useState(false);
  const inputType = isSecret && !isVisible ? 'password' : 'text';

  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          placeholder={placeholder}
          rows={4}
          onChange={(event) => {
            const next = { ...preferences };
            setNestedObjectProperty(next, path, event.target.value);
            setPreferences(next);
          }}
          className={`${sharedClassName} min-h-[120px] resize-y`}
        />
      ) : (
        <div className="relative flex items-center">
          <input
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              const next = { ...preferences };
              setNestedObjectProperty(next, path, event.target.value);
              setPreferences(next);
            }}
            className={`${sharedClassName} pr-12`}
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => setIsVisible((prev) => !prev)}
              className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {isVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span className="sr-only">{isVisible ? 'Hide value' : 'Show value'}</span>
            </button>
          )}
        </div>
      )}
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

  const buildBasePreferences = React.useCallback(
    (incoming = {}) => ({
      openAIkey: '',
      anthropicKey: '',
      googleLLMKey: '',
      stabilityAIKey: '',
      elevenLabsKey: '',
      openaiAgentKitWebhookSecret: '',
      openaiConnectorRegistryKey: '',
      microsoftAgentFrameworkClientId: '',
      microsoftAgentFrameworkClientSecret: '',
      azureAiFoundryEndpoint: '',
      azureEntraTenantId: '',
      googleAdsServiceAccountKey: '',
      perplexityApiKey: '',
      ibmApiConnectKey: '',
      ibmApiConnectSecret: '',
      tinkerApiKey: '',
      tinkerWebhookSecret: '',
      openRouterApiKey: '',
      temporalCloudApiKey: '',
      ...incoming,
    }),
    []
  );

  const apiKeyGroups = React.useMemo(
    () => [
      {
        title: 'Core model providers',
        fields: [
          { label: 'OpenAI', path: 'openAIkey' },
          { label: 'Anthropic', path: 'anthropicKey' },
          { label: 'Google Gemini', path: 'googleLLMKey' },
          { label: 'OpenRouter', path: 'openRouterApiKey' },
        ],
      },
      {
        title: 'Agent orchestration & platform',
        fields: [
          { label: 'OpenAI AgentKit webhook secret', path: 'openaiAgentKitWebhookSecret' },
          { label: 'OpenAI Connector Registry key', path: 'openaiConnectorRegistryKey' },
          { label: 'Microsoft Agent Framework client ID', path: 'microsoftAgentFrameworkClientId', isSecret: false, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
          { label: 'Microsoft Agent Framework client secret', path: 'microsoftAgentFrameworkClientSecret' },
          { label: 'Azure AI Foundry endpoint', path: 'azureAiFoundryEndpoint', isSecret: false, placeholder: 'https://your-resource.cognitiveservices.azure.com' },
          { label: 'Azure Entra tenant ID', path: 'azureEntraTenantId', isSecret: false, placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
          { label: 'Temporal Cloud API key', path: 'temporalCloudApiKey' },
        ],
      },
      {
        title: 'Media & speech services',
        fields: [
          { label: 'Stability AI', path: 'stabilityAIKey' },
          { label: 'ElevenLabs', path: 'elevenLabsKey' },
        ],
      },
      {
        title: 'Data & automation APIs',
        fields: [
          { label: 'Perplexity Search API', path: 'perplexityApiKey' },
          {
            label: 'Google Ads MCP service account (JSON)',
            path: 'googleAdsServiceAccountKey',
            isSecret: false,
            multiline: true,
            placeholder: '{ "type": "service_account", ... }',
          },
          { label: 'IBM API Connect key', path: 'ibmApiConnectKey' },
          { label: 'IBM API Connect secret', path: 'ibmApiConnectSecret' },
          { label: 'Tinker API key', path: 'tinkerApiKey' },
          { label: 'Tinker webhook secret', path: 'tinkerWebhookSecret' },
        ],
      },
    ],
    []
  );

  useEffect(() => {
    if (!account) {
      return;
    }
    setPreferences(buildBasePreferences(account.preferences ?? {}));
  }, [account, buildBasePreferences]);

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
              <div className="space-y-10">
                {apiKeyGroups.map((group) => (
                  <section key={group.title} className="space-y-4">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">
                      {group.title}
                    </h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => (
                        <TextPreference
                          key={field.path}
                          label={field.label}
                          path={field.path}
                          preferences={preferences}
                          setPreferences={setPreferences}
                          placeholder={field.placeholder}
                          isSecret={field.isSecret !== false}
                          multiline={field.multiline || false}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                <section className="space-y-4">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">
                    Playback settings
                  </h2>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    <SelectPreference
                      label="Auto-scroll behaviour"
                      path="scrollingMode"
                      options={Constants.scrollingModeOptions}
                      defaultValue={Constants.defaultScrollingMode}
                      preferences={preferences}
                      setPreferences={setPreferences}
                    />
                  </div>
                </section>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <SecondaryButton
                  onClick={() => setPreferences(buildBasePreferences(account.preferences ?? {}))}
                >
                  Reset
                </SecondaryButton>
                <PrimaryButton onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </PrimaryButton>
              </div>
            </GlassCard>
          </div>
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}
