"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const iconButtonClasses =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const WebAudioPlayer = ({
  source,
  textColor,
  getPlaybackControlRef,
  onStateChange,
  onBrowserBlockedPlayback,
  buttonColor,
  playOnLoad,
  playbackSpeed = 1,
  volume = 1.0,
  showControls = true,
  debug = false,
}) => {
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const hasEverBeenUserInitiated = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioSrc, setAudioSrc] = useState(null);

  const unloadAudioBuffer = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  const cleanupAudioContext = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const cleanupAudio = () => {
    debug && console.log("WAP: Cleaning up audio");
    unloadAudioBuffer();
    cleanupAudioContext();
  };

  useEffect(() => cleanupAudio, []);

  const initAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current?.state !== "closed";
  };

  const getFinalAudioURL = async (sourceToTry) => {
    if (sourceToTry?.source === "url") {
      try {
        const headResponse = await fetch(sourceToTry.data, { method: "HEAD" });
        if (headResponse.ok) {
          return sourceToTry.data;
        }
      } catch (error) {
        debug && console.warn("WAP: Primary URL failed", error);
      }
      try {
        const fallbackUrl = `https://playday.ai${sourceToTry.data}`;
        const fallbackResponse = await fetch(fallbackUrl, { method: "HEAD" });
        if (fallbackResponse.ok) {
          return fallbackUrl;
        }
      } catch (error) {
        debug && console.warn("WAP: Fallback URL failed", error);
      }
    }
    return null;
  };

  const loadAudio = async (url) => {
    try {
      const contextInitialized = initAudioContext();
      if (!contextInitialized || !audioContextRef.current) {
        throw new Error("Failed to initialize audio context");
      }

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setAudioSrc(url);
    } catch (error) {
      console.error("WAP: Error loading audio", error);
      onBrowserBlockedPlayback?.(error);
      return false;
    }
  };

  const playAudioInternal = async () => {
    try {
      if (audioSrc && !audioBuffer) {
        await loadAudio(audioSrc);
      }

      if (!hasEverBeenUserInitiated.current) {
        onBrowserBlockedPlayback?.(new Error("Playback must be user initiated"));
        return;
      }

      if (!audioBuffer || !audioContextRef.current) {
        return;
      }

      unloadAudioBuffer();

      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.playbackRate.value = playbackSpeed;
      sourceNode.connect(gainNodeRef.current);
      sourceNode.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        pausedAtRef.current = 0;
        onStateChange?.("stopped");
      };

      const offset = pausedAtRef.current;
      startTimeRef.current = audioContextRef.current.currentTime - offset;
      sourceNode.start(0, offset);

      sourceNodeRef.current = sourceNode;
      setIsPlaying(true);
      onStateChange?.("playing");
    } catch (error) {
      console.error("WAP: Error playing audio", error);
      onBrowserBlockedPlayback?.(error);
    }
  };

  const playAudio = () => {
    hasEverBeenUserInitiated.current = true;
    playAudioInternal();
  };

  const stopAudio = () => {
    unloadAudioBuffer();
    pausedAtRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    onStateChange?.("stopped");
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current && audioContextRef.current) {
      const currentOffset = audioContextRef.current.currentTime - startTimeRef.current;
      pausedAtRef.current = currentOffset;
      unloadAudioBuffer();
      setIsPlaying(false);
      onStateChange?.("paused");
    }
  };

  useEffect(() => {
    const updateTime = () => {
      if (isPlaying && audioContextRef.current) {
        setCurrentTime(audioContextRef.current.currentTime - startTimeRef.current);
        requestAnimationFrame(updateTime);
      }
    };
    if (isPlaying) {
      requestAnimationFrame(updateTime);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (source) {
      getFinalAudioURL(source).then((url) => {
        if (url) {
          loadAudio(url);
        } else {
          stopAudio();
        }
      });
    }
  }, [source]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (getPlaybackControlRef) {
      getPlaybackControlRef({
        play: playAudio,
        pause: pauseAudio,
        stop: stopAudio,
      });
    }
  }, [getPlaybackControlRef]);

  useEffect(() => {
    if (audioBuffer && playOnLoad) {
      playAudioInternal();
    }
  }, [audioBuffer, playOnLoad]);

  return (
    <div className="flex w-full items-center gap-3">
      {showControls ? (
        <>
          <button
            type="button"
            onClick={isPlaying ? pauseAudio : playAudio}
            className={iconButtonClasses}
            style={buttonColor ? { color: buttonColor } : undefined}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <span className="text-xs font-medium" style={{ color: textColor }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </>
      ) : (
        <audio src={audioSrc ?? undefined} style={{ display: "none" }} />
      )}
    </div>
  );
};

const formatTime = (time) => {
  if (!Number.isFinite(time)) {
    return "0:00";
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default React.memo(WebAudioPlayer);
