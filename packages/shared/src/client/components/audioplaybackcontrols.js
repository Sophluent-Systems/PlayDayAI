"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Gauge,
  Music,
  SlidersHorizontal,
  Volume1,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import AudioPlayer from "./audioplayer";
import { useConfig } from "@src/client/configprovider";
import { stateManager } from "@src/client/statemanager";
import { Modal } from "@src/client/components/ui/modal";

const iconButtonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

const pillButtonClasses =
  "inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-surface px-4 text-sm font-medium text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

function RangeInput({
  label,
  min,
  max,
  step,
  value,
  onChange,
  marks,
  format,
}) {
  return (
    <div className="flex flex-col gap-3">
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">{label}</p> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full appearance-none rounded-full bg-border/40 accent-primary"
      />
      {Array.isArray(marks) ? (
        <div className="flex justify-between text-[10px] font-medium text-muted">
          {marks.map((mark) => (
            <span key={mark} className="select-none">
              {format ? format(mark) : mark}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Popover({ open, anchorRef, children, onDismiss }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClick = (event) => {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;
      if (!panel || panel.contains(event.target)) {
        return;
      }
      if (anchor && anchor.contains(event.target)) {
        return;
      }
      onDismiss?.();
    };

    const handleKey = (event) => {
      if (event.key === "Escape") {
        onDismiss?.();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, anchorRef, onDismiss]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl border border-border/60 bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      {children}
    </div>
  );
}

export function AudioPlaybackControls({ audioState, onGetAudioController, onAudioStateChange, theme }) {
  const { Constants } = useConfig();
  const { account, setAccountPreference } = React.useContext(stateManager);

  const [bgMusicMuted, setBgMusicMuted] = useState(false);
  const [soundEffectMuted, setSoundEffectMuted] = useState(false);
  const [blockedAudioTypes, setBlockedAudioTypes] = useState([]);
  const [showAudioPermissionDialog, setShowAudioPermissionDialog] = useState(false);
  const [speechPlaybackSpeed, setSpeechPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [activePanel, setActivePanel] = useState(null);

  const speechControllerRef = useRef(null);
  const bgMusicControllerRef = useRef(null);
  const soundEffectControllerRef = useRef(null);

  const speedButtonRef = useRef(null);
  const volumeButtonRef = useRef(null);
  const preferenceTimeoutRef = useRef(null);

  useEffect(() => {
    if (!account) {
      return;
    }
    const accountVolume =
      typeof account.preferences?.audioVolume !== "undefined" ? account.preferences.audioVolume : 0.5;
    const accountPlaybackSpeed =
      typeof account.preferences?.audioPlaybackSpeed !== "undefined" ? account.preferences.audioPlaybackSpeed : 1;

    setVolume(accountVolume);
    setSpeechPlaybackSpeed(accountPlaybackSpeed);
  }, [account]);

  useEffect(() => {
    if (!onGetAudioController) {
      return;
    }
    onGetAudioController((audioType, action) => {
      let controllerRef;
      switch (audioType) {
        case "speech":
          controllerRef = speechControllerRef;
          break;
        case "backgroundMusic":
          controllerRef = bgMusicControllerRef;
          break;
        case "soundEffect":
          controllerRef = soundEffectControllerRef;
          break;
        default:
          return;
      }

      if (!controllerRef.current) {
        return;
      }

      switch (action) {
        case "play":
          if ((audioType === "backgroundMusic" && bgMusicMuted) || (audioType === "soundEffect" && soundEffectMuted)) {
            return;
          }
          controllerRef.current.play();
          break;
        case "pause":
          controllerRef.current.pause();
          break;
        case "stop":
          controllerRef.current.stop();
          break;
        case "setVolume":
          controllerRef.current.setVolume(action.volume);
          break;
        case "seekTo":
          controllerRef.current.seekTo(action.seekTo);
          break;
        default:
          break;
      }
    });
  }, [onGetAudioController, bgMusicMuted, soundEffectMuted]);

  const schedulePreferenceUpdate = (key, value) => {
    if (preferenceTimeoutRef.current) {
      clearTimeout(preferenceTimeoutRef.current);
    }
    preferenceTimeoutRef.current = setTimeout(() => {
      setAccountPreference?.(key, value);
    }, 500);
  };

  const handleSpeedChange = (value) => {
    setSpeechPlaybackSpeed(value);
    schedulePreferenceUpdate("audioPlaybackSpeed", value);
  };

  const handleVolumeChange = (value) => {
    setVolume(value);
    schedulePreferenceUpdate("audioVolume", value);
  };

  const handleAudioPlayerStateChange = (audioType, state) => {
    onAudioStateChange?.(audioType, state);
  };

  const muteAudio = (audioType) => {
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
  };

  const unMuteAudio = (audioType) => {
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
  };

  const handleAllowBackgroundAudio = () => {
    blockedAudioTypes.forEach(unMuteAudio);
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  };

  const handleOptOutBackgroundAudio = () => {
    blockedAudioTypes.forEach(muteAudio);
    setBlockedAudioTypes([]);
    setShowAudioPermissionDialog(false);
  };

  const onBrowserBlockedPlayback = (audioType) => {
    setBlockedAudioTypes((current) => Array.from(new Set([...current, audioType])));
    setShowAudioPermissionDialog(true);
  };

  const volumeToUse = useMemo(() => (typeof volume === "number" ? volume : 1), [volume]);
  const speechPlaybackSpeedToUse = useMemo(
    () => (typeof speechPlaybackSpeed === "number" ? speechPlaybackSpeed : 1),
    [speechPlaybackSpeed],
  );

  useEffect(
    () => () => {
      if (preferenceTimeoutRef.current) {
        clearTimeout(preferenceTimeoutRef.current);
      }
    },
    [],
  );

  if (!audioState) {
    return null;
  }

  const baseIconStyle = theme?.colors?.sendMessageButtonActiveColor
    ? { color: theme.colors.sendMessageButtonActiveColor }
    : undefined;

  const accentStyle = theme?.colors?.buttonColor ? { backgroundColor: theme.colors.buttonColor, color: theme.colors.textColor } : undefined;

  return (
    <div className="flex h-10 w-full items-center">
      {(audioState.backgroundMusic?.source || audioState.soundEffect?.source || audioState.speech?.source) && (
        <span className="mr-auto ml-2 text-muted" title="Audio mix">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
      )}

      <div className="flex flex-1 items-center justify-center overflow-hidden">
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
              textColor={audioState.speech.styling.textColor}
              buttonColor={audioState.speech.styling.buttonColor}
              visualizationColor={audioState.speech.styling.audioVisualizationColor}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("speech")}
              playOnLoad
              DEBUG_audioType="speech"
              onStateChange={(state) => handleAudioPlayerStateChange("speech", state)}
              getPlaybackControlRef={(ref) => {
                speechControllerRef.current = ref;
              }}
              loop={audioState.speech.loop || false}
              playbackSpeed={speechPlaybackSpeedToUse}
              volume={volumeToUse}
              debug={Constants.debug.logAudioPlayback}
            />
          </div>
        ) : null}

        {audioState.backgroundMusic?.source ? (
          <div className="ml-3 flex items-center">
            <AudioPlayer
              source={audioState.backgroundMusic.source}
              textColor={theme?.colors?.textColor}
              buttonColor={theme?.colors?.buttonColor}
              visualizationColor={theme?.colors?.visualizationColor}
              playOnLoad={!bgMusicMuted}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("backgroundMusic")}
              onStateChange={(state) => handleAudioPlayerStateChange("backgroundMusic", state)}
              getPlaybackControlRef={(ref) => {
                bgMusicControllerRef.current = ref;
              }}
              DEBUG_audioType="backgroundMusic"
              loop={audioState.backgroundMusic.loop || false}
              showControls={false}
              volume={volumeToUse * 0.2}
              debug={Constants.debug.logAudioPlayback}
            />
          </div>
        ) : null}

        {audioState.soundEffect?.source ? (
          <div className="ml-3 flex items-center">
            <AudioPlayer
              source={audioState.soundEffect.source}
              textColor={theme?.colors?.textColor}
              buttonColor={theme?.colors?.buttonColor}
              visualizationColor={theme?.colors?.visualizationColor}
              playOnLoad={!soundEffectMuted}
              onBrowserBlockedPlayback={() => onBrowserBlockedPlayback("soundEffect")}
              onStateChange={(state) => handleAudioPlayerStateChange("soundEffect", state)}
              getPlaybackControlRef={(ref) => {
                soundEffectControllerRef.current = ref;
              }}
              DEBUG_audioType="soundEffect"
              loop={audioState.soundEffect.loop || false}
              showControls={false}
              volume={volumeToUse * 0.2}
              debug={Constants.debug.logAudioPlayback}
            />
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2 pr-2">
        {audioState.backgroundMusic?.source ? (
          <button
            type="button"
            className={iconButtonClasses}
            style={baseIconStyle}
            title={bgMusicMuted ? "Unmute background music" : "Mute background music"}
            onClick={() => {
              if (bgMusicMuted) {
                unMuteAudio("backgroundMusic");
              } else {
                muteAudio("backgroundMusic");
              }
            }}
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
            onClick={() => {
              if (soundEffectMuted) {
                unMuteAudio("soundEffect");
              } else {
                muteAudio("soundEffect");
              }
            }}
          >
            {soundEffectMuted ? <VolumeX className="h-4 w-4" /> : <Waves className="h-4 w-4" />}
          </button>
        ) : null}

        <div className="relative inline-flex">
          <button
            ref={speedButtonRef}
            type="button"
            className={clsx(pillButtonClasses, "h-10")}
            style={accentStyle}
            onClick={() => setActivePanel((current) => (current === "speed" ? null : "speed"))}
          >
            <Gauge className="h-4 w-4" />
            {`${speechPlaybackSpeedToUse.toFixed(2)}x`}
          </button>
          <Popover
            open={activePanel === "speed"}
            anchorRef={speedButtonRef}
            onDismiss={() => setActivePanel(null)}
          >
            <RangeInput
              label="Playback speed"
              min={0.5}
              max={2}
              step={0.25}
              value={speechPlaybackSpeedToUse}
              onChange={handleSpeedChange}
              marks={[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]}
              format={(mark) => `${mark.toFixed(2)}x`}
            />
          </Popover>
        </div>

        <div className="relative inline-flex">
          <button
            ref={volumeButtonRef}
            type="button"
            className={clsx(pillButtonClasses, "h-10")}
            style={accentStyle}
            onClick={() => setActivePanel((current) => (current === "volume" ? null : "volume"))}
          >
            <Volume2 className="h-4 w-4" />
            {`${Math.round(volumeToUse * 100)}%`}
          </button>
          <Popover
            open={activePanel === "volume"}
            anchorRef={volumeButtonRef}
            onDismiss={() => setActivePanel(null)}
          >
            <div className="flex items-center gap-3">
              <Volume1 className="h-4 w-4 text-muted" />
              <RangeInput
                label=""
                min={0}
                max={1}
                step={0.05}
                value={volumeToUse}
                onChange={handleVolumeChange}
                marks={[0, 0.5, 1]}
                format={(mark) => `${Math.round(mark * 100)}%`}
              />
              <Volume2 className="h-4 w-4 text-muted" />
            </div>
          </Popover>
        </div>
      </div>

      <Modal
        open={showAudioPermissionDialog}
        onClose={handleOptOutBackgroundAudio}
        title="Background audio permission"
        description="This experience tried to start audio automatically. Allow playback to hear the full mix."
        footer={[
          <button
            key="cancel"
            type="button"
            className={clsx(pillButtonClasses, "bg-surface/80")}
            onClick={handleOptOutBackgroundAudio}
          >
            Block audio
          </button>,
          <button
            key="confirm"
            type="button"
            className={clsx(pillButtonClasses, "bg-primary text-white border-primary/60")}
            onClick={handleAllowBackgroundAudio}
          >
            Allow
          </button>,
        ]}
      />
    </div>
  );
}

export default React.memo(AudioPlaybackControls);
