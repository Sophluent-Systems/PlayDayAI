import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Wrench, StepForward } from 'lucide-react';
import clsx from 'clsx';
import { useConfig } from '@src/client/configprovider';
import { getNestedObjectProperty, setNestedObjectProperty } from '@src/common/objects';
import { stateManager } from '@src/client/statemanager';

const COLLAPSED_WIDTH = 44;
const EXPANDED_MIN_WIDTH = 320;

function formatFilterLabel(value) {
  if (!value) {
    return 'Unknown';
  }
  const labels = {
    user: 'Player',
    assistant: 'AI',
    image: 'Images',
    narration: 'Narration',
    system: 'System',
    audio: 'Audio',
  };
  return labels[value] || value.charAt(0).toUpperCase() + value.slice(1);
}

function ControlGroup({
  layout,
  inputTextColor,
  accentColor,
  seedOverrideValueText,
  setSeedOverrideValueText,
  localDebugSettingsRef,
  onVariableChanged,
  onDebugSingleStep,
  Constants,
  tokens,
}) {
  const {
    mutedTextColor,
    neutralButtonBg,
    neutralButtonText,
    borderColor,
    chipInactiveBg,
    chipInactiveText,
    onAccentColor,
  } = tokens;

  const containerClasses =
    layout === 'stacked'
      ? 'flex flex-col gap-4'
      : 'flex flex-wrap items-center gap-x-4 gap-y-3';

  const labelTextClass =
    layout === 'stacked'
      ? 'text-sm font-semibold'
      : 'text-xs font-semibold uppercase tracking-[0.2em]';
  const pillSpacingClass = layout === 'stacked' ? 'mt-2' : '';

  const defaults = Constants?.defaultMessageFilter || [];
  const currentFilters = localDebugSettingsRef.current?.messageFilters || [];
  const filterOptions = Array.from(new Set([...defaults, ...currentFilters]));

  const commitSeed = (value) => {
    const parsed = Number.parseInt(value, 10);
    const sanitized = Number.isNaN(parsed) || parsed < 0 ? '' : String(parsed);
    onVariableChanged(
      localDebugSettingsRef.current,
      'seedOverrideValue',
      Number.isNaN(parsed) || parsed < 0 ? -1 : parsed,
    );
    setSeedOverrideValueText(sanitized);
  };

  return (
    <div className={`${containerClasses} text-[0.75rem]`} style={{ color: inputTextColor }}>
      <label className={`flex items-center gap-2 ${labelTextClass}`}>
        <input
          type="checkbox"
          checked={Boolean(localDebugSettingsRef.current.showHidden)}
          onChange={(event) =>
            onVariableChanged(localDebugSettingsRef.current, 'showHidden', event.target.checked)
          }
          name="showHidden"
          className="h-4 w-4 rounded border bg-transparent"
          style={{ accentColor, borderColor }}
        />
        <span>Show hidden</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`flex items-center gap-2 ${labelTextClass}`}>
          <input
            type="checkbox"
            checked={Boolean(localDebugSettingsRef.current.singleStep)}
            onChange={(event) =>
              onVariableChanged(localDebugSettingsRef.current, 'singleStep', event.target.checked)
            }
            name="singleStep"
            className="h-4 w-4 rounded border bg-transparent"
            style={{ accentColor, borderColor }}
          />
          <span>Single step</span>
        </label>
        {localDebugSettingsRef.current.singleStep ? (
          <button
            type="button"
            onClick={() => onDebugSingleStep?.()}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.25em] transition-transform duration-150 hover:-translate-y-0.5"
            style={{ backgroundColor: accentColor, color: onAccentColor }}
          >
            <StepForward className="h-3.5 w-3.5" strokeWidth={2.5} />
            Step
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`flex items-center gap-2 ${labelTextClass}`}>
          <input
            type="checkbox"
            checked={Boolean(localDebugSettingsRef.current.seedOverrideEnabled)}
            onChange={(event) =>
              onVariableChanged(
                localDebugSettingsRef.current,
                'seedOverrideEnabled',
                event.target.checked,
              )
            }
            name="seedOverrideEnabled"
            className="h-4 w-4 rounded border bg-transparent"
            style={{ accentColor, borderColor }}
          />
          <span>Seed override</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={seedOverrideValueText}
          onChange={(event) => setSeedOverrideValueText(event.target.value)}
          onBlur={() => commitSeed(seedOverrideValueText)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitSeed(seedOverrideValueText);
            }
          }}
          disabled={!localDebugSettingsRef.current.seedOverrideEnabled}
          className="w-20 rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] outline-none transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-40"
          style={{ backgroundColor: chipInactiveBg, borderColor, color: inputTextColor }}
        />
      </div>

      {filterOptions.length ? (
        <div className={`flex flex-wrap items-center gap-2 ${pillSpacingClass}`}>
          {filterOptions.map((filter) => {
            const active = localDebugSettingsRef.current.messageFilters?.includes(filter);
            const style = active
              ? { backgroundColor: accentColor, borderColor: accentColor, color: onAccentColor }
              : { backgroundColor: chipInactiveBg, borderColor, color: chipInactiveText };

            return (
              <button
                type="button"
                key={filter}
                onClick={() => {
                  const current = new Set(localDebugSettingsRef.current.messageFilters || []);
                  if (current.has(filter)) {
                    if (current.size === 1) {
                      return;
                    }
                    current.delete(filter);
                  } else {
                    current.add(filter);
                  }
                  onVariableChanged(localDebugSettingsRef.current, 'messageFilters', Array.from(current));
                }}
                className="rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] transition-transform duration-150 hover:-translate-y-0.5"
                style={style}
              >
                {formatFilterLabel(filter)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function resolveThemeTokens(theme) {
  const palette = theme?.palette || {};
  const colors = theme?.colors || {};
  const isDarkMode = (palette.mode || palette.type) === 'dark';

  const baseSurface =
    colors.debugControlsBackgroundColor ||
    colors.inputAreaTextEntryBackgroundColor ||
    (isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(241,245,249,0.95)');

  const borderColor =
    colors.debugControlsBorderColor ||
    (isDarkMode ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.12)');

  const inputTextColor =
    colors.inputTextEnabledColor || (isDarkMode ? 'rgba(226,232,240,0.9)' : 'rgba(30,41,59,0.78)');

  const mutedTextColor =
    colors.inputTextDisabledColor || (isDarkMode ? 'rgba(148,163,184,0.85)' : 'rgba(100,116,139,0.75)');

  const accentColor = colors.sendMessageButtonActiveColor || '#6366F1';
  const onAccentColor = colors.onSendMessageButtonColor || (isDarkMode ? '#0b1120' : '#0f172a');

  const neutralButtonBg =
    colors.playbackControlsNeutralButtonBackground ||
    (isDarkMode ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.07)');

  const neutralButtonText = colors.playbackControlsNeutralButtonText || inputTextColor;

  const chipInactiveBg = isDarkMode ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.04)';
  const chipInactiveText = mutedTextColor;

  return {
    baseSurface,
    borderColor,
    inputTextColor,
    mutedTextColor,
    accentColor,
    onAccentColor,
    neutralButtonBg,
    neutralButtonText,
    chipInactiveBg,
    chipInactiveText,
  };
}

export function MessagesDebugControls(props) {
  const { Constants } = useConfig();
  const {
    theme,
    onDebugSingleStep,
    onToggleSingleStep,
    variant = 'floating',
    className,
  } = props;

  const { account, updateSignedInAccount } = React.useContext(stateManager);

  const [seedOverrideValueText, setSeedOverrideValueText] = useState('');
  const [expanded, setExpanded] = useState(variant !== 'floating');
  const localDebugSettingsRef = useRef(null);

  const tokens = resolveThemeTokens(theme);

  useEffect(() => {
    setExpanded(variant !== 'floating');
  }, [variant]);

  const fallbackSettings = useMemo(() => {
    const defaults = Constants?.defaultDebugSettings || {};
    const messageFilters = defaults.messageFilters || Constants?.defaultMessageFilter || [];
    return {
      showHidden: false,
      singleStep: false,
      seedOverrideEnabled: false,
      seedOverrideValue: -1,
      messageFilters,
      ...defaults,
    };
  }, [Constants]);

  useEffect(() => {
    if (!account) {
      localDebugSettingsRef.current = null;
      return;
    }
    const source = account.preferences?.debugSettings || fallbackSettings;
    const hydrated = {
      ...fallbackSettings,
      ...source,
      messageFilters: Array.isArray(source.messageFilters)
        ? [...new Set(source.messageFilters)]
        : [...fallbackSettings.messageFilters],
    };
    localDebugSettingsRef.current = hydrated;
    setSeedOverrideValueText(
      typeof hydrated.seedOverrideValue === 'number' && hydrated.seedOverrideValue >= 0
        ? String(hydrated.seedOverrideValue)
        : ''
    );
  }, [account, fallbackSettings]);

  const onVariableChanged = (rootObject, path, newValue) => {
    const curValue = getNestedObjectProperty(rootObject, path);
    if (curValue === newValue) {
      return;
    }
    const newDebugSettings = { ...rootObject };
    setNestedObjectProperty(newDebugSettings, path, newValue);
    localDebugSettingsRef.current = newDebugSettings;

    if (path === 'seedOverrideValue') {
      setSeedOverrideValueText(newValue >= 0 ? String(newValue) : '');
    }

    if (account) {
      const newAccount = { ...account };
      newAccount.preferences = { ...newAccount.preferences, debugSettings: newDebugSettings };
      updateSignedInAccount(newAccount);
    }

    if (path === 'singleStep') {
      onToggleSingleStep?.(newValue);
    }
  };

  if (!localDebugSettingsRef.current) {
    return null;
  }

  const controlTokens = {
    mutedTextColor: tokens.mutedTextColor,
    neutralButtonBg: tokens.neutralButtonBg,
    neutralButtonText: tokens.neutralButtonText,
    borderColor: tokens.borderColor,
    chipInactiveBg: tokens.chipInactiveBg,
    chipInactiveText: tokens.chipInactiveText,
    onAccentColor: tokens.onAccentColor,
  };

  const controls = (
    <ControlGroup
      layout={variant === 'inline' ? 'stacked' : 'inline'}
      inputTextColor={tokens.inputTextColor}
      accentColor={tokens.accentColor}
      seedOverrideValueText={seedOverrideValueText}
      setSeedOverrideValueText={setSeedOverrideValueText}
      localDebugSettingsRef={localDebugSettingsRef}
      onVariableChanged={onVariableChanged}
      onDebugSingleStep={onDebugSingleStep}
      Constants={Constants}
      tokens={controlTokens}
    />
  );

  if (variant === 'inline') {
    return (
      <div
        className={`${className || ''} rounded-3xl border p-4 shadow-inner backdrop-blur`}
        style={{ backgroundColor: tokens.baseSurface, borderColor: tokens.borderColor, color: tokens.inputTextColor }}
      >
        <div className="flex items-center justify-between gap-4" style={{ color: tokens.mutedTextColor }}>
          <span className="text-xs font-semibold uppercase tracking-[0.35em]">Debug tools</span>
          <span className="text-xs font-medium">
            {localDebugSettingsRef.current.messageFilters?.length || 0} filters
          </span>
        </div>
        <div className="mt-4" style={{ color: tokens.inputTextColor }}>
          {controls}
        </div>
      </div>
    );
  }

  const tabRevealWidth = '5.5rem';
  const floatingStyle = {
    backgroundColor: tokens.baseSurface,
    borderColor: tokens.borderColor,
    color: tokens.inputTextColor,
    transform:
      expanded
        ? 'translateX(0)'
        : `translateX(calc(100% - ${tabRevealWidth}))`,
  };

  const handleMouseEnter = () => {
    if (variant === 'floating') {
      setExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (variant === 'floating') {
      setExpanded(false);
    }
  };

  const handleFocus = () => {
    if (variant === 'floating') {
      setExpanded(true);
    }
  };

  const handleBlur = (event) => {
    if (variant === 'floating' && !event.currentTarget.contains(event.relatedTarget)) {
      setExpanded(false);
    }
  };

  return (
    <div
      className={clsx(
        `${className || ''} pointer-events-auto flex overflow-hidden rounded-l-3xl rounded-r-none border border-r-0 shadow-2xl backdrop-blur transition-transform duration-200 ease-out`,
        expanded
          ? 'h-auto min-h-[2.5rem] w-full max-w-full flex-wrap items-start gap-3 px-3 py-2 sm:h-auto sm:w-auto sm:flex-nowrap sm:items-center sm:px-4 sm:py-2'
          : 'h-10 w-[200vw] sm:w-[200vw] flex-nowrap items-center gap-3 px-0 py-0'
      )}
      style={floatingStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        title={expanded ? 'Hide debug controls' : 'Debug controls'}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:-translate-y-0.5"
        style={{ backgroundColor: tokens.neutralButtonBg, color: tokens.neutralButtonText }}
      >
        <Wrench className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <div
        className={clsx(
          'ml-0 flex flex-wrap items-center gap-3 text-xs transition-all duration-200 sm:ml-3 sm:mt-0 sm:w-auto',
          expanded
            ? 'mt-2 w-full translate-x-0 opacity-100 pointer-events-auto sm:mt-0'
            : '-translate-x-6 mt-0 w-0 overflow-hidden opacity-0 pointer-events-none sm:w-0'
        )}
        style={{ color: tokens.inputTextColor }}
        aria-hidden={!expanded}
      >
        {controls}
      </div>
    </div>
  );
}

