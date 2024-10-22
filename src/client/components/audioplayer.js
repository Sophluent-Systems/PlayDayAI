import React, { useEffect, useRef, useState } from 'react';
import { Button, Box } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';

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
  showControls = true 
}) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);

  const getFinalAudioURL = async (sourceToTry) => {
    if (sourceToTry.source === "storage") {
      // Assuming callGetBlob is defined elsewhere in your application
      const blob = await callGetBlob(sessionID, sourceToTry.data);
      return URL.createObjectURL(blob);
    } else if (sourceToTry.source === "url") {
      // 1. Check if file exists
      try {
        let result = await fetch(sourceToTry.data, { method: 'HEAD' });
        if (result.ok) {
          return sourceToTry.data;
        }
      } catch (error) {
        // Do nothing, try the next option
      }

      // 2. Check if file exists by prefixing the URL with the domain
      try {
        const secondURLtoTry = "https://playday.ai" + sourceToTry.data;
        let result = await fetch(secondURLtoTry, { method: 'HEAD' });
        if (result.ok) {
          return secondURLtoTry;
        }
      } catch (error) {
        // Do nothing
      }
    }

    return null;
  };

  useEffect(() => {
    if (source) {
      getFinalAudioURL(source).then(url => {
        if (url) {
          setAudioSrc(url);
        } else {
          // stop playback if the source is empty
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }
      });
    }
  }, [source, getFinalAudioURL]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = volume;
    }
  }, [playbackSpeed, volume]);

  useEffect(() => {
    if (audioRef.current && audioSrc) {
      console.log('### Setting audio source:', audioSrc);
      audioRef.current.src = audioSrc;
      if (playOnLoad) {
        audioRef.current.play().catch(error => {
          onBrowserBlockedPlayback?.(error);
        }).then(() => {
          audioRef.current.playbackRate = playbackSpeed;
          audioRef.current.volume = volume;
        });
      }
    }
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.volume = volume;
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

    const events = [
      'encrypted',
      'ended',
      'error',
      'loadeddata',
      'loadedmetadata',
      'loadstart',
      'pause',
      'play',
      'playing',
      'progress',
      'ratechange',
      'seeked',
      'seeking',
      'stalled',
      'suspend',
      'timeupdate',
      'volumechange',
      'waiting'
    ];
  
    const onEvent = (eventString) => {
      console.log(`MediaElement Event: ${eventString}`);
    };
  
    /*
    // USEFUL TOR DEBUGGING - LISTEN TO ALL EVENTS

    events.forEach(event => {
      audio.addEventListener(event, () => onEvent(event));
    });
    */


    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onStateChange]);

  useEffect(() => {
    if (getPlaybackControlRef) {
      getPlaybackControlRef({
        play: () => audioRef.current?.play().catch(error => {
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
    }
  }, [getPlaybackControlRef]);

  return (
    <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
      <audio ref={audioRef} style={{ width: '100%' }} controls={showControls} />
    </Box>
  );
};

export default React.memo(AudioPlayer);