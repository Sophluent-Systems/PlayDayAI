import React, { useState, memo, useRef, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { Waves, VolumeX, Music2, AudioLines, ChevronDown, ChevronUp } from 'lucide-react';
import AudioPlayer from './audioplayer';
import { useConfig } from '@src/client/configprovider';
import { stateManager } from '@src/client/statemanager';

const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const defaultPalette = {
  accent: '#38bdf8',
  accentMuted: '#334155',
  text: '#f8fafc',
  muted: '#94a3b8',
  surface: '#1f2937',
  border: '#1f293b',
  panel: '#111827',
  overlay: 'rgba(15, 23, 42, 0.65)',
};

const StatusChip = ({ icon: Icon, label }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-[color:var(--pd-audio-text)]">
    <Icon className="h-3 w-3" />
    <span>{label}</span>
  </span>
);

export const AudioPlaybackControls = memo(({ audioState, onGetAudioController, onAudioStateChange, theme }) => {
  const { Constants } = useConfig();
  const { account, setAccountPreference } = React.useContext(stateManager);

  const palette = useMemo(() => ({
    accent: theme?.colors?.sendMessageButtonActiveColor ?? defaultPalette.accent,
    accentMuted: theme?.colors?.sendMessageButtonInactiveColor ?? defaultPalette.accentMuted,
    text: theme?.colors?.inputTextEnabledColor ?? defaultPalette.text,
    muted: theme?.colors?.inputTextDisabledColor ?? defaultPalette.muted,
    surface: theme?.colors?.inputAreaTextEntryBackgroundColor ?? defaultPalette.surface,
    border: theme?.colors?.messagesAreaBackgroundColor ?? defaultPalette.border,
    panel: theme?.colors?.messagesAreaBackgroundColor ?? defaultPalette.panel,
    overlay: defaultPalette.overlay,
  }), [theme]);

  const cssVars = useMemo(
    () => ({
      '--pd-audio-accent': palette.accent,
      '--pd-audio-accent-muted': palette.accentMuted,
      '--pd-audio-text': palette.text,
      '--pd-audio-muted': palette.muted,
      '--pd-audio-surface': palette.surface,
      '--pd-audio-border': palette.border,
      '--pd-audio-panel': palette.panel,
    }),
    [palette],
  );

  const [bgMusicMuted, setBgMusicMuted] = useState(false);
  const [soundEffectMuted, setSoundEffectMuted] = useState(false);
  const [showAudioPermissionDialog, setShowAudioPermissionDialog] = useState(false);
  const [blockedAudioTypes, setBlockedAudioTypes] = useState([]);
  const [speechPlaybackSpeed, setSpeechPlaybackSpeed] = useState(undefined);
  const [volume, setVolume] = useState(undefined);

  const speechControllerRef = useRef(null);
  const bgMusicControllerRef = useRef(null);
  const soundEffectControllerRef = useRef(null);
  const updatePreferencesTimeoutId = useRef(null);

  const volumeToUse = typeof volume !== 'undefined' ? volume : 1;
  const speechPlaybackSpeedToUse = typeof speechPlaybackSpeed !== 'undefined' ? speechPlaybackSpeed : 1;

  useEffect(() => {
    if (!account) {
      return;
    }

    const accountVolume = typeof account.preferences?.audioVolume !== 'undefined' ? account.preferences.audioVolume : 0.5;
    const accountPlaybackSpeed =
      typeof account.preferences?.audioPlaybackSpeed !== 'undefined' ? account.preferences.audioPlaybackSpeed : 1;

    if (accountVolume !== volume) {
      setVolume(accountVolume);
    }
    if (accountPlaybackSpeed !== speechPlaybackSpeed) {
      setSpeechPlaybackSpeed(accountPlaybackSpeed);
    }
  }, [account]);

  const updatePreferenceOnTimer = (preferenceName, newValue) => {
    if (updatePreferencesTimeoutId.current) {
      clearTimeout(updatePreferencesTimeoutId.current);
      updatePreferencesTimeoutId.current = null;
    }

    updatePreferencesTimeoutId.current = setTimeout(() => {
      setAccountPreference(preferenceName, newValue);
      updatePreferencesTimeoutId.current = null;
    }, 500);
  };

  const handleSpeedChange = (speed) => {
    if (typeof speechPlaybackSpeed === 'undefined') {
      return;
    }
    if (speed !== speechPlaybackSpeed) {
      setSpeechPlaybackSpeed(speed);
      updatePreferenceOnTimer('audioPlaybackSpeed', speed);
    }
  };

  const handleVolumeChange = (value) => {
    if (typeof volume === 'undefined') {
      return;
    }
    if (value !== volume) {
      setVolume(value);
      updatePreferenceOnTimer('audioVolume', value);
    }
  };

  const handleAudioPlayerStateChange = (audioType, state) => {
    onAudioStateChange?.({
      ...audioState,
      [audioType]: {
        ...(audioState?.[audioType] || {}),
        ...state,
      },
    });
  };

  const performAudioAction = useCallback((audioType, action) => {
    let controllerRef = null;
    switch (audioType) {
      case 'speech':
        controllerRef = speechControllerRef;
        break;
      case 'backgroundMusic':
        controllerRef = bgMusicControllerRef;
        break;
      case 'soundEffect':
        controllerRef = soundEffectControllerRef;
        break;
      default:
        return;
    }

    if (!controllerRef?.current || typeof controllerRef.current[action] !== 'function') {
      return;
    }

    controllerRef.current[action]();
  }, []);

  const controller = useCallback(
    (audioType, action) => {
      performAudioAction(audioType, action);
    },
    [performAudioAction],
  );

  useEffect(() => {
    if (onGetAudioController) {
      onGetAudioController(controller);
    }
  }, [controller, onGetAudioController]);

  useEffect(() => () => {
    if (updatePreferencesTimeoutId.current) {
      clearTimeout(updatePreferencesTimeoutId.current);
    }
  }, []);

  const muteAudio = (audioType) => {
    performAudioAction(audioType, 'pause');
    if (audioType === 'backgroundMusic') {
      setBgMusicMuted(true);
    }
    if (audioType === 'soundEffect') {
      setSoundEffectMuted(true);
    }
  };

  const unMuteAudio = (audioType) => {
    performAudioAction(audioType, 'play');
    if (audioType === 'backgroundMusic') {
      setBgMusicMuted(false);
    }
    if (audioType === 'soundEffect') {
      setSoundEffectMuted(false);
    }
  };

  const handleAllowBackgroundAudio = () => {
    blockedAudioTypes.forEach((audioType) => {
      unMuteAudio(audioType);
    });
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  };

  const handleOptOutBackgroundAudio = () => {
    blockedAudioTypes.forEach((audioType) => {
      muteAudio(audioType);
    });
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  };

  const onBrowserBlockedPlayback = (audioType) => {
    setBlockedAudioTypes((prev) => [...new Set([...prev, audioType])]);
    setShowAudioPermissionDialog(true);
  };

  const hasBackgroundMusic = Boolean(audioState?.backgroundMusic?.source);
  const hasSoundEffect = Boolean(audioState?.soundEffect?.source);
  const hasSpeech = Boolean(audioState?.speech?.source);
  const hasAnyAudio = hasBackgroundMusic || hasSoundEffect || hasSpeech;

  const [collapsed, setCollapsed] = useState(!hasAnyAudio);

  useEffect(() => {
    if (hasAnyAudio) {
      setCollapsed(false);
    }
  }, [hasAnyAudio]);

  if (!audioState && blockedAudioTypes.length === 0) {
    return null;
  }

  const speechStatus = audioState?.speech?.playing
    ? audioState.speech?.nowPlayingTitle || audioState.speech?.speakerName || 'Narration'
    : null;
  const musicStatus = audioState?.backgroundMusic?.playing
    ? audioState.backgroundMusic?.title || 'Background loop'
    : null;
  const fxStatus = audioState?.soundEffect?.playing ? audioState.soundEffect?.title || 'Sound FX' : null;

  return (
    <div style={cssVars} className="relative">
      {(hasAnyAudio || blockedAudioTypes.length > 0) && (
        <div className="mt-3 w-full rounded-2xl border border-white/10 bg-[color:var(--pd-audio-surface)]/85 px-4 py-3 text-[color:var(--pd-audio-text)] shadow-inner shadow-black/15">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-1 items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10">
                <Waves className="h-4 w-4" />
              </div>
              <div className="min-w-[180px] space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--pd-audio-muted)]">
                  {hasAnyAudio ? 'Playback linked' : 'Audio idle'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {speechStatus && <StatusChip icon={Waves} label={speechStatus} />}
                  {musicStatus && <StatusChip icon={Music2} label={musicStatus} />}
                  {fxStatus && <StatusChip icon={AudioLines} label={fxStatus} />}
                  {!speechStatus && !musicStatus && !fxStatus && (
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-[color:var(--pd-audio-muted)]">
                      No active audio
                    </span>
                  )}
                  {blockedAudioTypes.length > 0 && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-amber-100">
                      Browser blocked audio
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[color:var(--pd-audio-text)] transition hover:border-[color:var(--pd-audio-accent)]/60 hover:bg-[color:var(--pd-audio-accent)]/10"
            >
              {collapsed ? 'Open controls' : 'Hide controls'}
              {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          </div>

          {!collapsed && (
            <div className="mt-4 grid gap-4 text-sm text-[color:var(--pd-audio-muted)] sm:grid-cols-2">
              <div className="space-y-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.35em]">Channels</div>
                <div className="flex flex-wrap items-center gap-2">
                {hasSpeech && (
                  <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[color:var(--pd-audio-text)]">
                    <Waves className="h-4 w-4" />
                    Narration
                  </span>
                )}

                  {hasBackgroundMusic && (
                    <button
                      type="button"
                      onClick={() => {
                        if (bgMusicMuted) {
                          unMuteAudio('backgroundMusic');
                        } else {
                          muteAudio('backgroundMusic');
                        }
                      }}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[color:var(--pd-audio-text)] transition hover:border-[color:var(--pd-audio-accent)]/60 hover:bg-[color:var(--pd-audio-accent)]/10',
                        bgMusicMuted && 'border-[color:var(--pd-audio-accent)] bg-[color:var(--pd-audio-accent)]/15 text-[color:var(--pd-audio-accent)]',
                      )}
                    >
                      {bgMusicMuted ? <VolumeX className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
                      {bgMusicMuted ? 'Music muted' : 'Music on'}
                    </button>
                  )}

                  {hasSoundEffect && (
                    <button
                      type="button"
                      onClick={() => {
                        if (soundEffectMuted) {
                          unMuteAudio('soundEffect');
                        } else {
                          muteAudio('soundEffect');
                        }
                      }}
                      className={clsx(
                        'inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[color:var(--pd-audio-text)] transition hover:border-[color:var(--pd-audio-accent)]/60 hover:bg-[color:var(--pd-audio-accent)]/10',
                        soundEffectMuted && 'border-[color:var(--pd-audio-accent)] bg-[color:var(--pd-audio-accent)]/15 text-[color:var(--pd-audio-accent)]',
                      )}
                    >
                      {soundEffectMuted ? <VolumeX className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
                      {soundEffectMuted ? 'FX muted' : 'FX on'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.35em]">
                    <span>Master volume</span>
                    <span className="text-[color:var(--pd-audio-text)]">{(volumeToUse * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={Number(volumeToUse.toFixed(2))}
                    onChange={(event) => handleVolumeChange(parseFloat(event.target.value))}
                    className="h-1 w-full appearance-none rounded-full bg-white/10 accent-[color:var(--pd-audio-accent)]"
                  />
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em]">Narration speed</div>
                  <div className="flex flex-wrap gap-2">
                    {speedOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleSpeedChange(option)}
                        className={clsx(
                          'rounded-xl border border-white/10 px-3 py-1 text-xs font-semibold text-[color:var(--pd-audio-muted)] transition hover:border-[color:var(--pd-audio-accent)]/60 hover:text-[color:var(--pd-audio-accent)]',
                          speechPlaybackSpeedToUse === option &&
                            'border-[color:var(--pd-audio-accent)] bg-[color:var(--pd-audio-accent)]/15 text-[color:var(--pd-audio-accent)]',
                        )}
                      >
                        {`${option}x`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {(audioState?.speech?.source || audioState?.backgroundMusic?.source || audioState?.soundEffect?.source) && (
        <div className="sr-only" aria-hidden="true">
          {audioState?.speech?.source && audioState?.speech?.styling && (
            <AudioPlayer
              ref={speechControllerRef}
              source={audioState.speech.source}
              textColor={audioState.speech.styling.textColor}
              buttonColor={audioState.speech.styling.buttonColor}
              visualizationColor={audioState.speech.styling.audioVisualizationColor}
              onStateChange={(state) => handleAudioPlayerStateChange('speech', state)}
              onControllerReady={(controllerRef) => (speechControllerRef.current = controllerRef)}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('speech')}
              playbackRate={speechPlaybackSpeedToUse}
              volume={volumeToUse}
              loop={audioState.speech.loop || false}
              showControls={false}
              debug={Constants.debug.logAudioPlayback}
            />
          )}

          {audioState?.backgroundMusic?.source && (
            <AudioPlayer
              ref={bgMusicControllerRef}
              source={audioState.backgroundMusic.source}
              onStateChange={(state) => handleAudioPlayerStateChange('backgroundMusic', state)}
              onControllerReady={(controllerRef) => (bgMusicControllerRef.current = controllerRef)}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('backgroundMusic')}
              playbackRate={1}
              volume={volumeToUse * 0.35}
              loop={audioState.backgroundMusic.loop || false}
              showControls={false}
              debug={Constants.debug.logAudioPlayback}
            />
          )}

          {audioState?.soundEffect?.source && (
            <AudioPlayer
              ref={soundEffectControllerRef}
              source={audioState.soundEffect.source}
              onStateChange={(state) => handleAudioPlayerStateChange('soundEffect', state)}
              onControllerReady={(controllerRef) => (soundEffectControllerRef.current = controllerRef)}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback('soundEffect')}
              playbackRate={1}
              volume={volumeToUse * 0.2}
              loop={audioState.soundEffect.loop || false}
              showControls={false}
              debug={Constants.debug.logAudioPlayback}
            />
          )}
        </div>
      )}

      {showAudioPermissionDialog && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[color:var(--pd-audio-overlay,rgba(15,23,42,0.65))] px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[color:var(--pd-audio-panel)] p-6 text-sm text-[color:var(--pd-audio-text)] shadow-glow">
            <h3 className="text-lg font-semibold text-white">Background audio permission</h3>
            <p className="mt-3 text-[color:var(--pd-audio-muted)]">
              This experience tried to play audio, but the browser blocked it. Allow audio to continue playback or block it for this session.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleOptOutBackgroundAudio}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-[color:var(--pd-audio-muted)] transition hover:border-white/30 hover:text-white"
              >
                Block audio
              </button>
              <button
                type="button"
                onClick={handleAllowBackgroundAudio}
                className="rounded-xl border border-[color:var(--pd-audio-accent)] bg-[color:var(--pd-audio-accent)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--pd-audio-accent)] shadow-soft transition hover:bg-[color:var(--pd-audio-accent)]/30"
              >
                Allow audio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
