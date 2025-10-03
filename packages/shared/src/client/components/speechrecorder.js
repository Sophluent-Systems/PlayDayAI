"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Mic, MicOff, Play, Settings2 } from "lucide-react";
import { useSpeechDetection } from "./useSpeechDetection";
import { PrettyElapsedTime } from "@src/common/date";
import { useConfig } from "@src/client/configprovider";

const iconButtonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const pillButtonClasses =
  "inline-flex items-center justify-center rounded-full border border-border/60 bg-surface px-4 py-2 text-sm font-medium text-emphasis transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60";

function Popover({ open, anchorRef, children, onDismiss }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClick = (event) => {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;
      if (panel && panel.contains(event.target)) {
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

export const SpeechRecorder = memo(function SpeechRecorder(props) {
  const { Constants } = useConfig();
  const { disableListening, debug = false } = props;

  const [isMuted, setIsMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState([]);
  const [selectedBlobIndex, setSelectedBlobIndex] = useState(-1);
  const [audioDuckingMode, setAudioDuckingMode] = useState(
    Constants.audioRecordingDefaults.audioDuckingMode || "on_speaking",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const settingsButtonRef = useRef(null);

  const speechDetection = useSpeechDetection({
    onlyRecordOnSpeaking: Constants.audioRecordingDefaults.onlyRecordOnSpeaking,
    continuousRecording: Constants.audioRecordingDefaults.continuousRecording,
    echoCancellation: Constants.audioRecordingDefaults.echoCancellation,
    onSpeechDataBlobAvailable: (encodedBlob) => {
      if (debug) {
        setAudioBlobs((prev) => [
          { blob: encodedBlob, timestamp: Date.now() },
          ...prev.slice(0, 9),
        ]);
      }
      props.onRecordingComplete?.(encodedBlob);
    },
    debug: Constants.audioRecordingDefaults.debug,
    timeSlice: Constants.audioRecordingDefaults.timeSlice,
    speechInterval: Constants.audioRecordingDefaults.speechInterval,
    speechThreshold: Constants.audioRecordingDefaults.speechThreshold,
    silenceTimeout: Constants.audioRecordingDefaults.silenceTimeout,
    speechDetectMode: Constants.audioRecordingDefaults.speechDetectMode,
    minimumSpeechDuration: Constants.audioRecordingDefaults.minimumSpeechDuration,
    audioDuckingControl: audioDuckingMode,
    audioSessionType: Constants.audioRecordingDefaults.audioSessionType,
    audioSessionChangeDelay: Constants.audioRecordingDefaults.audioSessionChangeDelay,
  });

  useEffect(() => {
    const shouldListen = !isMuted && !disableListening;
    if (shouldListen === isListening) {
      return;
    }
    if (shouldListen) {
      speechDetection.startRecording();
    } else {
      speechDetection.stopRecording();
    }
    setIsListening(shouldListen);
  }, [disableListening, isMuted]);

  useEffect(() => () => speechDetection.stopRecording(), [speechDetection]);

  const playSelectedBlob = () => {
    if (selectedBlobIndex < 0) {
      return;
    }
    const selected = audioBlobs[selectedBlobIndex];
    if (!selected) {
      return;
    }
    const audio = new Audio(URL.createObjectURL(selected.blob));
    audio.play();
  };

  const duckingOptions = [
    { value: "off", label: "Ducking off" },
    { value: "on_speaking", label: "On speaking" },
    { value: "always_on", label: "Always on" },
  ];

  if (typeof window === "undefined") {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={clsx(iconButtonClasses, isMuted ? "border-rose-500/40" : "border-emerald-400/40")}
          onClick={() => setIsMuted((current) => !current)}
          title={isMuted ? "Start listening" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-primary" />}
        </button>
        <span className="text-sm text-muted">
          {isMuted ? "Mic muted" : isListening ? "Listening" : "Starting microphone..."}
        </span>
        <div className="relative ml-auto">
          <button
            ref={settingsButtonRef}
            type="button"
            className={iconButtonClasses}
            onClick={() => setSettingsOpen((current) => !current)}
            title="Recording settings"
          >
            <Settings2 className="h-5 w-5" />
          </button>
          <Popover open={settingsOpen} anchorRef={settingsButtonRef} onDismiss={() => setSettingsOpen(false)}>
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-emphasis">Audio ducking</p>
              <div className="space-y-2">
                {duckingOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setAudioDuckingMode(option.value);
                      setSettingsOpen(false);
                    }}
                    className={clsx(
                      "w-full rounded-2xl border px-3 py-2 text-left transition",
                      audioDuckingMode === option.value
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 bg-surface text-emphasis hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </Popover>
        </div>
      </div>

      {debug && audioBlobs.length > 0 ? (
        <div className="space-y-3 rounded-3xl border border-border/60 bg-surface/80 p-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
            <span>Debug recordings</span>
            <select
              value={selectedBlobIndex}
              onChange={(event) => setSelectedBlobIndex(Number(event.target.value))}
              className="rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis focus:outline-none"
            >
              <option value={-1}>Select a capture...</option>
              {audioBlobs.map((item, index) => (
                <option key={item.timestamp} value={index}>
                  {`Recording ${index + 1} (${PrettyElapsedTime(Date.now() - item.timestamp)} ago)`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={clsx(pillButtonClasses, "w-full justify-center")}
            onClick={playSelectedBlob}
            disabled={selectedBlobIndex < 0}
          >
            <Play className="mr-2 h-4 w-4" />
            Play selected
          </button>
        </div>
      ) : null}
    </div>
  );
});

export default SpeechRecorder;
