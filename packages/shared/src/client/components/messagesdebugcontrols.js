import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Wrench, StepForward } from 'lucide-react';
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
}) {
  const containerClasses =
    layout === 'stacked'
      ? 'flex flex-col gap-4'
      : 'flex flex-wrap items-center gap-x-4 gap-y-3';

  const defaults = Constants?.defaultMessageFilter || [];
  const currentFilters = localDebugSettingsRef.current?.messageFilters || [];
  const filterOptions = Array.from(new Set([...defaults, ...currentFilters]));
  const labelTextClass =
    layout === 'stacked'
      ? 'text-sm font-semibold text-white/90'
      : 'text-xs font-semibold uppercase tracking-[0.2em] text-white/80';
  const pillSpacingClass = layout === 'stacked' ? 'mt-2' : '';

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
          className="h-4 w-4 rounded border border-white/40 bg-transparent text-transparent"
          style={{ accentColor }}
        />
        <span className="tracking-normal">Show hidden</span>
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
            className="h-4 w-4 rounded border border-white/40 bg-transparent text-transparent"
            style={{ accentColor }}
          />
          <span className="tracking-normal">Single step</span>
        </label>
        {localDebugSettingsRef.current.singleStep ? (
          <button
            type="button"
            onClick={() => onDebugSingleStep?.()}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: accentColor }}
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
            className="h-4 w-4 rounded border border-white/40 bg-transparent text-transparent"
            style={{ accentColor }}
          />
          <span className="tracking-normal">Seed override</span>
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
          className="w-20 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/90 outline-none transition focus:border-white/50 focus:ring-2 focus:ring-white/25 disabled:opacity-40"
        />
      </div>

      {filterOptions.length ? (
        <div className={`flex flex-wrap items-center gap-2 ${pillSpacingClass}`}>
          {filterOptions.map((filter) => {
            const active = localDebugSettingsRef.current.messageFilters?.includes(filter);
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
                className={`rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] transition ${
                  active
                    ? 'text-slate-900'
                    : 'border-white/30 text-white/75 hover:border-white/60 hover:text-white'
                }`}
                style={
                  active
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : undefined
                }
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

  const palette = theme?.colors || {};
  const muiPalette = theme?.palette || {};
  const isDarkMode = (muiPalette.mode || muiPalette.type) === 'dark';
  const inputTextColor = palette.inputTextEnabledColor || 'rgba(248,250,252,0.9)';
  const accentColor = palette.sendMessageButtonActiveColor || '#6366F1';
  const baseSurface =
    palette.debugControlsBackgroundColor ||
    palette.inputAreaTextEntryBackgroundColor ||
    (isDarkMode ? 'rgba(15,23,42,0.88)' : 'rgba(30,41,59,0.88)');

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

  const controls = (
    <ControlGroup
      layout={variant === 'inline' ? 'stacked' : 'inline'}
      inputTextColor={inputTextColor}
      accentColor={accentColor}
      seedOverrideValueText={seedOverrideValueText}
      setSeedOverrideValueText={setSeedOverrideValueText}
      localDebugSettingsRef={localDebugSettingsRef}
      onVariableChanged={onVariableChanged}
      onDebugSingleStep={onDebugSingleStep}
      Constants={Constants}
    />
  );

  if (variant === 'inline') {
    const inlineSurface = baseSurface;
    return (
      <div
        className={`${className || ''} rounded-3xl border border-white/15 p-4 shadow-inner backdrop-blur`}
        style={{ backgroundColor: inlineSurface }}
      >
        <div className="flex items-center justify-between gap-4 text-white/80">
          <span className="text-xs font-semibold uppercase tracking-[0.35em]">Debug tools</span>
          <span className="text-xs font-medium">
            {localDebugSettingsRef.current.messageFilters?.length || 0} filters
          </span>
        </div>
        <div className="mt-4">{controls}</div>
      </div>
    );
  }

  const tabRevealWidth = '6.5rem';
  const floatingStyle = {
    backgroundColor: baseSurface,
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
      className={`${className || ''} pointer-events-auto flex h-10 items-center gap-3 overflow-hidden rounded-l-3xl rounded-r-none border border-white/25 border-r-0 bg-slate-950/95 text-white shadow-2xl backdrop-blur transition-transform duration-200 ease-out`}
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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/25"
      >
        <Wrench className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <div
        className={`ml-3 flex flex-wrap items-center gap-3 text-xs transition-all duration-200 ${
          expanded ? 'opacity-100 translate-x-0' : 'pointer-events-none opacity-0 -translate-x-6'
        }`}
        style={{ color: inputTextColor }}
      >
        {controls}
      </div>
    </div>
  );
}
