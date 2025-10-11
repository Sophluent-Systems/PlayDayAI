"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Gauge, Music, Volume1, Volume2, VolumeX, Waves } from "lucide-react";
import AudioPlayer from "./audioplayer"; // HTMLAudio version
// If you switch to WebAudio in the future, swap import to ./webaudioplayer
import { useConfig } from "@src/client/configprovider";
import { stateManager } from "@src/client/statemanager";
import { Modal } from "@src/client/components/ui/modal";

const iconButtonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

const pillButtonClasses =
  "inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-surface px-4 text-sm font-medium text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

function RangeInput({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  marks,
  format,
}) {
  const listId = Array.isArray(marks) ? `${id || "range"}-marks` : undefined;
  return (
    <div className="flex flex-col gap-3">
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">{label}</p>
      ) : null}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        list={listId}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full appearance-none rounded-full bg-border/40 accent-primary"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={typeof value === "number" ? value : undefined}
        aria-label={label || id}
      />
      {Array.isArray(marks) ? (
        <>
          <datalist id={listId}>
            {marks.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <div className="flex justify-between text-[10px] font-medium text-muted">
            {marks.map((m) => (
              <span key={m} className="select-none">
                {format ? format(m) : m}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Popover({ open, anchorRef, children, onDismiss }) {
  const panelRef = useRef(null);

  // Basic outside-click + Escape handling
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;
      if (!panel) return;

      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const insidePanel = panel.contains(event.target) || path.includes(panel);
      const onAnchor = anchor && (anchor.contains(event.target) || path.includes(anchor));

      if (!insidePanel && !onAnchor) onDismiss?.();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") onDismiss?.();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchorRef, onDismiss]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-border/60 bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
      onPointerDown={(e) => {
        // prevent anchor's pointerdown from immediately toggling
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation?.();
      }}
    >
      {children}
    </div>
  );
}

export function AudioPlaybackControls({
  audioState,
  onGetAudioController,
  onAudioStateChange,
  theme,
  // If you need to play from storage, pass this down so players can fetch blobs:
  getBlobForStorageSource,
}) {
  const { Constants } = useConfig();
  const { account, setAccountPreference } = React.useContext(stateManager);

  // muted flags
  const [bgMusicMuted, setBgMusicMuted] = useState(false);
  const [soundEffectMuted, setSoundEffectMuted] = useState(false);

  // browser blocked auto-play handling
  const [blockedAudioTypes, setBlockedAudioTypes] = useState([]);
  const [showAudioPermissionDialog, setShowAudioPermissionDialog] = useState(false);

  // preferences
  const [speechPlaybackSpeed, setSpeechPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  // UI state
  const [activePanel, setActivePanel] = useState(null);
  const speedButtonRef = useRef(null);
  const volumeButtonRef = useRef(null);

  // controller refs
  const speechControllerRef = useRef(null);
  const bgMusicControllerRef = useRef(null);
  const soundEffectControllerRef = useRef(null);

  // load persisted prefs
  useEffect(() => {
    if (!account) return;
    const accountVolume = typeof account.preferences?.audioVolume !== "undefined" ? account.preferences.audioVolume : 0.5;
    const accountPlaybackSpeed = typeof account.preferences?.audioPlaybackSpeed !== "undefined" ? account.preferences.audioPlaybackSpeed : 1;
    setVolume(accountVolume);
    setSpeechPlaybackSpeed(accountPlaybackSpeed);
  }, [account]);

  // Debounce preference writes
  const prefWriteRef = useRef(null);
  const schedulePreferenceUpdate = useCallback((key, value) => {
    if (prefWriteRef.current) clearTimeout(prefWriteRef.current);
    prefWriteRef.current = setTimeout(() => setAccountPreference?.(key, value), 500);
  }, [setAccountPreference]);

  useEffect(() => () => {
    if (prefWriteRef.current) clearTimeout(prefWriteRef.current);
  }, []);

  const handleSpeedChange = useCallback((value) => {
    setSpeechPlaybackSpeed(value);
    schedulePreferenceUpdate("audioPlaybackSpeed", value);
  }, [schedulePreferenceUpdate]);

  const handleVolumeChange = useCallback((value) => {
    setVolume(value);
    schedulePreferenceUpdate("audioVolume", value);
  }, [schedulePreferenceUpdate]);

  const handleAudioPlayerStateChange = useCallback((audioType, state) => {
    onAudioStateChange?.(audioType, state);
  }, [onAudioStateChange]);

  // Muting helpers
  const muteAudio = useCallback((audioType) => {
    if (audioType === "backgroundMusic" && bgMusicControllerRef.current) {
      bgMusicControllerRef.current.pause();
      setBgMusicMuted(true);
    }
    if (audioType === "soundEffect" && soundEffectControllerRef.current) {
      soundEffectControllerRef.current.pause();
      setSoundEffectMuted(true);
    }
    if (audioType === "speech" && speechControllerRef.current) {
      speechControllerRef.current.pause();
    }
  }, []);

  const unMuteAudio = useCallback((audioType) => {
    if (audioType === "backgroundMusic" && bgMusicControllerRef.current) {
      bgMusicControllerRef.current.play();
      setBgMusicMuted(false);
    }
    if (audioType === "soundEffect" && soundEffectControllerRef.current) {
      soundEffectControllerRef.current.play();
      setSoundEffectMuted(false);
    }
    if (audioType === "speech" && speechControllerRef.current) {
      speechControllerRef.current.play();
    }
  }, []);

  // External dispatch that parent can use to control any audio type
  const dispatchRef = useRef(null);
  const makeDispatch = useCallback(() => (audioType, action, payload) => {
    const refMap = {
      speech: speechControllerRef,
      backgroundMusic: bgMusicControllerRef,
      soundEffect: soundEffectControllerRef,
    };
    const controller = refMap[audioType]?.current;
    if (!controller) return;

    const type = typeof action === "string" ? action : action?.type;
    const data = typeof action === "string" ? payload : action;

    switch (type) {
      case "loadSourceAndPlay": {
        const immediateSource =
          data?.source ?? data?.payload?.source ?? payload?.source;
        return controller.loadSourceAndPlay?.({ source: immediateSource });
      }
      case "play":
        if ((audioType === "backgroundMusic" && bgMusicMuted) || (audioType === "soundEffect" && soundEffectMuted)) return;
        controller.play?.();
        break;
      case "pause":
        controller.pause?.();
        break;
      case "stop":
        controller.stop?.();
        break;
      case "setVolume": {
        const next =
          typeof data === "number" ? data :
          typeof data?.volume === "number" ? data.volume : undefined;
        if (typeof next === "number") controller.setVolume?.(next);
        break;
      }
      case "seekTo": {
        const next =
          typeof data === "number" ? data :
          typeof data?.time === "number" ? data.time :
          typeof data?.seekTo === "number" ? data.seekTo : undefined;
        if (typeof next === "number") controller.seekTo?.(next);
        break;
      }
      default:
        break;
    }
  }, [bgMusicMuted, soundEffectMuted]);

  useEffect(() => {
    // keep a stable function instance for parents
    dispatchRef.current = makeDispatch();
    onGetAudioController?.(dispatchRef.current);
  }, [makeDispatch, onGetAudioController]);

  // Autoplay permission dialog
  const onBrowserBlockedPlayback = useCallback((audioType) => {
    setBlockedAudioTypes((curr) => Array.from(new Set([...curr, audioType])));
    setShowAudioPermissionDialog(true);
  }, []);

  const handleAllowBackgroundAudio = useCallback(() => {
    blockedAudioTypes.forEach(unMuteAudio);
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  }, [blockedAudioTypes, unMuteAudio]);

  const handleOptOutBackgroundAudio = useCallback(() => {
    blockedAudioTypes.forEach(muteAudio);
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  }, [blockedAudioTypes, muteAudio]);

  // Derived values
  const volumeToUse = useMemo(() => (typeof volume === "number" ? volume : 1), [volume]);
  const speechPlaybackSpeedToUse = useMemo(() => (typeof speechPlaybackSpeed === "number" ? speechPlaybackSpeed : 1), [speechPlaybackSpeed]);
  const speechShouldAutoplay = audioState?.speech?.autoPlayOnLoad !== false;
  const speechPreferImmediate = audioState?.speech?.preferImmediate === true;
  const backgroundMusicShouldAutoplay =
    audioState?.backgroundMusic?.autoPlayOnLoad !== false && !bgMusicMuted;
  const backgroundMusicPreferImmediate = audioState?.backgroundMusic?.preferImmediate === true;
  const soundEffectShouldAutoplay =
    audioState?.soundEffect?.autoPlayOnLoad !== false && !soundEffectMuted;
  const soundEffectPreferImmediate = audioState?.soundEffect?.preferImmediate === true;

  const baseIconStyle = useMemo(
    () => (theme?.colors?.sendMessageButtonActiveColor ? { color: theme.colors.sendMessageButtonActiveColor } : undefined),
    [theme]
  );
  const accentStyle = useMemo(
    () => (theme?.colors?.buttonColor ? { backgroundColor: theme.colors.buttonColor, color: theme.colors.textColor } : undefined),
    [theme]
  );
  const allowButtonStyle = useMemo(() => {
    if (!theme?.colors?.buttonColor) return undefined;
    // Only use buttonTextColor if explicitly provided, otherwise default to white for contrast with colored buttons
    const textColor = theme?.colors?.buttonTextColor || "#FFFFFF";
    return {
      backgroundColor: theme.colors.buttonColor,
      color: textColor,
      borderColor: theme.colors.buttonColor,
    };
  }, [theme]);

  if (!audioState) return null;

  return (
    <div className="flex h-10 w-full items-center">
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        {/* SPEECH */}
        {audioState.speech?.source && audioState.speech?.styling ? (
          <div
            className="flex min-w-[100px] max-w-3xl flex-1 items-center gap-3 rounded-2xl px-3 py-2"
            style={{ backgroundColor: audioState.speech.styling.backgroundColor }}
          >
            <span
              className="max-w-[120px] truncate text-sm font-medium"
              style={{ color: audioState.speech.styling.textColor }}
            >
              {audioState.speech.speakerName}
            </span>
            <AudioPlayer
              source={audioState.speech.source}
              getBlobForStorageSource={getBlobForStorageSource}
              textColor={audioState.speech.styling.textColor}
              // visual colors unused by HTML audio; keep for parity/migration
              buttonColor={audioState.speech.styling.buttonColor}
              playOnLoad={speechShouldAutoplay}
              preferImmediateSrc={speechPreferImmediate}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("speech")}
              onStateChange={(state) => handleAudioPlayerStateChange("speech", state)}
              getPlaybackControlRef={(ref) => (speechControllerRef.current = ref)}
              loop={audioState.speech.loop || false}
              playbackSpeed={speechPlaybackSpeedToUse}
              volume={volumeToUse}
              debug={Constants?.debug?.logAudioPlayback}
            />
          </div>
        ) : null}

        {/* BACKGROUND MUSIC */}
        {audioState.backgroundMusic?.source ? (
          <div className="ml-3 flex items-center">
            <AudioPlayer
              source={audioState.backgroundMusic.source}
              getBlobForStorageSource={getBlobForStorageSource}
              textColor={theme?.colors?.textColor}
              buttonColor={theme?.colors?.buttonColor}
              playOnLoad={backgroundMusicShouldAutoplay}
              preferImmediateSrc={backgroundMusicPreferImmediate}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("backgroundMusic")}
              onStateChange={(state) => handleAudioPlayerStateChange("backgroundMusic", state)}
              getPlaybackControlRef={(ref) => (bgMusicControllerRef.current = ref)}
              loop={audioState.backgroundMusic.loop || false}
              showControls={false}
              volume={volumeToUse * 0.2}
              debug={Constants?.debug?.logAudioPlayback}
            />
          </div>
        ) : null}

        {/* SOUND EFFECTS */}
        {audioState.soundEffect?.source ? (
          <div className="ml-3 flex items-center">
            <AudioPlayer
              source={audioState.soundEffect.source}
              getBlobForStorageSource={getBlobForStorageSource}
              textColor={theme?.colors?.textColor}
              buttonColor={theme?.colors?.buttonColor}
              playOnLoad={soundEffectShouldAutoplay}
              preferImmediateSrc={soundEffectPreferImmediate}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("soundEffect")}
              onStateChange={(state) => handleAudioPlayerStateChange("soundEffect", state)}
              getPlaybackControlRef={(ref) => (soundEffectControllerRef.current = ref)}
              loop={audioState.soundEffect.loop || false}
              showControls={false}
              volume={volumeToUse * 0.2}
              debug={Constants?.debug?.logAudioPlayback}
            />
          </div>
        ) : null}
      </div>

      {/* RIGHT-SIDE CONTROLS */}
      <div className="ml-auto flex items-center gap-2 pr-2">
        {audioState.backgroundMusic?.source ? (
          <button
            type="button"
            className={iconButtonClasses}
            style={baseIconStyle}
            title={bgMusicMuted ? "Unmute background music" : "Mute background music"}
            aria-label={bgMusicMuted ? "Unmute background music" : "Mute background music"}
            aria-pressed={bgMusicMuted}
            onClick={() => (bgMusicMuted ? unMuteAudio("backgroundMusic") : muteAudio("backgroundMusic"))}
          >
            {bgMusicMuted ? <VolumeX className="h-4 w-4" /> : <Music className="h-4 w-4" />}
          </button>
        ) : null}

        {audioState.soundEffect?.source ? (
          <button
            type="button"
            className={iconButtonClasses}
            style={baseIconStyle}
            title={soundEffectMuted ? "Unmute sound effects" : "Mute sound effects"}
            aria-label={soundEffectMuted ? "Unmute sound effects" : "Mute sound effects"}
            aria-pressed={soundEffectMuted}
            onClick={() => (soundEffectMuted ? unMuteAudio("soundEffect") : muteAudio("soundEffect"))}
          >
            {soundEffectMuted ? <VolumeX className="h-4 w-4" /> : <Waves className="h-4 w-4" />}
          </button>
        ) : null}

        {/* SPEED */}
        <div className="relative inline-flex">
          <button
            ref={speedButtonRef}
            type="button"
            className={clsx(pillButtonClasses, "h-10")}
            style={accentStyle}
            aria-expanded={activePanel === "speed"}
            aria-controls="speed-popover"
            onClick={() => setActivePanel((c) => (c === "speed" ? null : "speed"))}
          >
            <Gauge className="h-4 w-4" />
            {`${speechPlaybackSpeedToUse.toFixed(2)}x`}
          </button>
          <Popover
            open={activePanel === "speed"}
            anchorRef={speedButtonRef}
            onDismiss={() => setActivePanel(null)}
          >
            <div id="speed-popover">
              <RangeInput
                id="speed"
                label="Playback speed"
                min={0.5}
                max={2}
                step={0.25}
                value={speechPlaybackSpeedToUse}
                onChange={handleSpeedChange}
                marks={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
                format={(m) => `${m.toFixed(2)}x`}
              />
            </div>
          </Popover>
        </div>

        {/* VOLUME */}
        <div className="relative inline-flex">
          <button
            ref={volumeButtonRef}
            type="button"
            className={clsx(pillButtonClasses, "h-10")}
            style={accentStyle}
            aria-expanded={activePanel === "volume"}
            aria-controls="volume-popover"
            onClick={() => setActivePanel((c) => (c === "volume" ? null : "volume"))}
          >
            <Volume2 className="h-4 w-4" />
            {`${Math.round(volumeToUse * 100)}%`}
          </button>
          <Popover
            open={activePanel === "volume"}
            anchorRef={volumeButtonRef}
            onDismiss={() => setActivePanel(null)}
          >
            <div id="volume-popover" className="flex items-center gap-3">
              <Volume1 className="h-4 w-4 text-muted" />
              <RangeInput
                id="volume"
                label=""
                min={0}
                max={1}
                step={0.05}
                value={volumeToUse}
                onChange={handleVolumeChange}
                marks={[0, 0.5, 1]}
                format={(m) => `${Math.round(m * 100)}%`}
              />
              <Volume2 className="h-4 w-4 text-muted" />
            </div>
          </Popover>
        </div>
      </div>

      {/* Permission modal */}
      <Modal
        open={showAudioPermissionDialog}
        onClose={handleOptOutBackgroundAudio}
        title="Play background music?"
        description="This experience includes background music. You can play it if you'd like, or not. If you change your mind, you can always toggle it later."
        footer={[
          <button
            key="cancel"
            type="button"
            className={clsx(pillButtonClasses, "bg-surface/80 text-foreground border-border/60")}
            onClick={handleOptOutBackgroundAudio}
          >
            No music
          </button>,
          <button
            key="confirm"
            type="button"
            className={clsx(
              pillButtonClasses,
              "bg-surface/80 text-foreground border-border/60"
            )}
            style={allowButtonStyle}
            onClick={handleAllowBackgroundAudio}
          >
            Play
          </button>,
        ]}
      />
    </div>
  );
}

export default React.memo(AudioPlaybackControls);
