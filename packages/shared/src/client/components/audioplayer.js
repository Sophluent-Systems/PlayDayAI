"use client";

import React, { useEffect, useRef, useState } from "react";
import { resolveAudioURL } from "../audioUtils";

/**
 * Lightweight, reliable HTMLAudio player.
 *
 * Props:
 * - source: { source: 'url'|'storage', data: string }
 * - getBlobForStorageSource?: (data: string) => Promise<Blob>
 * - playbackSpeed?: number
 * - volume?: number
 * - loop?: boolean
 * - showControls?: boolean
 * - playOnLoad?: boolean
 * - onStateChange?: (state: 'playing'|'paused'|'stopped'|'error') => void
 * - onBrowserBlockedPlayback?: (err?: any) => void
 * - getPlaybackControlRef?: (api: Controller) => void
 * - debug?: boolean
 */
const AudioPlayer = ({
  source,
  getBlobForStorageSource,
  playbackSpeed = 1,
  volume = 1,
  loop = false,
  showControls = true,
  playOnLoad = false,
  preferImmediateSrc = false,
  onStateChange,
  onBrowserBlockedPlayback,
  getPlaybackControlRef,
  debug = false,
}) => {
  const audioRef = useRef(null);
  const [resolved, setResolved] = useState({ url: null, revoke: undefined });
  const pendingPlayRef = useRef(false);
  const userInitiatedPlayRef = useRef(false);

  // Resolve source -> url (and cleanup old object URLs).
  useEffect(() => {
    let cancelled = false;
    const prev = resolved;
    if (prev?.revoke) prev.revoke();

    const el = audioRef.current;
    if (!el) return undefined;

    if (!source) {
      el.removeAttribute("src");
      el.load();
      setResolved({ url: null, revoke: undefined });
      return () => {
        cancelled = true;
      };
    }

    let provisionalUrl = null;

    if (preferImmediateSrc && source?.source === "url") {
      provisionalUrl = source.data;
      if (typeof provisionalUrl === "string" && provisionalUrl.length > 0) {
        el.src = provisionalUrl;
        setResolved({ url: provisionalUrl, revoke: undefined });
      } else {
        provisionalUrl = null;
      }
    }

    (async () => {
      const res = await resolveAudioURL({ source, getBlobForStorageSource, debug });
      if (cancelled) {
        res.revoke?.();
        return;
      }
      if (res?.url && el.src !== res.url) {
        el.src = res.url;
      }
      if (!res?.url && !provisionalUrl) {
        el.removeAttribute("src");
        el.load();
      }
      setResolved(res);
    })();

    return () => {
      cancelled = true;
    };
  }, [source, getBlobForStorageSource, preferImmediateSrc]);

  // Playback rate & volume updates.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);

  const attemptPlay = useRef();
  attemptPlay.current = (fromUser = false) => {
    const el = audioRef.current;
    if (!el) return Promise.resolve(false);

    if (fromUser) {
      userInitiatedPlayRef.current = true;
    }

    if (!el.src || el.src.length === 0) {
      pendingPlayRef.current = true;
      return Promise.resolve(false);
    }

    el.playbackRate = playbackSpeed;
    el.volume = volume;
    el.loop = loop;

    try {
      const playPromise = el.play();
      if (!playPromise || typeof playPromise.then !== "function") {
        pendingPlayRef.current = false;
        if (!playOnLoad) {
          userInitiatedPlayRef.current = false;
        }
        return Promise.resolve(true);
      }

      return playPromise
        .then(() => {
          pendingPlayRef.current = false;
          if (!playOnLoad) {
            userInitiatedPlayRef.current = false;
          }
          return true;
        })
        .catch((err) => {
          if (debug) console.warn("Audio: play() error", err);
          if (err?.name === "NotAllowedError") {
            onBrowserBlockedPlayback?.(err);
            userInitiatedPlayRef.current = false;
          } else {
            pendingPlayRef.current = true;
          }
          return false;
        });
    } catch (err) {
      if (debug) console.warn("Audio: play() threw synchronously", err);
      pendingPlayRef.current = true;
      return Promise.resolve(false);
    }
  };

  // Manage playback when URL ready.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !resolved.url) return;

    el.src = resolved.url;
    el.load();

    const shouldAttempt =
      playOnLoad || pendingPlayRef.current || userInitiatedPlayRef.current;
    if (!shouldAttempt) return;

    const wasUserInitiated = userInitiatedPlayRef.current;
    const raf = requestAnimationFrame(() => {
      attemptPlay.current?.(wasUserInitiated);
    });

    return () => cancelAnimationFrame(raf);
  }, [resolved.url, playOnLoad]);

  // Events wiring.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handlePlay = () => {
      pendingPlayRef.current = false;
      onStateChange?.("playing");
    };
    const handlePause = () => onStateChange?.("paused");
    const handleEnded = () => {
      pendingPlayRef.current = false;
      onStateChange?.("stopped");
    };
    const handleError = () => onStateChange?.("error");

    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("error", handleError);

    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnded);
      el.removeEventListener("error", handleError);
    };
  }, [onStateChange]);

  // Imperative controller
  useEffect(() => {
    if (!getPlaybackControlRef) return;

    const api = {
      loadSourceAndPlay: ({ source: loadSource } = {}) => {
        const el = audioRef.current;
        if (!el || !loadSource) return Promise.resolve(false);

        userInitiatedPlayRef.current = true;

        if (loadSource.source === "url" && typeof loadSource.data === "string" && loadSource.data.length > 0) {
          setResolved((prev) => {
            prev?.revoke?.();
            return { url: loadSource.data, revoke: undefined };
          });
          el.src = loadSource.data;
          return attemptPlay.current?.(true) ?? Promise.resolve(false);
        }

        pendingPlayRef.current = true;
        return attemptPlay.current?.(true) ?? Promise.resolve(false);
      },
      play: () => attemptPlay.current?.(true),
      pause: () => audioRef.current?.pause(),
      stop: () => {
        const el = audioRef.current;
        if (!el) return;
        el.pause();
        el.currentTime = 0;
      },
      setVolume: (value) => {
        const el = audioRef.current;
        if (!el) return;
        el.volume = Math.max(0, Math.min(1, Number(value) || 0));
      },
      setPlaybackRate: (value) => {
        const el = audioRef.current;
        if (!el) return;
        el.playbackRate = Math.max(0.25, Math.min(4, Number(value) || 1));
      },
      seekTo: (sec) => {
        const el = audioRef.current;
        if (!el || typeof sec !== "number") return;
        el.currentTime = Math.max(0, sec);
      },
    };

    getPlaybackControlRef(api);
  }, [getPlaybackControlRef, onBrowserBlockedPlayback, debug]);

  // Cleanup Blob URLs on unmount
  useEffect(() => {
    return () => {
      resolved.revoke?.();
    };
  }, [resolved]);

  return (
    <div className="flex w-full items-center">
      <audio
        ref={audioRef}
        // keep src in JSX for SSR hydration and quick paint; we also set it in effect after resolve
        src={resolved.url ?? undefined}
        loop={loop}
        controls={showControls}
        preload="auto"
        className="w-full"
      />
    </div>
  );
};

export default React.memo(AudioPlayer);
