import React, { useState, useEffect, memo } from 'react';
import {
  Fab,
  Zoom,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Menu,
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import { useSpeechDetection } from './useSpeechDetection';
import { PrettyElapsedTime } from '@src/common/date';
import SettingsIcon from '@mui/icons-material/Settings';
import { useConfig } from '@src/client/configprovider';

export const SpeechRecorder = memo((props) => {
  const { Constants } = useConfig();
  const { disableListening, debug = false } = props;
  const [isMuted, setIsMuted] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState([]);
  const [selectedBlob, setSelectedBlob] = useState('');
  const [audioDuckingMode, setAudioDuckingMode] = useState(Constants.audioRecordingDefaults.audioDuckingMode || 'on_speaking');
  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    updateListeningState();
  }, [disableListening, isMuted]);

  const onSpeechBlob = (encodedBlob) => {
    if (debug) {
      setAudioBlobs(prevBlobs => [
        { blob: encodedBlob, timestamp: Date.now() },
        ...prevBlobs.slice(0, 9)
      ]);
    }
    props.onRecordingComplete?.(encodedBlob);
  }

  const speechDetection = useSpeechDetection({
    onlyRecordOnSpeaking: Constants.audioRecordingDefaults.onlyRecordOnSpeaking,
    continuousRecording: Constants.audioRecordingDefaults.continuousRecording,
    echoCancellation: Constants.audioRecordingDefaults.echoCancellation,
    onSpeechDataBlobAvailable: onSpeechBlob,
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

  const updateListeningState = () => {
    const shouldListen = !isMuted && !disableListening;
    console.log("toggleListening ", isListening, " -> ", shouldListen);
    if (shouldListen == isListening) {
      return;
    }
    if (shouldListen) {
      speechDetection.startRecording();
    } else {
      speechDetection.stopRecording();
    }
    setIsListening(shouldListen);
  };

  const playSelectedBlob = () => {
    if (selectedBlob) {
      const audio = new Audio(URL.createObjectURL(selectedBlob));
      audio.play();
    }
  };
  
  const handleSettingsClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleSettingsClose = () => {
    setAnchorEl(null);
  };

  const handleAudioDuckingModeChange = (mode) => {
    setAudioDuckingMode(mode);
    handleSettingsClose();
  };

  return (
    <div>
      {typeof window !== 'undefined' && (
        <Box>
          <Zoom in={true}>
            <Fab
              color={isMuted ? 'secondary' : 'primary'}
              aria-label="record"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOffIcon /> : <MicIcon />}
            </Fab>
          </Zoom>
          
          {debug && audioBlobs.length > 0 && (
            <Box mt={2}>
              <FormControl fullWidth>
                <InputLabel id="audio-blob-select-label">Select Audio Blob</InputLabel>
                <Select
                  labelId="audio-blob-select-label"
                  id="audio-blob-select"
                  value={selectedBlob}
                  label="Select Audio Blob"
                  onChange={(e) => setSelectedBlob(e.target.value)}
                >
                  {audioBlobs.map((item, index) => (
                    <MenuItem key={index} value={item.blob}>
                      {`Recording ${index + 1} (${PrettyElapsedTime((new Date()) - item.timestamp)}) ago`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button 
                variant="contained" 
                onClick={playSelectedBlob} 
                disabled={!selectedBlob}
                sx={{ mt: 1 }}
              >
                Play Selected
              </Button>
            </Box>
          )}
          <IconButton
            size="small"
            onClick={handleSettingsClick}
            sx={{ ml: 1 }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleSettingsClose}
          >
            <MenuItem 
              onClick={() => handleAudioDuckingModeChange('off')}
              selected={audioDuckingMode === 'off'}
            >
              Ducking Off
            </MenuItem>
            <MenuItem 
              onClick={() => handleAudioDuckingModeChange('on_speaking')}
              selected={audioDuckingMode === 'on_speaking'}
            >
              Ducking On Speaking
            </MenuItem>
            <MenuItem 
              onClick={() => handleAudioDuckingModeChange('always_on')}
              selected={audioDuckingMode === 'always_on'}
            >
              Ducking Always On
            </MenuItem>
          </Menu>
        </Box>
      )}
    </div>
  );
});

export default SpeechRecorder;