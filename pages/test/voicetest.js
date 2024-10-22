import React, { useState, useRef, useEffect } from 'react';
import { Button, Box, Typography, FormControlLabel, Switch, TextField,
  Select, 
  MenuItem,
  FormControl,
  InputLabel,
 } from '@mui/material';
import { useSpeechDetection } from '@src/client/components/useSpeechDetection';
import { useConfig } from '@src/client/configprovider';

export default function VoiceTest(props) {
  const { Constants } = useConfig();
  const [encodedBlob, setencodedBlob] = useState(null);
  const [debugInfo, setDebugInfo] = useState(); // New state variable for debug info
  const encodedAudioRef = useRef(null);
  const [listenState, setListenState] = useState(false);
  const [onlyRecordOnSpeaking, setOnlyRecordOnSpeaking] = useState(true);


  //State variables
  const [timeSlice, setTimeSlice] = useState(Constants.audioRecordingDefaults.timeSlice);
  const [speechInterval, setSpeechInterval] = useState(Constants.audioRecordingDefaults.speechInterval);
  const [speechThreshold, setSpeechThreshold] = useState(Constants.audioRecordingDefaults.speechThreshold);
  const [silenceTimeout, setSilenceTimeout] = useState(Constants.audioRecordingDefaults.silenceTimeout);
  const [speechDetectMode, setSpeechDetectMode] = useState(Constants.audioRecordingDefaults.speechDetectMode);
  const [minimumSpeechDuration, setMinimumSpeechDuration] = useState(Constants.audioRecordingDefaults.minimumSpeechDuration);
  const [audioDuckingControl, setAudioDuckingControl] = useState(Constants.audioRecordingDefaults.audioDuckingControl || 'on_speaking');
  const [echoCancellation, setEchoCancellation] = useState(Constants.audioRecordingDefaults.echoCancellation);
  const [audioSessionType, setAudioSessionType] = useState(Constants.audioRecordingDefaults.audioSessionType || 'play-and-record');

  console.log("Constants.audioRecordingDefaults: ", Constants.audioRecordingDefaults);
  // All the states above
  console.log("timeSlice: ", timeSlice);
  console.log("speechInterval: ", speechInterval);
  console.log("speechThreshold: ", speechThreshold);
  console.log("silenceTimeout: ", silenceTimeout);
  console.log("speechDetectMode: ", speechDetectMode);
  console.log("minimumSpeechDuration: ", minimumSpeechDuration);
  console.log("audioDuckingControl: ", audioDuckingControl);
  console.log("echoCancellation: ", echoCancellation);
  console.log("audioSessionType: ", audioSessionType);


  const { recording, speaking, listeningForSpeech, mostRecentSpeakingDuration, longestSilenceDuration, soundDetected, audioInfo, startRecording, stopRecording } = useSpeechDetection({
    onlyRecordOnSpeaking: onlyRecordOnSpeaking,
    continuousRecording: true,
    debug: true,
    audioDuckingControl: audioDuckingControl,
    echoCancellation: echoCancellation,
    onSpeechDataBlobAvailable: (blob, debugInfo) => {
      setencodedBlob(blob);
      setDebugInfo(debugInfo); // Set debug info
    },
    // Add new parameters
    timeSlice: Number(timeSlice),
    speechInterval: Number(speechInterval),
    speechThreshold: Number(speechThreshold),
    silenceTimeout: Number(silenceTimeout),
    speechDetectMode: speechDetectMode,
    minimumSpeechDuration: Number(minimumSpeechDuration),
  });


  const renderAudioInfo = () => {
    // print every field of audioInfo, with line breaks between each field
    // that will show up correctly in Typography
    if (!audioInfo) return null;
    
    return Object.keys(audioInfo).map((field) => (
      <Typography key={`${field}`}>
        {`${field}: ${audioInfo[field]}`}
      </Typography>
    ));
  }

  const handleRecordToggle = () => {
    if (listenState) {
      stopRecording();
    } else {
      setencodedBlob(null);
      setDebugInfo(null); 
      startRecording();
    }
    setListenState(!listenState);
  };

  const playAudio = (audioRef, blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      audioRef.current.play();
    }
  };

  const handleOnlyRecordOnSpeakingToggle = (event) => {
    setOnlyRecordOnSpeaking(event.target.checked);
  };

  // New handlers for parameter changes
  const handleTimeSliceChange = (event) => {
    setTimeSlice(event.target.value);
  };

  const handleSpeechIntervalChange = (event) => {
    setSpeechInterval(event.target.value);
  };

  const handleSpeechThresholdChange = (event) => {
    setSpeechThreshold(event.target.value);
  };

  const handleSilenceTimeoutChange = (event) => {
    setSilenceTimeout(event.target.value);
  };

  const handleSpeechDetectModeChange = (event) => {
    setSpeechDetectMode(event.target.value);
  };

  const handleMinimumSpeechDurationChange = (event) => {
    setMinimumSpeechDuration(event.target.value);
  };

  const handleAudioDuckingControlChange = (event) => {
    setAudioDuckingControl(event.target.value);
  };

  const handleEchoCancellationChange = (event) => {
    setEchoCancellation(event.target.checked);
  }

  const handleAudioSessionTypeChange = (event) => {
    setAudioSessionType(event.target.value);
  }


  return (
    <Box sx={{ p: 4, backgroundColor: 'white' }}>
      <Typography variant="h4" gutterBottom>
        Voice Recording Test
      </Typography>

      <Button
        variant="contained"
        onClick={handleRecordToggle}
        sx={{ mb: 2 }}
        color={listenState ? 'secondary' : 'primary'}
      >
        {listenState ? 'Stop Recording' : 'Start Recording'}
      </Button>
      <FormControlLabel
        control={
          <Switch
            checked={onlyRecordOnSpeaking}
            onChange={handleOnlyRecordOnSpeakingToggle}
            name="onlyRecordOnSpeaking"
          />
        }
        label="Only Record On Speaking"
        sx={{ mb: 2, display: 'block' }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={echoCancellation}
            onChange={handleEchoCancellationChange}
            name="echoCancellation"
          />
        }
        label="Custom Echo Cancellation"
        sx={{ mb: 2 }}
      />

      {/* New input fields for speech detection parameters */}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Time Slice (ms)"
          type="number"
          value={timeSlice}
          onChange={handleTimeSliceChange}
          sx={{ mr: 2 }}
        />
        <TextField
          label="Speech Interval (ms)"
          type="number"
          value={speechInterval}
          onChange={handleSpeechIntervalChange}
          sx={{ mr: 2 }}
        />
        <TextField
          label="Speech Threshold (dB)"
          type="number"
          value={speechThreshold}
          onChange={handleSpeechThresholdChange}
          sx={{ mr: 2 }}
        />
        <TextField
          label="Silence Timeout (ms)"
          type="number"
          value={silenceTimeout}
          onChange={handleSilenceTimeoutChange}
          sx={{ mr: 2 }}
        />
        <TextField
          label="Minimum Speech Duration (ms)"
          type="number"
          value={minimumSpeechDuration}
          onChange={handleMinimumSpeechDurationChange}
          sx={{ mr: 2 }}
        />
        <Select
          value={speechDetectMode}
          onChange={handleSpeechDetectModeChange}
          displayEmpty
          sx={{ minWidth: 120, mr: 2 }}
          key="speechDetect"
        >
          <MenuItem value="hark">Hark</MenuItem>
          <MenuItem value="vad">VAD</MenuItem>
        </Select>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="audio-ducking-control-label">Ducking</InputLabel>
          <Select
            labelId="audio-ducking-control-label"
            id="audio-ducking-control"
            value={audioDuckingControl}
            onChange={handleAudioDuckingControlChange}
            label="Ducking"
          >
            <MenuItem value="off">Off</MenuItem>
            <MenuItem value="on_speaking">On Speaking</MenuItem>
            <MenuItem value="always_on">Always On</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="audio-session-type-label">Audio Session Type</InputLabel>
          <Select
            labelId="audio-session-type-label"
            id="audio-session-type"
            value={audioSessionType}
            onChange={handleAudioSessionTypeChange}
            label="Audio Session Type"
          >
            <MenuItem value="playback">Playback</MenuItem>
            <MenuItem value="transient">Transient</MenuItem>
            <MenuItem value="transient-solo">Transient Solo</MenuItem>
            <MenuItem value="ambient">Ambient</MenuItem>
            <MenuItem value="play-and-record">Play and Record</MenuItem>
            <MenuItem value="auto">Auto</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ my: 2 }}>
        <Typography variant="h6" gutterBottom key="status">
          Status
        </Typography>
        <Typography key="listening">
          Listening for Speech: {listeningForSpeech ? 'Yes' : 'No'}
        </Typography>
        <Typography key="sounddetected">
          Sound Detected: {soundDetected ? 'Yes' : 'No'}
        </Typography>
        <Typography key="speaking">
          Speaking: {speaking ? 'Yes' : 'No'}
        </Typography>
        <Typography key="recording">
          Recording: {recording ? 'Yes' : 'No'}
        </Typography>
        <Typography key="mostRecentSpeakingDuration">
          Most Recent Speaking Duration: {mostRecentSpeakingDuration ? `${mostRecentSpeakingDuration} ms (${(mostRecentSpeakingDuration / 1000).toFixed(2)} s)` : ''}
        </Typography>
        <Typography key="longestSilenceDuration">
          Longest Silence Duration: {longestSilenceDuration ? `${longestSilenceDuration} ms (${(longestSilenceDuration / 1000).toFixed(2)} s)` : ''}
        </Typography>
      </Box>


      <Box sx={{ my: 2 }}>
        <Typography key="chunks">
          Chunks: {debugInfo ? `${debugInfo.chunkCount}` : ''}
        </Typography>
        <Typography key="duration">
          Duration: {debugInfo ? `${debugInfo.duration} ms (${(debugInfo.duration / 1000).toFixed(2)} s)` : ''}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => playAudio(encodedAudioRef, encodedBlob)}
          disabled={!encodedBlob}
        >
          Play encoded
        </Button>
      </Box>

      <Box sx={{ my: 2 }}>
        <Typography variant="h6" gutterBottom> 
          Audio Info
        </Typography>
        {renderAudioInfo()}
      </Box>

      <audio ref={encodedAudioRef} />
    </Box>
  );
}
