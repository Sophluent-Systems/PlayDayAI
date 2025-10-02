import React, { useEffect, useRef, useState } from 'react';

const AudioPlayer = ({
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
}) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);

  const getFinalAudioURL = async (sourceToTry) => {
    if (sourceToTry.source === 'storage') {
      const blob = await callGetBlob(sessionID, sourceToTry.data);
      return URL.createObjectURL(blob);
    }

    if (sourceToTry.source === 'url') {
      try {
        const result = await fetch(sourceToTry.data, { method: 'HEAD' });
        if (result.ok) {
          return sourceToTry.data;
        }
      } catch (error) {
        // Ignore and try fallback
      }

      try {
        const secondURLtoTry = `https://playday.ai${sourceToTry.data}`;
        const result = await fetch(secondURLtoTry, { method: 'HEAD' });
        if (result.ok) {
          return secondURLtoTry;
        }
      } catch (error) {
        // Ignore fallback failures
      }
    }

    return null;
  };

  useEffect(() => {
    if (!source) {
      return;
    }

    getFinalAudioURL(source).then((url) => {
      if (url) {
        setAudioSrc(url);
      } else if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    });
  }, [source]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = volume;
    }
  }, [playbackSpeed, volume]);

  useEffect(() => {
    if (!audioRef.current || !audioSrc) {
      return;
    }

    audioRef.current.src = audioSrc;
    if (playOnLoad) {
      audioRef.current
        .play()
        .catch((error) => {
          onBrowserBlockedPlayback?.(error);
        })
        .then(() => {
          if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
            audioRef.current.volume = volume;
          }
        });
    }
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handlePlay = () => {
      audio.playbackRate = playbackSpeed;
      audio.volume = volume;
      setPlaying(true);
      onStateChange?.('playing');
    };

    const handlePause = () => {
      setPlaying(false);
      onStateChange?.('paused');
    };

    const handleEnded = () => {
      setPlaying(false);
      onStateChange?.('stopped');
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onStateChange, playbackSpeed, volume]);

  useEffect(() => {
    if (!getPlaybackControlRef) {
      return;
    }

    getPlaybackControlRef({
      play: () =>
        audioRef.current?.play().catch((error) => {
          console.error('PLAY: Error playing audio:', error);
          onBrowserBlockedPlayback?.(error);
        }),
      pause: () => audioRef.current?.pause(),
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      },
    });
  }, [getPlaybackControlRef, onBrowserBlockedPlayback]);

  return (
    <div className="flex w-full items-center">
      <audio ref={audioRef} className="w-full" controls={showControls} />
    </div>
  );
};

export default React.memo(AudioPlayer);
