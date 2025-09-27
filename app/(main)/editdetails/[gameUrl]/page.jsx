"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { RequireAuthentication } from "@src/client/components/standard/requireauthentication";
import { stateManager } from "@src/client/statemanager";
import { MessagesDebugControls } from "@src/client/components/messagesdebugcontrols";
import { callUpdateGameInfo } from "@src/client/gameplay";
import { callDeleteGameAndAllData } from "@src/client/editor";
import {
  themePresetsCatalog,
  createThemeFromPreset,
  normalizeTheme,
} from "@src/common/theme";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { BuiltInPersonas } from "@src/common/builtinpersonas";
import { ChatCard } from "@src/client/components/chatcard";
import {
  Save,
  Play,
  Trash2,
  Palette,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const FONT_OPTIONS = [
  { label: "Satoshi", value: '"Satoshi", "Plus Jakarta Sans", "Space Grotesk", sans-serif' },
  { label: "Inter", value: '"Inter", "Geist", "SF Pro Text", sans-serif' },
  { label: "Geist", value: '"Geist", "Inter", "SF Pro", sans-serif' },
  { label: "Montserrat", value: 'Montserrat, sans-serif' },
  { label: "Raleway", value: 'Raleway, sans-serif' },
  { label: "Playfair Display", value: '"Playfair Display", serif' },
  { label: "Space Grotesk", value: '"Space Grotesk", sans-serif' },
  { label: "Kanit", value: 'Kanit, sans-serif' },
  { label: "DM Sans", value: '"DM Sans", sans-serif' },
  { label: "Source Code Pro", value: '"Source Code Pro", monospace' },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
];

const PALETTE_FIELDS = [
  { key: "background", label: "Background", helper: "Viewport and canvas backdrop" },
  { key: "surface", label: "Surface", helper: "Primary container panels" },
  { key: "surfaceAlt", label: "Surface Alt", helper: "Secondary surfaces & modals" },
  { key: "card", label: "Card", helper: "Chat card body" },
  { key: "accent", label: "Accent", helper: "Buttons & highlights" },
  { key: "accentSoft", label: "Accent Soft", helper: "Hover & soft glows" },
  { key: "textPrimary", label: "Primary Text", helper: "Headlines & strong copy" },
  { key: "textSecondary", label: "Secondary Text", helper: "Metadata & captions" },
  { key: "border", label: "Border", helper: "Outline & dividers" },
  { key: "info", label: "Info", helper: "Informational accents" },
  { key: "success", label: "Success", helper: "Positive state" },
  { key: "danger", label: "Danger", helper: "Errors" },
];

const FONT_FIELDS = [
  { key: "display", label: "Display font", helper: "Hero headings and large titles" },
  { key: "body", label: "Body font", helper: "Core copy and interactive text" },
  { key: "mono", label: "Mono font", helper: "Code, metrics, and stacks" },
];

const cloneTheme = (theme) => JSON.parse(JSON.stringify(theme ?? {}));

const toColorHex = (value) => {
  if (!value) {
    return "#000000";
  }
  const hex = value.replace("#", "");
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (hex.length >= 6) {
    return `#${hex.slice(0, 6)}`.toUpperCase();
  }
  return "#000000";
};

const mergeAlpha = (base, next) => {
  const alpha = base?.length === 9 ? base.slice(7) : "";
  return `${next}${alpha}`.replace(/#+/, "#").toUpperCase();
};

function ThemeEditor({ theme, onChange }) {
  const [draft, setDraft] = useState(theme);
  useEffect(() => {
    setDraft(theme);
  }, [theme]);

  const commit = (nextTheme) => {
    const normalized = normalizeTheme(nextTheme);
    setDraft(normalized);
    onChange?.(normalized);
  };

  const updateDraft = (mutator) => {
    const base = cloneTheme(draft);
    const updated = mutator(base);
    updated.meta = {
      ...updated.meta,
      preset: "custom",
    };
    commit(updated);
  };

  const handlePaletteColorChange = (key, value) => {
    updateDraft((next) => {
      next.palette = { ...next.palette, [key]: mergeAlpha(next.palette?.[key], value) };
      return next;
    });
  };

  const handlePaletteTextChange = (key, value) => {
    updateDraft((next) => {
      next.palette = { ...next.palette, [key]: value };
      return next;
    });
  };

  const handleFontChange = (key, value) => {
    updateDraft((next) => {
      next.typography = { ...next.typography, [key]: value };
      const fonts = { ...next.fonts };
      if (key === "display") fonts.titleFont = value;
      if (key === "body") fonts.fontFamily = value;
      if (key === "mono") fonts.mono = value;
      next.fonts = fonts;
      return next;
    });
  };

  const handleNameChange = (value) => {
    updateDraft((next) => {
      next.meta = { ...next.meta, name: value };
      return next;
    });
  };

  const applyPreset = (presetId) => {
    const presetTheme = createThemeFromPreset(presetId);
    commit(presetTheme);
  };

  if (!draft) {
    return (
      <section className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-lg backdrop-blur">
        <div className="flex items-center gap-3 text-emphasis">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm uppercase tracking-[0.35em]">Loading theme</span>
        </div>
      </section>
    );
  }

  const selectedPreset = draft.meta?.preset ?? "custom";

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-emphasis">Theme System</h2>
              <p className="text-xs text-muted">
                Choose a preset foundation, then fine-tune palette and typography.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/80 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-muted">
              <Palette className="h-4 w-4" />
              {selectedPreset === "custom" ? "Custom" : selectedPreset}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap gap-2">
              {themePresetsCatalog.map((preset) => {
                const isActive = preset.id === selectedPreset;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`group flex min-w-[140px] flex-1 cursor-pointer flex-col rounded-2xl border px-4 py-3 transition ${
                      isActive
                        ? "border-sky-400/70 bg-sky-400/15 text-emphasis"
                        : "border-border/60 bg-surface/80 text-emphasis hover:border-primary/50 hover:bg-surface/80"
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.3em]">{preset.name}</span>
                    <span className="mt-1 text-[11px] leading-relaxed text-muted">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border/60 bg-surface/95 p-5">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted">
              Theme name
              <input
                type="text"
                value={draft.meta?.name ?? ""}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="Give this look a label"
                className="mt-2 w-full rounded-2xl border border-border/50 bg-surface/80 px-4 py-2 text-sm text-emphasis shadow-inner focus:border-sky-400 focus:outline-none"
              />
            </label>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PALETTE_FIELDS.map((field) => {
                const paletteValue = draft.palette?.[field.key] ?? "";
                const swatchValue = toColorHex(paletteValue);
                return (
                  <div
                    key={field.key}
                    className="rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-inner"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emphasis">
                          {field.label}
                        </p>
                        <p className="text-[11px] text-muted">{field.helper}</p>
                      </div>
                      <input
                        type="color"
                        value={swatchValue}
                        onChange={(event) => handlePaletteColorChange(field.key, event.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-full border border-border/50 bg-transparent p-0"
                        aria-label={`Choose ${field.label} color`}
                      />
                    </div>
                    <input
                      type="text"
                      value={paletteValue}
                      onChange={(event) => handlePaletteTextChange(field.key, event.target.value)}
                      className="mt-3 w-full rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-xs text-emphasis focus:border-sky-400 focus:outline-none"
                      placeholder="#000000FF"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border/60 bg-surface/95 p-5 shadow-inner">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">
                Typography
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {FONT_FIELDS.map((field) => {
                  const typographyValue = draft.typography?.[field.key] ?? "";
                  return (
                    <div key={field.key} className="flex flex-col gap-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">
                        {field.label}
                      </label>
                      <select
                        value={typographyValue}
                        onChange={(event) => handleFontChange(field.key, event.target.value)}
                        className="rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-sm text-emphasis focus:border-sky-400 focus:outline-none"
                      >
                        <option value="">Custom�</option>
                        {FONT_OPTIONS.map((option) => (
                          <option key={`${field.key}-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={typographyValue}
                        onChange={(event) => handleFontChange(field.key, event.target.value)}
                        className="rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-xs text-emphasis focus:border-sky-400 focus:outline-none"
                        placeholder="Custom font stack"
                      />
                      <span className="text-[10px] text-muted">{field.helper}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const buildPreviewMessages = (theme, gameTitle) => {
  const assistantPersona = {
    displayName: "Sky Guide",
    theme: {
      colors: {
        messageBackgroundColor: theme.colors?.chatbotMessageBackgroundColor,
        messageTextColor: theme.colors?.chatbotMessageTextColor,
        buttonColor: theme.colors?.sendMessageButtonActiveColor,
      },
      fonts: {
        fontFamily: theme.fonts?.fontFamily,
      },
      icon: {
        iconID: "Sparkles",
        color: theme.palette?.accent,
      },
    },
  };

  const userPersona = {
    displayName: "Player",
    theme: {
      colors: {
        messageBackgroundColor: theme.colors?.userMessageBackgroundColor,
        messageTextColor: theme.colors?.userMessageTextColor,
        buttonColor: theme.colors?.sendMessageButtonActiveColor,
      },
      fonts: {
        fontFamily: theme.fonts?.fontFamily,
      },
      icon: {
        iconID: "Smile",
        color: theme.palette?.info,
      },
    },
  };

  const now = new Date().toISOString();

  return [
    {
      recordID: "preview-assistant-1",
      completionTime: now,
      persona: assistantPersona,
      nodeAttributes: {
        mediaTypes: ["text"],
        isAIResponse: true,
      },
      content: {
        text: `### ${gameTitle || "Experience"}\nWelcome to your adaptive story space. This preview reacts to your palette and typography selections in real time.`,
      },
      state: "complete",
    },
    {
      recordID: "preview-assistant-2",
      completionTime: now,
      persona: assistantPersona,
      nodeAttributes: {
        mediaTypes: ["image"],
        isAIResponse: true,
      },
      content: {
        image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
      },
      state: "complete",
    },
    {
      recordID: "preview-user-1",
      completionTime: now,
      persona: userPersona,
      nodeAttributes: {
        mediaTypes: ["text"],
      },
      content: {
        text: "This ambience feels perfect � let's go live!",
      },
      state: "complete",
    },
  ];
};

function ThemePreview({ theme, gameTitle }) {
  const previewMessages = useMemo(() => buildPreviewMessages(theme, gameTitle), [theme, gameTitle]);

  return (
    <section className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-emphasis">Live preview</h3>
          <p className="text-xs text-muted">Chat cards adapt instantly to your palette & typography mix.</p>
        </div>
      </header>
      <div className="flex flex-col gap-4">
        {previewMessages.map((message) => (
          <ChatCard
            key={message.recordID}
            message={message}
            theme={theme}
            deleteAllowed={false}
            waitingForProcessingToComplete={false}
            editMode={false}
            responseFeedbackMode={{ user: "readonly", admin: "readonly" }}
            sessionID="preview"
            playbackState={{}}
            onRequestAudioControl={() => {}}
          />
        ))}
      </div>
    </section>
  );
}

function PageState({ icon: Icon, tone = "info", children }) {
  const toneClasses = {
    info: "border-border/50 bg-surface/80 text-emphasis",
    warn: "border-amber-400/40 bg-amber-500/15 text-amber-100",
    danger: "border-rose-500/40 bg-rose-500/15 text-rose-100",
  };
  const classes = toneClasses[tone] ?? toneClasses.info;
  return (
    <div className={`flex flex-col items-center gap-3 rounded-3xl border px-6 py-8 text-center shadow-xl backdrop-blur ${classes}`}>
      {Icon && <Icon className="h-6 w-6" />}
      <div className="max-w-lg text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function ActionButton({ children, icon: Icon, tone = "neutral", className = "", ...rest }) {
  const toneClasses = {
    neutral: "border-border/50 bg-surface/80 text-emphasis hover:border-primary/50 hover:bg-primary/10",
    primary: "border-sky-400/50 bg-sky-500 text-slate-900 hover:border-sky-300 hover:bg-sky-400",
    accent: "border-emerald-400/40 bg-emerald-500 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-400",
    danger: "border-rose-500/50 bg-rose-500 text-rose-950 hover:border-rose-300 hover:bg-rose-400",
  };
  const toneClass = toneClasses[tone] ?? toneClasses.neutral;
  const baseClass = "inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] transition";
  return (
    <button
      type="button"
      className={`${baseClass} ${toneClass} ${className}`.trim()}
      {...rest}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}


function Home() {
  const router = useRouter();
  const {
    loading,
    account,
    game,
    versionList,
    switchGameByUrl,
    setAccountPreference,
    gamePermissions,
  } = React.useContext(stateManager);

  const editModeActive = Boolean(account?.preferences?.editMode);

  const [gameInfo, setGameInfo] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [legacyThemeMigrated, setLegacyThemeMigrated] = useState(false);
  const [primaryVersionMissing, setPrimaryVersionMissing] = useState(false);
  const [noPublishedVersions, setNoPublishedVersions] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }
    const canEdit = Boolean(gamePermissions?.includes("game_edit"));
    const current = Boolean(account?.preferences?.editMode);
    if (current === canEdit) {
      return;
    }
    setAccountPreference?.("editMode", canEdit);
  }, [loading, gamePermissions, account?.preferences?.editMode, setAccountPreference]);

  useEffect(() => {
    if (!game) {
      return;
    }

    setGameInfo((previous) => {
      if (previous) {
        return previous;
      }

      const hydrated = cloneTheme(game);
      const normalizedTheme = normalizeTheme(hydrated.theme);
      const schemaChanged = hydrated.theme?.meta?.schemaVersion !== normalizedTheme.meta?.schemaVersion;
      if (schemaChanged) {
        setLegacyThemeMigrated(true);
      }
      hydrated.theme = normalizedTheme;

      if ((!hydrated.primaryVersion || nullUndefinedOrEmpty(hydrated.primaryVersion)) && versionList?.length) {
        const published = versionList.filter((version) => version.published);
        const candidates = published.length > 0 ? published : versionList;
        if (candidates.length) {
          const chosen = candidates.reduce((latest, current) => {
            const latestDate = new Date(latest.lastUpdatedDate || 0).getTime();
            const currentDate = new Date(current.lastUpdatedDate || 0).getTime();
            return currentDate > latestDate ? current : latest;
          });
          hydrated.primaryVersion = chosen?.versionName;
        }
      }

      return hydrated;
    });
  }, [game, versionList]);

  useEffect(() => {
    if (!gameInfo || !versionList) {
      return;
    }

    const hasPrimary = versionList.some((version) => version.versionName === gameInfo.primaryVersion);
    setPrimaryVersionMissing(Boolean(gameInfo.primaryVersion && !hasPrimary));

    const publishedCount = versionList.filter((version) => version.published).length;
    setNoPublishedVersions(publishedCount === 0);
  }, [gameInfo, versionList]);

  const handleTopLevelInputChange = (event) => {
    const { name, value } = event.target;
    setGameInfo((previous) => ({
      ...previous,
      [name]: value,
    }));
    setIsDirty(true);
    setIsUpdated(false);
  };

  const handleThemeChange = (nextTheme) => {
    setGameInfo((previous) => ({
      ...previous,
      theme: nextTheme,
    }));
    setIsDirty(true);
    setIsUpdated(false);
  };

  const submitNewGameInfo = async () => {
    if (!gameInfo) {
      return;
    }
    try {
      await callUpdateGameInfo(gameInfo);
      setIsDirty(false);
      setIsUpdated(true);
      await switchGameByUrl?.(gameInfo.url, true);
    } catch (error) {
      alert(`Error saving updates: ${error}`);
    }
  };

  const handleDeleteGame = async () => {
    if (!gameInfo) {
      return;
    }
    const confirmed = window.confirm(
      "This will permanently remove the game and all of its data. This action cannot be undone. Continue?",
    );
    if (!confirmed) {
      return;
    }

    try {
      await callDeleteGameAndAllData(gameInfo.gameID);
      router.replace("/");
    } catch (error) {
      alert(`Error deleting game: ${error}`);
    }
  };

  const handlePlay = () => {
    if (gameInfo?.url) {
      router.push(`/play/${gameInfo.url}`);
    }
  };

  const loadingState = loading || !account || !gamePermissions;
  const unauthorized = !loadingState && !gamePermissions?.includes("game_edit");

  const toneBadge = isDirty
    ? { icon: AlertTriangle, text: "Unsaved changes", tone: "warn" }
    : isUpdated
    ? { icon: CheckCircle2, text: "Changes saved", tone: "accent" }
    : null;

  const personaShowcase = useMemo(() => {
    if (!gameInfo?.theme) {
      return [];
    }
    return BuiltInPersonas.slice(0, 2).map((persona, index) => ({
      ...persona,
      personaID: persona.personaID || `built-in-${index}`,
      theme: persona.theme || {
        colors: {
          messageBackgroundColor: gameInfo.theme.colors?.chatbotMessageBackgroundColor,
          messageTextColor: gameInfo.theme.colors?.chatbotMessageTextColor,
          buttonColor: gameInfo.theme.colors?.sendMessageButtonActiveColor,
        },
        fonts: {
          fontFamily: gameInfo.theme.fonts?.fontFamily,
        },
        icon: {
          iconID: persona?.theme?.icon?.iconID || "Sparkles",
          color: persona?.theme?.icon?.color || gameInfo.theme.palette?.accent,
        },
      },
    }));
  }, [gameInfo?.theme]);

  const renderPersonaPreview = () => {
    if (!personaShowcase.length || !gameInfo?.theme) {
      return null;
    }
    return (
      <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-muted">Persona cards</p>
        <div className="grid gap-6 md:grid-cols-2">
          {personaShowcase.map((persona) => {
            const message = {
              recordID: `persona-preview-${persona.personaID}`,
              completionTime: new Date().toISOString(),
              persona,
              nodeAttributes: {
                mediaTypes: ["text"],
                isAIResponse: true,
              },
              content: {
                text: `I am ${persona.displayName}. This preview respects your current card styling and typography.`,
              },
              state: "complete",
            };
            return (
              <ChatCard
                key={persona.personaID}
                message={message}
                theme={gameInfo.theme}
                deleteAllowed={false}
                waitingForProcessingToComplete={false}
                editMode={false}
                responseFeedbackMode={{ user: "readonly", admin: "readonly" }}
                sessionID="persona-preview"
                playbackState={{}}
                onRequestAudioControl={() => {}}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const pageTitle = game ? `Edit ${game.title}` : "Loading";

  return (
    <RequireAuthentication>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-950 text-slate-100">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300/80">
                Builder Studio
              </span>
              <h1 className="text-3xl font-semibold text-emphasis lg:text-4xl">{pageTitle}</h1>
              <p className="max-w-2xl text-sm text-muted">
                Craft the face of your experience with a mid-2025 design language that puts the conversation first.
                Tune palettes, typography, and structure while previewing the live card system.
              </p>
            </div>
            {toneBadge && (
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/60 bg-surface/80 px-4 py-1.5 text-[11px] uppercase tracking-[0.35em] text-emphasis">
                <toneBadge.icon className="h-3.5 w-3.5" />
                {toneBadge.text}
              </div>
            )}
            {legacyThemeMigrated && (
              <PageState icon={AlertTriangle} tone="warn">
                <strong className="block font-semibold">Legacy theme detected.</strong>
                We applied the Celestial Tide preset to migrate your app onto the new token system. Feel free to swap
                presets or fine-tune the palette below.
              </PageState>
            )}
          </header>

          {loadingState ? (
            <PageState icon={Loader2}>
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading your app data�
              </span>
            </PageState>
          ) : unauthorized ? (
            <PageState icon={AlertTriangle} tone="danger">
              You do not have permission to edit this application.
            </PageState>
          ) : !gameInfo ? (
            <PageState icon={Loader2}>
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing editor�
              </span>
            </PageState>
          ) : (
            <div className="flex flex-col gap-10">
              <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-6">
                  <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
                    <div className="grid gap-5">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Title</span>
                        <input
                          name="title"
                          value={gameInfo.title ?? ""}
                          onChange={handleTopLevelInputChange}
                          className="rounded-2xl border border-border/50 bg-surface/80 px-4 py-3 text-sm text-emphasis focus:border-sky-400 focus:outline-none"
                          placeholder="Experience name"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">URL slug</span>
                        <input
                          name="url"
                          value={gameInfo.url ?? ""}
                          onChange={handleTopLevelInputChange}
                          className="rounded-2xl border border-border/50 bg-surface/80 px-4 py-3 text-sm text-emphasis focus:border-sky-400 focus:outline-none"
                          placeholder="playday.ai/your-app"
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Description</span>
                        <textarea
                          name="description"
                          value={gameInfo.description ?? ""}
                          onChange={handleTopLevelInputChange}
                          rows={3}
                          className="rounded-2xl border border-border/50 bg-surface/80 px-4 py-3 text-sm text-emphasis focus:border-sky-400 focus:outline-none"
                          placeholder="Share what makes this experience unique."
                        />
                      </label>
                      <label className="flex flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Primary version</span>
                        <select
                          name="primaryVersion"
                          value={gameInfo.primaryVersion ?? ""}
                          onChange={handleTopLevelInputChange}
                          className="rounded-2xl border border-border/50 bg-surface/80 px-4 py-3 text-sm text-emphasis focus:border-sky-400 focus:outline-none"
                        >
                          <option value="">Select a version...</option>
                          {versionList?.map((version) => (
                            <option key={version.versionName} value={version.versionName}>
                              {version.versionName}
                              {version.published ? " � Published" : " � Draft"}
                            </option>
                          ))}
                        </select>
                        {(primaryVersionMissing || noPublishedVersions) && (
                          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                            <span>
                              {primaryVersionMissing
                                ? "The selected primary version is not currently available."
                                : "No published versions yet � players will not see this app."}
                            </span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <ThemeEditor theme={gameInfo.theme} onChange={handleThemeChange} />
                  <ThemePreview theme={gameInfo.theme} gameTitle={gameInfo.title} />
                  {renderPersonaPreview()}
                </div>

                <aside className="flex flex-col gap-6">
                  {editModeActive ? (
                    <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
                      <MessagesDebugControls
                        theme={gameInfo.theme}
                        variant="inline"
                        onDebugSingleStep={() => {}}
                        onToggleSingleStep={() => {}}
                      />
                    </div>
                  ) : null}
                  <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-xl backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Actions</p>
                    <div className="mt-4 flex flex-col gap-3">
                      <ActionButton
                        icon={Save}
                        tone="primary"
                        onClick={submitNewGameInfo}
                        disabled={!isDirty}
                        className={isDirty ? "" : "cursor-not-allowed opacity-50"}
                      >
                        Save changes
                      </ActionButton>
                      <ActionButton icon={Play} tone="accent" onClick={handlePlay}>
                        Open live preview
                      </ActionButton>
                      <ActionButton icon={Trash2} tone="danger" onClick={handleDeleteGame}>
                        Delete game
                      </ActionButton>
                    </div>
                  </div>
                </aside>
              </section>
            </div>
          )}
        </div>
      </div>
    </RequireAuthentication>
  );
}

export default memo(Home);


