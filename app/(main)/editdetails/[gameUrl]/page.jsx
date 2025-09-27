'use client';

import { useRouter } from 'next/router';
import React, { memo, useState, useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { defaultAppTheme } from '@src/common/theme';
import { callUpdateGameInfo } from '@src/client/gameplay';
import { callDeleteGameAndAllData } from '@src/client/editor';
import { stateManager } from '@src/client/statemanager';
import GameMenu from '@src/client/components/gamemenu';
import ChatBotView from '@src/client/components/chatbotview';
import { FontChooser } from '@src/client/components/standard/fontchooser';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import isEqual from 'lodash/isEqual';
import {
  Save,
  Play,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Sparkles,
} from 'lucide-react';

const DESIGN_SYSTEM_VERSION = 'playday-2025';

const FONT_LABELS = {
  titleFont: 'Title display',
  fontFamily: 'Interface body',
};

const COLOR_LABELS = {
  titleBackgroundColor: 'Title background',
  titleFontColor: 'Title text',
  menuButtonColor: 'Menu button color',
  chatbotMessageBackgroundColor: 'Assistant bubble background',
  chatbotMessageTextColor: 'Assistant text',
  userMessageBackgroundColor: 'Player bubble background',
  userMessageTextColor: 'Player text',
  debugMessageBackgroundColor: 'Debug bubble background',
  debugMessageTextColor: 'Debug text',
  messagesAreaBackgroundColor: 'Conversation canvas',
  inputAreaBackgroundColor: 'Composer background',
  inputAreaTextEntryBackgroundColor: 'Input field background',
  inputTextEnabledColor: 'Input text',
  inputTextDisabledColor: 'Input placeholder',
  inputAreaInformationTextColor: 'Status text',
  sendMessageButtonInactiveColor: 'Send button idle',
  sendMessageButtonActiveColor: 'Send button active',
  sendMessageButtonActiveHoverColor: 'Send button hover',
  suggestionsButtonColor: 'Suggestion chip background',
  suggestionsButtonTextColor: 'Suggestion chip text',
  suggestionsButtonHoverColor: 'Suggestion hover background',
  suggestionsButtonHoverTextColor: 'Suggestion hover text',
  imageBackgroundColor: 'Media card background',
};

const THEME_PRESETS = [
  {
    id: 'aurora-drift',
    name: 'Aurora Drift',
    tagline: 'Hybrid violet + cyan glow for calm focus.',
    previewGradient: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
    theme: {
      colors: {
        titleBackgroundColor: '#1f1b3a',
        titleFontColor: '#f5f3ff',
        menuButtonColor: '#a855f7',
        chatbotMessageBackgroundColor: '#1f2333',
        chatbotMessageTextColor: '#dbeafe',
        userMessageBackgroundColor: '#2dd4bf',
        userMessageTextColor: '#042f2e',
        debugMessageBackgroundColor: '#facc15',
        debugMessageTextColor: '#312e05',
        messagesAreaBackgroundColor: '#0b1120',
        inputAreaBackgroundColor: '#10172a',
        inputAreaTextEntryBackgroundColor: '#1f2937',
        inputTextEnabledColor: '#f8fafc',
        inputTextDisabledColor: '#94a3b8',
        inputAreaInformationTextColor: '#a5b4fc',
        sendMessageButtonInactiveColor: '#334155',
        sendMessageButtonActiveColor: '#38bdf8',
        sendMessageButtonActiveHoverColor: '#0ea5e9',
        suggestionsButtonColor: '#312e81',
        suggestionsButtonTextColor: '#c4b5fd',
        suggestionsButtonHoverColor: '#4338ca',
        suggestionsButtonHoverTextColor: '#f8fafc',
        imageBackgroundColor: '#0f172a',
      },
      fonts: {
        titleFont: 'Montserrat, sans-serif',
        fontFamily: 'Nunito, sans-serif',
      },
    },
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    tagline: 'Molten amber gradients with cinematic depth.',
    previewGradient: 'linear-gradient(135deg, #fb923c 0%, #facc15 100%)',
    theme: {
      colors: {
        titleBackgroundColor: '#3f1f14',
        titleFontColor: '#fff7ed',
        menuButtonColor: '#fbbf24',
        chatbotMessageBackgroundColor: '#4a1d1f',
        chatbotMessageTextColor: '#fed7aa',
        userMessageBackgroundColor: '#f97316',
        userMessageTextColor: '#0b0b0b',
        debugMessageBackgroundColor: '#facc15',
        debugMessageTextColor: '#422006',
        messagesAreaBackgroundColor: '#1a0f0a',
        inputAreaBackgroundColor: '#28140d',
        inputAreaTextEntryBackgroundColor: '#3a1f13',
        inputTextEnabledColor: '#fff7ed',
        inputTextDisabledColor: '#f7cbaa',
        inputAreaInformationTextColor: '#fb923c',
        sendMessageButtonInactiveColor: '#f97316',
        sendMessageButtonActiveColor: '#fbbf24',
        sendMessageButtonActiveHoverColor: '#facc15',
        suggestionsButtonColor: '#7c2d12',
        suggestionsButtonTextColor: '#fde68a',
        suggestionsButtonHoverColor: '#b45309',
        suggestionsButtonHoverTextColor: '#fff7ed',
        imageBackgroundColor: '#1a0f0a',
      },
      fonts: {
        titleFont: 'Playfair Display, serif',
        fontFamily: 'Work Sans, sans-serif',
      },
    },
  },
  {
    id: 'noir-neon',
    name: 'Noir Neon',
    tagline: 'Obsidian base ignited with electric accents.',
    previewGradient: 'linear-gradient(135deg, #22d3ee 0%, #9333ea 100%)',
    theme: {
      colors: {
        titleBackgroundColor: '#050114',
        titleFontColor: '#64ffda',
        menuButtonColor: '#64ffda',
        chatbotMessageBackgroundColor: '#111827',
        chatbotMessageTextColor: '#93c5fd',
        userMessageBackgroundColor: '#9333ea',
        userMessageTextColor: '#faf5ff',
        debugMessageBackgroundColor: '#f97316',
        debugMessageTextColor: '#1f1305',
        messagesAreaBackgroundColor: '#020617',
        inputAreaBackgroundColor: '#030712',
        inputAreaTextEntryBackgroundColor: '#111827',
        inputTextEnabledColor: '#e0f2f1',
        inputTextDisabledColor: '#475569',
        inputAreaInformationTextColor: '#38bdf8',
        sendMessageButtonInactiveColor: '#374151',
        sendMessageButtonActiveColor: '#22d3ee',
        sendMessageButtonActiveHoverColor: '#0ea5e9',
        suggestionsButtonColor: '#1e3a8a',
        suggestionsButtonTextColor: '#c7d2fe',
        suggestionsButtonHoverColor: '#2563eb',
        suggestionsButtonHoverTextColor: '#f8fafc',
        imageBackgroundColor: '#010313',
      },
      fonts: {
        titleFont: 'Kanit, sans-serif',
        fontFamily: 'Roboto, sans-serif',
      },
    },
  },
  {
    id: 'lagoon-mist',
    name: 'Lagoon Mist',
    tagline: 'Soft aqua layers with botanical highlights.',
    previewGradient: 'linear-gradient(135deg, #0ea5e9 0%, #34d399 100%)',
    theme: {
      colors: {
        titleBackgroundColor: '#0b3b46',
        titleFontColor: '#e0fbfc',
        menuButtonColor: '#38bdf8',
        chatbotMessageBackgroundColor: '#0f4c5c',
        chatbotMessageTextColor: '#bae6fd',
        userMessageBackgroundColor: '#34d399',
        userMessageTextColor: '#022c22',
        debugMessageBackgroundColor: '#facc15',
        debugMessageTextColor: '#1f1305',
        messagesAreaBackgroundColor: '#082f38',
        inputAreaBackgroundColor: '#0a2a33',
        inputAreaTextEntryBackgroundColor: '#0d3a44',
        inputTextEnabledColor: '#e0f2f1',
        inputTextDisabledColor: '#94d0d6',
        inputAreaInformationTextColor: '#7dd3fc',
        sendMessageButtonInactiveColor: '#155e75',
        sendMessageButtonActiveColor: '#34d399',
        sendMessageButtonActiveHoverColor: '#2dd4bf',
        suggestionsButtonColor: '#134e4a',
        suggestionsButtonTextColor: '#ccfbf1',
        suggestionsButtonHoverColor: '#0f766e',
        suggestionsButtonHoverTextColor: '#ecfeff',
        imageBackgroundColor: '#082f38',
      },
      fonts: {
        titleFont: 'Lato, sans-serif',
        fontFamily: 'Work Sans, sans-serif',
      },
    },
  },
  {
    id: 'velvet-alloy',
    name: 'Velvet Alloy',
    tagline: 'Charcoal polish with pearl gradients.',
    previewGradient: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    theme: {
      colors: {
        titleBackgroundColor: '#1f1726',
        titleFontColor: '#fdf2f8',
        menuButtonColor: '#ec4899',
        chatbotMessageBackgroundColor: '#2a2432',
        chatbotMessageTextColor: '#e9d5ff',
        userMessageBackgroundColor: '#6366f1',
        userMessageTextColor: '#eef2ff',
        debugMessageBackgroundColor: '#fcd34d',
        debugMessageTextColor: '#3f2a0f',
        messagesAreaBackgroundColor: '#16111d',
        inputAreaBackgroundColor: '#1f1825',
        inputAreaTextEntryBackgroundColor: '#2c2333',
        inputTextEnabledColor: '#f4f4ff',
        inputTextDisabledColor: '#c7c7d6',
        inputAreaInformationTextColor: '#c084fc',
        sendMessageButtonInactiveColor: '#4c1d95',
        sendMessageButtonActiveColor: '#ec4899',
        sendMessageButtonActiveHoverColor: '#f472b6',
        suggestionsButtonColor: '#312244',
        suggestionsButtonTextColor: '#f8d7ff',
        suggestionsButtonHoverColor: '#4c1d95',
        suggestionsButtonHoverTextColor: '#f5f3ff',
        imageBackgroundColor: '#16111d',
      },
      fonts: {
        titleFont: 'Merriweather, serif',
        fontFamily: 'Raleway, sans-serif',
      },
    },
  },
];

function mergeTheme(baseTheme, overrides) {
  const nextColors = {
    ...baseTheme.colors,
    ...(overrides?.colors ?? {}),
  };
  const nextFonts = {
    ...baseTheme.fonts,
    ...(overrides?.fonts ?? {}),
  };
  return {
    colors: nextColors,
    fonts: nextFonts,
    meta: {
      designSystem: overrides?.meta?.designSystem ?? baseTheme.meta?.designSystem ?? DESIGN_SYSTEM_VERSION,
      presetId: overrides?.meta?.presetId ?? null,
    },
  };
}

function applyPreset(preset, baseTheme) {
  const merged = mergeTheme(defaultAppTheme, baseTheme);
  const next = mergeTheme(merged, preset.theme);
  next.meta = {
    designSystem: DESIGN_SYSTEM_VERSION,
    presetId: preset.id,
  };
  return next;
}

function normaliseHex(value, fallback) {
  if (!value) {
    return fallback ?? '#ffffff';
  }
  if (value.startsWith('#')) {
    return value;
  }
  return `#${value}`;
}

function ColorField({ label, value, defaultValue, onChange }) {
  const current = normaliseHex(value, defaultValue);
  const base = current.length === 7 || current.length === 9 ? current : '#ffffff';
  const swatch = base.slice(0, 7);
  const alpha = base.length === 9 ? base.slice(7) : '';

  const handleSwatchChange = (event) => {
    const hex = event.target.value;
    onChange?.(alpha ? `${hex}${alpha}` : hex);
  };

  const handleTextChange = (event) => {
    onChange?.(normaliseHex(event.target.value, base));
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-4 shadow-inner shadow-black/10">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">{label}</div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={swatch}
          onChange={handleSwatchChange}
          className="h-10 w-10 cursor-pointer rounded-lg border border-border/60 bg-transparent p-1"
        />
        <input
          type="text"
          value={base}
          onChange={handleTextChange}
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none placeholder:text-muted"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function ThemePresetCard({ preset, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(preset)}
      className={clsx(
        'relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border border-border/60 bg-surface p-4 text-left shadow-soft transition hover:border-[color:var(--pd-highlight,#38bdf8)]/60 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-[color:var(--pd-highlight,#38bdf8)]/40',
        active && 'border-[color:var(--pd-highlight,#38bdf8)]/80 shadow-glow',
      )}
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{ backgroundImage: preset.previewGradient }}
      />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-emphasis">{preset.name}</div>
          <div className="text-xs text-muted">{preset.tagline}</div>
        </div>
        <Palette className="h-5 w-5 text-emphasis" />
      </div>
      {active && (
        <span className="relative inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-emphasis">
          <Sparkles className="h-3 w-3" /> Active
        </span>
      )}
    </button>
  );
}function ThemeEditor({ themeValue, onChange }) {
  const [appliedTheme, setAppliedTheme] = useState(() => mergeTheme(defaultAppTheme, themeValue));
  const [activePresetId, setActivePresetId] = useState(themeValue?.meta?.presetId ?? null);
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);
  const migrationHandledRef = useRef(false);

  useEffect(() => {
    const merged = mergeTheme(defaultAppTheme, themeValue);
    if (!isEqual(merged, appliedTheme)) {
      setAppliedTheme(merged);
      setActivePresetId(merged.meta?.presetId ?? null);
    }
  }, [themeValue]);

  useEffect(() => {
    if (!migrationHandledRef.current && appliedTheme?.meta?.designSystem !== DESIGN_SYSTEM_VERSION) {
      const fallbackPreset = THEME_PRESETS[0];
      const migratedTheme = applyPreset(fallbackPreset, appliedTheme);
      migrationHandledRef.current = true;
      setAppliedTheme(migratedTheme);
      setActivePresetId(fallbackPreset.id);
      setShowMigrationBanner(true);
    }
  }, [appliedTheme]);

  useEffect(() => {
    if (appliedTheme && !isEqual(appliedTheme, themeValue)) {
      onChange?.(appliedTheme);
    }
  }, [appliedTheme]);

  const handlePresetSelect = (preset) => {
    const next = applyPreset(preset, appliedTheme);
    setAppliedTheme(next);
    setActivePresetId(preset.id);
    setShowMigrationBanner(false);
  };

  const handleColorChange = (key, value) => {
    setAppliedTheme((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
      meta: {
        designSystem: DESIGN_SYSTEM_VERSION,
        presetId: prev.meta?.presetId ?? null,
      },
    }));
    setActivePresetId(null);
  };

  const handleFontChange = (key, value) => {
    setAppliedTheme((prev) => ({
      ...prev,
      fonts: {
        ...prev.fonts,
        [key]: value,
      },
      meta: {
        designSystem: DESIGN_SYSTEM_VERSION,
        presetId: prev.meta?.presetId ?? null,
      },
    }));
    setActivePresetId(null);
  };

  const colors = appliedTheme?.colors ?? defaultAppTheme.colors;
  const fonts = appliedTheme?.fonts ?? defaultAppTheme.fonts;

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/95 backdrop-blur-sm p-6 shadow-soft">
      <header className="flex flex-col gap-2 pb-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.4em] text-muted">
          Theme System
        </div>
        <h2 className="text-2xl font-semibold text-emphasis">Visual Identity</h2>
        <p className="text-sm text-muted">
          Select a palette preset as a starting point, then fine-tune individual tokens and typography. Changes update in the live preview instantly.
        </p>
        {showMigrationBanner && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4 text-sm text-orange-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              Your previous style has been upgraded to the 2025 design system. Pick a preset to continue tailoring it.
            </div>
          </div>
        )}
      </header>

      <div className="grid gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-3">
        {THEME_PRESETS.map((preset) => (
          <ThemePresetCard
            key={preset.id}
            preset={preset}
            active={preset.id === activePresetId}
            onSelect={handlePresetSelect}
          />
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(FONT_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-2xl border border-border/60 bg-surface p-4 shadow-inner shadow-black/10">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-muted">{label}</div>
              <FontChooser
                value={fonts?.[key]}
                defaultValue={defaultAppTheme.fonts[key]}
                onChange={(nextFont) => handleFontChange(key, nextFont)}
              />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface p-4 text-xs text-muted shadow-inner shadow-black/10">
          <p>
            Tip: use hex with optional alpha (e.g. #1E2937CC) for translucent surfaces. Tailwind-ready tokens will sync with the conversation canvas.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(COLOR_LABELS).map(([key, label]) => (
          <ColorField
            key={key}
            label={label}
            value={colors?.[key]}
            defaultValue={defaultAppTheme.colors[key]}
            onChange={(value) => handleColorChange(key, value)}
          />
        ))}
      </div>
    </section>
  );
}function ThemePreview({ theme, title }) {
  const mergedTheme = useMemo(() => mergeTheme(defaultAppTheme, theme), [theme]);
  const palette = mergedTheme.colors;
  const fonts = mergedTheme.fonts;

  const sampleMessages = useMemo(
    () => [
      {
        role: 'assistant',
        heading: 'Assistant',
        body: 'Welcome back! I pulled a fresh colour story inspired by your latest interactions.',
      },
      {
        role: 'user',
        heading: 'You',
        body: "Let's keep the glow but dial back the saturation on the secondary tones.",
      },
      {
        role: 'assistant',
        heading: 'Assistant',
        body: 'Done. I also adjusted the button hover states for sharper affordances.',
      },
    ],
    [theme],
  );

  const previewMessages = useMemo(
    () =>
      sampleMessages.map((message, index) => ({
        id: `preview-${index}`,
        role: message.role,
        deleted: false,
        timestamp: new Date(Date.now() - (sampleMessages.length - index) * 60000).toISOString(),
      })),
    [sampleMessages],
  );

  const renderBubble = (message, index) => {
    const isAssistant = message.role === 'assistant';
    const background = isAssistant ? palette.chatbotMessageBackgroundColor : palette.userMessageBackgroundColor;
    const foreground = isAssistant ? palette.chatbotMessageTextColor : palette.userMessageTextColor;
    const alignment = isAssistant ? 'self-start' : 'self-end';

    return (
      <div
        key={`bubble-${index}`}
        className={`max-w-[90%] rounded-3xl px-5 py-3 text-sm shadow-soft ring-1 ring-white/5 ${alignment}`}
        style={{
          backgroundColor: background,
          color: foreground,
          fontFamily: fonts.fontFamily,
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] opacity-70">
          {message.heading}
        </div>
        <div className="mt-2 leading-relaxed">{message.body}</div>
      </div>
    );
  };

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/95 p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-emphasis">Live preview</h2>
          <p className="text-sm text-muted">See how your assistant shell renders with the current palette.</p>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-[28px] border border-border/60 shadow-inner" style={{ height: '640px' }}>
        <ChatBotView
          theme={mergedTheme}
          title={title || 'Preview assistant'}
          versionString="Preview"
          messages={previewMessages}
          inputLength={280}
          onCardActionSelected={() => {}}
          editMode={false}
          supportsSuggestions={false}
          waitingForInput
          onSendMessage={() => {}}
          supportedMediaTypes={['text']}
          conversational={false}
          audioState={{}}
          onAudioStateChange={() => {}}
          onGetAudioController={() => {}}
          processingUnderway={false}
          onRequestStateChange={() => {}}
          sessionID="theme-preview"
          debugSettings={null}
        >
          <div className="flex flex-col gap-4 px-6 py-6 md:px-8">
            {sampleMessages.map((message, index) => renderBubble(message, index))}
          </div>
          <div className="px-6 pb-6 text-right text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">
            Preview only
          </div>
        </ChatBotView>
      </div>
    </section>
  );
}


function ConfirmationModal({ open, title, description, confirmLabel, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border/60 bg-[#0b1120] p-6 shadow-glow">
        <div className="flex items-center gap-3 text-red-200">
          <Trash2 className="h-6 w-6" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="mt-4 text-sm text-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border/60 bg-surface px-4 py-2 text-sm font-semibold text-emphasis transition hover:bg-surface/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl border border-red-500/40 bg-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:bg-red-500/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}function Home() {
  const { loading, account, game, versionList, switchGameByUrl, setAccountPreference, gamePermissions, editMode } = React.useContext(stateManager);
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [automaticallyModifiedPrimaryVersion, setAutomaticallyModifiedPrimaryVersion] = useState(false);
  const [noQualifiedPrimaryVersion, setNoQualifiedPrimaryVersion] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  useEffect(() => {
    if (!loading && !editMode) {
      setAccountPreference('editMode', true);
    }
  }, [loading, editMode, setAccountPreference]);

  useEffect(() => {
    let newGameInfo = null;
    if (game && !gameInfo) {
      newGameInfo = JSON.parse(JSON.stringify(game));
    } else if (gameInfo) {
      newGameInfo = JSON.parse(JSON.stringify(gameInfo));
    }

    if (newGameInfo && versionList) {
      if (nullUndefinedOrEmpty(newGameInfo?.primaryVersion) && !nullUndefinedOrEmpty(versionList)) {
        let candidates = versionList.filter((version) => version.published);
        if (candidates.length === 0) {
          candidates = versionList;
        }
        if (candidates.length > 0) {
          const mostRecent = candidates.reduce((prev, current) => (prev.lastUpdatedDate > current.lastUpdatedDate ? prev : current));
          newGameInfo.primaryVersion = mostRecent?.versionName;
          setAutomaticallyModifiedPrimaryVersion(true);
        } else {
          setNoQualifiedPrimaryVersion(true);
        }
      }
    }

    setGameInfo(newGameInfo);
  }, [game, versionList]);

  useEffect(() => {
    if (versionList && game) {
    }
  }, [versionList, game]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleTopLevelInputChange = (event) => {
    const { name, value } = event.target;
    setGameInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
    setIsDirty(true);
    setIsUpdated(false);
  };

  const handleThemeChange = (newTheme) => {
    setGameInfo((prev) => ({
      ...prev,
      theme: newTheme,
    }));
    setIsDirty(true);
    setIsUpdated(false);
  };

  const submitNewGameInfo = async () => {
    try {
      await callUpdateGameInfo(gameInfo);
      setIsDirty(false);
      setIsUpdated(true);
      await switchGameByUrl(gameInfo.url, true);
    } catch (error) {
      alert(`Error saving updates: ${error}`);
    }
  };

  const handleDeleteVersion = () => setDeleteDialogOpen(true);
  const handleCancelDelete = () => setDeleteDialogOpen(false);

  const handleConfirmDelete = () => {
    callDeleteGameAndAllData(gameInfo.gameID);
    setDeleteDialogOpen(false);
    router.replace('/');
  };

  const renderWithFormatting = (children) => (
    <StandardContentArea>
      <InfoBubble>{children}</InfoBubble>
    </StandardContentArea>
  );

  const palette = useMemo(() => {
    const themeColors = gameInfo?.theme?.colors ?? {};
    return {
      canvas: themeColors.messagesAreaBackgroundColor ?? '#0f172a',
      card: themeColors.inputAreaBackgroundColor ?? '#111c2f',
      inset: themeColors.inputAreaTextEntryBackgroundColor ?? '#16233c',
      border: 'rgba(148,163,184,0.24)',
      text: '#e2e8f0',
      muted: 'rgba(148,163,184,0.85)',
      accent: themeColors.sendMessageButtonActiveColor ?? '#38bdf8',
      accentSoft: themeColors.sendMessageButtonInactiveColor ?? '#1e3a8a',
    };
  }, [gameInfo?.theme]);

  const paletteVars = useMemo(() => ({
    '--pd-admin-canvas': palette.canvas,
    '--pd-admin-card': palette.card,
    '--pd-admin-input': palette.inset,
    '--pd-admin-border': palette.border,
    '--pd-admin-text': palette.text,
    '--pd-admin-muted': palette.muted,
    '--pd-admin-accent': palette.accent,
    '--pd-admin-accent-soft': palette.accentSoft,
  }), [palette]);

  if (!gameInfo) {
    return renderWithFormatting(<h1>Loading...</h1>);
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title={!game ? 'Loading' : (game?.title ? `Edit ${game?.title}` : 'Edit')} theme={defaultAppTheme}>
        {loading || !account || !gamePermissions
          ? renderWithFormatting(<h1>Loading...</h1>)
          : !gamePermissions.includes('game_edit')
          ? renderWithFormatting(<h1>You are not authorized to edit this app.</h1>)
          : (
            <StandardContentArea>
              <div style={paletteVars} className="mx-auto flex w-full max-w-6xl flex-col gap-8 rounded-3xl border border-border/60 bg-surface/95 p-6 text-emphasis shadow-soft backdrop-blur"
              >
                <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-surface p-6 shadow-soft md:flex-row md:items-center md:justify-between">
                  <div>
                    <h1 className="text-3xl font-semibold text-emphasis">Design Studio</h1>
                    <p className="mt-2 text-sm text-muted">Craft the tone, palette, and typographic rhythm for {gameInfo.title}.</p>
                  </div>
                  <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={submitNewGameInfo}
                      disabled={!isDirty}
                      className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-primary px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:border-border/40 disabled:bg-surface/70 disabled:text-muted/80"
                    >
                      <Save className="h-4 w-4" />
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/play/${game.url}`)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-emphasis transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Play className="h-4 w-4" />
                      Play
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-surface p-4 text-sm">
                  {isDirty ? (
                    <span className="flex items-center gap-2 text-amber-200">
                      <AlertTriangle className="h-4 w-4" /> Unsaved changes
                    </span>
                  ) : isUpdated ? (
                    <span className="flex items-center gap-2 text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" /> Changes saved
                    </span>
                  ) : (
                    <span className="text-muted">All changes synced.</span>
                  )}
                </div>

                <section className="grid gap-6 rounded-3xl border border-border/60 bg-surface p-6 shadow-soft lg:grid-cols-2">
                  <div className="space-y-5">
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      Title
                      <input
                        type="text"
                        name="title"
                        value={gameInfo.title}
                        onChange={handleTopLevelInputChange}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none placeholder:text-muted"
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      URL
                      <input
                        type="text"
                        name="url"
                        value={gameInfo.url}
                        onChange={handleTopLevelInputChange}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none placeholder:text-muted"
                      />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      Description
                      <textarea
                        name="description"
                        value={gameInfo.description}
                        onChange={handleTopLevelInputChange}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none placeholder:text-muted"
                      />
                    </label>
                  </div>
                  <div className="space-y-4">
                    <label className="block text-xs font-semibold uppercase tracking-[0.3em] text-muted">
                      Primary Version
                      <select
                        name="primaryVersion"
                        value={gameInfo.primaryVersion || ''}
                        onChange={handleTopLevelInputChange}
                        className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
                      >
                        <option value="" disabled>
                          Select a version
                        </option>
                        {versionList?.map((version) => (
                          <option key={version.versionName} value={version.versionName} className="text-slate-900">
                            {version.versionName}
                          </option>
                        ))}
                      </select>
                    </label>
                    {automaticallyModifiedPrimaryVersion && (
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4 text-sm text-amber-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>The previous primary version was unpublished. We promoted the most recently updated published version.</span>
                      </div>
                    )}
                    {noQualifiedPrimaryVersion && (
                      <div className="flex items-start gap-3 rounded-2xl border border-red-400/40 bg-red-500/15 p-4 text-sm text-red-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>No published versions are available. Publish at least one version to set it as primary.</span>
                      </div>
                    )}
                  </div>
                </section>

                <ThemeEditor themeValue={gameInfo.theme} onChange={handleThemeChange} />
                <ThemePreview theme={gameInfo.theme} title={gameInfo.title} />

                <section className="rounded-3xl border border-red-500/50 bg-red-950/40 p-6 text-sm text-red-100">
                  <header className="mb-3 flex items-center gap-2 text-base font-semibold">
                    <Trash2 className="h-5 w-5" /> Danger Zone
                  </header>
                  <p>This permanently removes the game and all associated data. This action cannot be undone.</p>
                  <button
                    type="button"
                    onClick={handleDeleteVersion}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-500/60 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/30"
                  >
                    <Trash2 className="h-4 w-4" /> Delete game
                  </button>
                </section>

                <GameMenu url={game?.url} theme={defaultAppTheme} allowEditOptions includePlayOption />
              </div>
            </StandardContentArea>
          )}
        <ConfirmationModal
          open={deleteDialogOpen}
          title="Delete entire game"
          description="This will permanently delete the game and all associated data. This cannot be undone."
          confirmLabel="Delete"
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      </DefaultLayout>
    </RequireAuthentication>
  );
}

export default memo(Home);




