import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, Box, Slider, Typography } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';

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
  }

  const cleanupAudioContext = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

 
  const cleanupAudio = () => {
    debug && console.log('WAP: Cleaning up audio');
    unloadAudioBuffer();
    cleanupAudioContext();
  };

  useEffect(() => {
    return cleanupAudio;
  }, []);

  const initAudioContext = () => {
    debug && console.log('WAP: initAudioContext - need intialization?', (!audioContextRef.current || audioContextRef.current.state === 'closed') ? 'Yes' : 'No');
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        debug && console.log('WAP: Initializing audio context');
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    debug && console.log('WAP: Init succeeded?', audioContextRef.current.state !== 'closed');
    return audioContextRef.current.state !== 'closed';
  };

  const getFinalAudioURL = async (sourceToTry) => {
    if (sourceToTry.source === 'storage') {
      const blob = await callGetBlob(sessionID, sourceToTry.data);
      return URL.createObjectURL(blob);
    } else if (sourceToTry.source === 'url') {
      try {
        let result = await fetch(sourceToTry.data, { method: 'HEAD' });
        if (result.ok) return sourceToTry.data;
      } catch (error) {
        try {
          const secondURLtoTry = 'https://playday.ai' + sourceToTry.data;
          let result = await fetch(secondURLtoTry, { method: 'HEAD' });
          if (result.ok) return secondURLtoTry;
        } catch (error) {
          // Do nothing
        }
      }
    }
    return null;
  };

  const loadAudio = async (url) => {
    debug && console.log('WAP: Loading audio:', url);
    try {
      const contextInitialized = initAudioContext();
      if (!contextInitialized) {
        throw new Error('Failed to initialize audio context');
      }
      if (!audioContextRef.current) {
        throw new Error('Audio context is null after initialization');
      }

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      
      
      const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      setDuration(decodedBuffer.duration);
      setAudioSrc(url);
    } catch (error) {
      console.log('WAP: Error initializing audio context:', error);
      onBrowserBlockedPlayback?.(error);
      return false;
    }
  };

  const playAudioInternal = async () => {
    debug && console.log('WAP: Playing audio');
    debug && console.log('WAP: Play: Audio buffer:', audioBuffer);
    debug && console.log('WAP: Play: Audio context:', audioContextRef.current);
    debug && console.log('WAP: Play: Audio Context state:', audioContextRef.current?.state);
    
    try {

      if (audioSrc && !audioBuffer) {
        await loadAudio(audioSrc);
      }

      if (!hasEverBeenUserInitiated.current) {
        onBrowserBlockedPlayback?.(new Error('Playback was not initiated by user'));
        return;
      }


      if (audioContextRef.current.state === 'suspended') {
        debug && console.log('WAP: Resuming audio context');
        const result = await audioContextRef.current.resume();
        debug && console.log('WAP: Resumed audio context:', result);
      }
  
      unloadAudioBuffer();

      debug && console.log('WAP: Playing the audio');

      sourceNodeRef.current = audioContextRef.current.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;
      sourceNodeRef.current.connect(gainNodeRef.current);
  
      debug && console.log('WAP: Setting volume to', volume);
      debug && console.log('WAP: Setting playback speed to', playbackSpeed);
      sourceNodeRef.current.playbackRate.value = playbackSpeed;
      gainNodeRef.current.gain.value = volume;
  
      const offset = pausedAtRef.current;
      sourceNodeRef.current.start(0, offset);
      startTimeRef.current = audioContextRef.current.currentTime - offset;
      setIsPlaying(true);
      onStateChange?.('playing');
  
      sourceNodeRef.current.onended = () => {
        setIsPlaying(false);
        onStateChange?.('stopped');
      };

      sourceNodeRef.current.onpause = () => {
        setIsPlaying(false);
        onStateChange?.('paused');
      }

      sourceNodeRef.current.onplay = () => {
        setIsPlaying(true);
        onStateChange?.('playing');
      }   

    } catch (error) {
      console.log('PLAY: Error playing audio:', error);
      onBrowserBlockedPlayback?.(error);
    }
  };

    const playAudio = () => {
        hasEverBeenUserInitiated.current = true;
        playAudioInternal();
    };

  const stopAudio = () => {
    debug && console.log('WAP: Stopping audio');
    pausedAtRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const seekAudio = (time) => {
      debug && console.log('WAP: Seeking audio to', time);
      pausedAtRef.current = time;
      setCurrentTime(time);
      if (isPlaying) {
        playAudio();
      }
  };

  const pauseAudio = () => {
    debug && console.log('WAP: Pausing audio');
    if (sourceNodeRef.current) {
      const currentOffset = audioContextRef.current.currentTime - startTimeRef.current;
      pausedAtRef.current = currentOffset;
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    if (source) {
      debug && console.log('WAP: Source changed:', source);
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
      debug && console.log('WAP: Setting volume to', volume);
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (sourceNodeRef.current) {
      debug && console.log('WAP: Setting playback speed to', playbackSpeed);
      sourceNodeRef.current.playbackRate.value = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    let rafId;
    const updateTime = () => {
      if (isPlaying && audioContextRef.current) {
        setCurrentTime(audioContextRef.current.currentTime - startTimeRef.current);
        rafId = requestAnimationFrame(updateTime);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(updateTime);
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

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
  }, [audioBuffer]);

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      {showControls && (
        <>
          <Button
            onClick={isPlaying ? pauseAudio : playAudio}
            sx={{ color: buttonColor }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </Button>
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: textColor }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
          </Box>
        </>
      )}
      {!showControls && (
        <audio src={audioSrc} style={{ display: 'none' }} />
      )}
    </Box>
  );
};

const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default React.memo(WebAudioPlayer);