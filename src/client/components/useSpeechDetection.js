import React, { useEffect, useRef, useState, memo } from 'react';
import lamejs from '@breezystack/lamejs';
import { SpeechDetector } from '../speechdetector';


export const defaultSpeechRecorderConfig = {
  continuousRecording: false,
  onlyRecordOnSpeaking: true,
  echoCancellation: true,
  onSpeechDataBlobAvailable: undefined,
  timeSlice: 500,
  speechInterval: 40,
  speechThreshold: -60,
  silenceTimeout: 500,
  minimumSpeechDuration: 200,
  speechDetectMode: 'hark',
  debug: false,
  audioDuckingControl: 'on_speaking',
  audioSessionType: 'play-and-record',
  audioSessionChangeDelay: 200,
}

export const useSpeechDetection = (config = {}) => {
if (typeof window === 'undefined') {
    // Early return or mock the hook's API if on the server
    return {
    recording: false,
    speaking: false,
    startRecording: () => {},
    stopRecording: () => {},
    };
}

  const {
    onlyRecordOnSpeaking,
    continuousRecording,
    echoCancellation,
    timeSlice,
    onSpeechDataBlobAvailable,
    speechInterval,
    speechThreshold,
    silenceTimeout,
    debug,
    speechDetectMode,
    minimumSpeechDuration,
    audioDuckingControl,
    audioSessionType,
    audioSessionChangeDelay,
  } = {
    ...defaultSpeechRecorderConfig,
    ...config,
  }
  const chunks = useRef([])
  const listener = useRef()
  const recorder = useRef()
  const stream = useRef()
  const speakingRef = useRef(false)
  const header = useRef(undefined)
  const finalDataCallbackTimeout = useRef(undefined)
  const [speaking, setSpeaking] = useState(false)
  const [listeningForSpeech, setListeningForSpeech] = useState(false)
  const [recording, setRecording] = useState(false)
  const [soundDetected, setSoundDetected] = useState(false)
  const [wavRecorderRegistered, setWavRecorderRegistered] = useState(false)
  const ExtendableMediaRecorder = useRef(undefined);
  const [audioInfo, setAudioInfo] = useState({})
  const speechTimer = useRef(null);
  const silenceTimer = useRef(null);
  const tempChunks = useRef([]);
  const silenceStartTime = useRef(null);
  const waitingForFinalChunk = useRef(false);

  /* 
    speakingState can be one of the following states:
    'no_speech': no speaking detected
    'waiting_for_min_duration': speaking detected, waiting for minimum duration
    'speaking': speaking active, minimum duration met
    'waiting_for_silence_timeout': speaking stopped, waiting to see if it resumes
    'getting_final_chunk': speaking stopped, waiting for final chunk
  */
  const speakingStateRef = useRef('no_speech'); 

  // Measuring speaking duration
  const [mostRecentSpeakingDuration, setMostRecentSpeakingDuration] = useState(0)
  const currentSpeakingStartTime = useRef(null);

  // Measuring silence duration
  const [longestSilenceDuration, setLongestSilenceDuration] = useState(0)
  const localLongestSilenceDuration = useRef(0);
 
  const setSpeakingState = (state) => {
    debug && console.log(`Speaking state: ${speakingStateRef.current} -> ${state}`);
    speakingStateRef.current = state;
  };

  const resetChunks = () => {
    chunks.current = [];
    tempChunks.current = [];
  }
  
  const cleanup = async () => {
    debug && console.log("cleanup")
    if (recorder.current) {
      await onStopRecording();
    }
    if (stream.current) {
      onStopStreaming();
    }
    setSpeaking(false);
    setListeningForSpeech(false);
    setRecording(false);
    resetChunks();
    cancelSilenceTimer();
    cancelSpeechTimer();
    cancelFinalDataCallback();
  };
  
  useEffect(() => {
    const init = async () => {
    if (typeof window != "undefined") {
        debug && console.log("useSpeechDetection: Init")
        if (!ExtendableMediaRecorder.current) {
          try {
            const EMR = await import('extendable-media-recorder');
            ExtendableMediaRecorder.current = EMR.MediaRecorder;

            if (!wavRecorderRegistered) {

              const { connect } = await import('extendable-media-recorder-wav-encoder');

              await EMR.register(await connect());
              setWavRecorderRegistered(true);
            }


            if (audioDuckingControl === 'always_on') {
              if ('audioSession' in navigator) {
                debug && console.log(`Setting audio session type to '${audioSessionType}'`)
                navigator.audioSession['type'] = audioSessionType;
              }
            }

          } catch (e) {
            // Do nothing
          }
        }
      }
    };

    init();

    return () => {
      cleanup();
    }
  }, []);
  


  /**
   * start speech recording and start listen for speaking event
   */
  const startRecording = async () => {
    await onStartRecording()
  }


const setFinalDataCallback = () => {
  cancelFinalDataCallback();

  // Set a timer in case onDataAvailable isn't called again
  finalDataCallbackTimeout.current = setTimeout(async () => {
    debug && console.log("Final data callback timeout")
    setSpeakingState('no_speech');
    await onSendSpeechData();
  }, timeSlice * 2); // Wait for double the timeSlice duration
};

const cancelFinalDataCallback = () => {
  if (finalDataCallbackTimeout.current) {
    debug && console.log("Cancel final data callback")
    clearTimeout(finalDataCallbackTimeout.current);
    finalDataCallbackTimeout.current = undefined;
  }
};

  /**
   * stop speech recording 
   */
  const stopRecording = async () => {
    if ((!onlyRecordOnSpeaking || speakingRef.current) && chunks.current.length > 0) {
      waitingForFinalChunk.current = true;
      setSpeakingState('getting_final_chunk');
      setFinalDataCallback();
    } else {
      await onStopRecording();
    }
  }

  // Function to get the microphone stream
  async function getMicrophoneSource(audioContext) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSource = audioContext.createMediaStreamSource(micStream);
      return micSource;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  // Function to get the speaker stream
  async function getSpeakerSource(audioContext) {
    try {
      console.log("AudioContext: ", audioContext)
      const speakerStream = await navigator.mediaDevices.getUserMedia({
        audio: { mediaSource: 'audioCapture' },
      });
      const speakerSource = audioContext.createMediaStreamSource(speakerStream);
      return speakerSource;
    } catch (error) {
      console.error('Error accessing speaker:', error);
      throw error;
    }
  }

  // Main function to set up echo cancellation
  async function setupEchoCancellation() {
    try {

      // Create an audio context
      const audioContext = new (AudioContext || webkitAudioContext)();

      console.log("Getting mic source")
      const micSource = await getMicrophoneSource(audioContext);
      console.log("Getting speaker source")
      const speakerSource = await getSpeakerSource(audioContext);

      console.log("Attempting to set up echo cancellation")

      // Create a delay node to account for system latency
      const delay = audioContext.createDelay(1); // Max delay of 1 second
      delay.delayTime.value = 0.05; // 50ms delay, adjust as needed

      // Create a gain node for the inverted speaker signal
      const invertedSpeaker = audioContext.createGain();
      invertedSpeaker.gain.value = -1;

      console.log("Connecting nodes")

      // Create an analyzer node for adaptive filtering
      const analyzerMic = audioContext.createAnalyser();
      const analyzerSpeaker = audioContext.createAnalyser();

      // Connect the nodes
      speakerSource.connect(delay);
      delay.connect(invertedSpeaker);
      delay.connect(analyzerSpeaker);

      micSource.connect(analyzerMic);

      // Create a worklet for adaptive filtering
      await audioContext.audioWorklet.addModule('/js/adaptive-filter-worklet.js');

      const adaptiveFilter = new AudioWorkletNode(audioContext, 'adaptive-filter', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      });
      
      adaptiveFilter.port.onmessage = (event) => {
        if (event.data.type === 'stableLatencyAchieved') {
          console.log(`Stable latency achieved: ${event.data.latency} samples`);

          startListeningForSpeech();
        }
      };

      // Connect the analyzed signals to the adaptive filter
      analyzerMic.connect(adaptiveFilter, 0, 0);
      analyzerSpeaker.connect(adaptiveFilter, 0, 1);

      // Create the output
      const output = audioContext.createMediaStreamDestination();
      adaptiveFilter.connect(output);

      // Use the output as the new audio source
      const newStream = new MediaStream([output.stream.getAudioTracks()[0]]);

      return newStream;
    } catch (error) {
      console.error('Error setting up echo cancellation:', error);
      throw error;
    }
  }


  /*
    * Delay speech detection until the audio session change has taken effect
  */

  /**
   * get user media stream event
   * - try to stop all previous media streams
   * - ask user for media stream with a system popup
   * - register hark speaking detection listeners
   */
  const onStartStreaming = async () => {
    debug && console.log("onStartStreaming")

    try {
      if (stream.current) {
        onStopStreaming();
      }
      
      header.current = undefined;
      
      setSpeakingState('no_speech');
      
      let audioSessionChangeOccurred = false;
      if (audioDuckingControl === 'on_speaking') {
        if ('audioSession' in navigator) {
          //
          // If we're changing the audio session type, we need to wait for the change to take effect
          // before starting the speech detector. 
          //
          const start = Date.now();
          
          navigator.audioSession.onstatechange = () => {
            debug && console.log(`Audio session state change: ${navigator.audioSession.state}`);

            if (navigator.audioSession.state === "active") {
              const end = Date.now();
              debug && console.log(`Audio session activated after ${end - start}ms`);
              navigator.audioSession.removeEventListener('statechange', onStateChange);

              startListeningForSpeech();
            }
          };
          
          navigator.audioSession['type'] = audioSessionType;
          audioSessionChangeOccurred = true;
          debug && console.log(`Audio session type set to '${audioSessionType}' -- waiting for state change to occur`);
        }
      }
        
      if (echoCancellation) {
        debug && console.log("Setting up echo cancellation");

        stream.current = await setupEchoCancellation();
      } else {
        debug && console.log("Skipping echo cancellation");

        stream.current = await navigator.mediaDevices.getUserMedia({ audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }, 
        video: false});
      }

      if (!audioSessionChangeOccurred) {
        startListeningForSpeech();
      }
      
      debug && console.log("Stream active:", stream.current.active);
      if (debug) {
        let trackInfo = stream.current.getAudioTracks();
        if (Array.isArray(trackInfo) && trackInfo.length > 0) {
          trackInfo = trackInfo[0];
        }
        console.log("Audio Info: ", trackInfo);
        const audioInfoToSet = {
          contentHint: trackInfo.contentHint,
          enabled: trackInfo.enabled,
          id: trackInfo.id,
          kind: trackInfo.kind,
          label: trackInfo.label,
          muted: trackInfo.muted,
          readyState: trackInfo.readyState
        }
        setAudioInfo(audioInfoToSet);
      }

    } catch (err) {
      console.error(err)
      reject(err);
    }
  }

  const startListeningForSpeech = () => {

    debug && console.log("Initializing speech detector")
    listener.current = new SpeechDetector({debug, mode: speechDetectMode});
    listener.current.start({
      stream: stream.current,
      speechInterval: speechInterval,
      speechThreshold: speechThreshold,
      silenceTimeout: silenceTimeout,
      minimumSpeechDuration: minimumSpeechDuration,
      speechDetectMode: speechDetectMode,
      onSpeechStart: onStartSpeaking,
      onSpeechEnd: onStopSpeaking,
      onSoundDetected: debug ? (detected) => {
        setSoundDetected(detected);
      } : null,
    });
    setListeningForSpeech(true);
  }

  const startSpeechTimer = () => {
    cancelSpeechTimer();
    speechTimer.current = setTimeout(() => {
      debug && console.log("Minimum speech duration met")
      if (!speakingRef.current) {
        speakingRef.current = true;
        setSpeakingState('speaking');
        setSpeaking(true);
        if (onlyRecordOnSpeaking) {
          setRecording(true);
        }
      }
    }, minimumSpeechDuration);
  };

  const cancelSpeechTimer = () => { 
    if (speechTimer.current) {
      debug && console.log("Cancel speech timer")
      clearTimeout(speechTimer.current);
      speechTimer.current = null;
    }
  };

  const onSilenceTimeout = () => {
    debug && console.log("Silence timeout")
    if (speakingRef.current) {
      speakingRef.current = false;
      setSpeaking(false);
      if (onlyRecordOnSpeaking) {
        setRecording(false);
      }
    }
    waitingForFinalChunk.current = true;
    setSpeakingState('getting_final_chunk');
    setFinalDataCallback();

    // Discard temporary chunks
    tempChunks.current = [];

    silenceStartTime.current = null;
  };

  const startSilenceTimer = () => {
    cancelSilenceTimer();
    silenceStartTime.current = Date.now();
    silenceTimer.current = setTimeout(() => {
      onSilenceTimeout();
    }, silenceTimeout);
  };

  const cancelSilenceTimer = () => {
    if (silenceTimer.current) {
      debug && console.log("Cancel silence timer")
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    silenceStartTime.current = null;
  };
 

  const updateLongestSilence = () => {
    if (silenceStartTime.current) {
      const currentSilenceDuration = Date.now() - silenceStartTime.current;
      debug && console.log("Silence duration:", currentSilenceDuration);
      if (currentSilenceDuration > localLongestSilenceDuration.current) {
        localLongestSilenceDuration.current = currentSilenceDuration;
        setLongestSilenceDuration(currentSilenceDuration);
      }
    }
  };
  

  const processSpeechEvent = (isSpeaking) => {
    const currentTime = Date.now();
    if (isSpeaking) {
      if (currentSpeakingStartTime.current === null) {
        currentSpeakingStartTime.current = currentTime;
      }
  
      switch (speakingStateRef.current) {
        case 'no_speech':
          startSpeechTimer();
          setSpeakingState('waiting_for_min_duration');
          break;
        case 'waiting_for_silence_timeout':
          cancelSilenceTimer();
          if (tempChunks.current.length > 0) {
            chunks.current = [...chunks.current, ...tempChunks.current];
            tempChunks.current = [];
          }
          updateLongestSilence();
          setSpeakingState('speaking');
          break;
        case 'getting_final_chunk':
          waitingForFinalChunk.current = false;
          cancelFinalDataCallback();
          setSpeakingState('speaking');
          break;
      }
    } else {
      if (currentSpeakingStartTime.current !== null) {
        const speakingDuration = currentTime - currentSpeakingStartTime.current;
        debug && console.log("Speaking duration:", speakingDuration);
        setMostRecentSpeakingDuration(speakingDuration);
        currentSpeakingStartTime.current = null;
      }
  
      switch (speakingStateRef.current) {
        case 'waiting_for_min_duration':
          cancelSpeechTimer();
          setSpeakingState('no_speech');
          break;
        case 'speaking':
          startSilenceTimer();
          setSpeakingState('waiting_for_silence_timeout');
          break;
      }
    }
  };

  const onStartSpeaking = () => {
    debug && console.log('start speaking');
    processSpeechEvent(true);
  };

  /**
   * start speech recording event
   * - first ask user for media stream
   * - check recorder state and start or resume recorder accordingly
   * - start timeout for stop timeout config
   * - update recording state to true
   */
  const onStartRecording = async () => {
    debug && console.log("onStartRecording")
    try {
      await cleanup();  // Call the cleanup function we defined earlier
      
      setLongestSilenceDuration(0);
  
      await onStartStreaming();     

      if (stream.current) {

        resetChunks();
      
        const options = {
          mimeType: 'audio/wav',
          audioBitsPerSecond: 128000,
        };

        recorder.current = new ExtendableMediaRecorder.current(stream.current, options);
        recorder.current.ondataavailable = (event) => onDataAvailable(event.data);

        recorder.current.start(timeSlice); // Collect data in chunks of 100ms

        if (!onlyRecordOnSpeaking) {
          setRecording(true);
        }
        debug && console.log("Recording! timeSlice=", timeSlice);
      }
    } catch (err) {
      console.error(err)
    }
  }


  /**
   * user stop speaking event
   * - set speaking state to false
   * - start stop timeout back
   */

  const onStopSpeaking = () => {
    debug && console.log('stop speaking');
    processSpeechEvent(false);
  };

  /**
   * stop speech recording event
   * - if recorder state is recording, stop the recorder
   * - stop user media stream
   * - clear stop timeout
   * - set recording state to false
   */
  const onStopRecording = async () => {
    debug && console.log("onStopRecording")
    try {

      if (recorder.current) {
        debug && console.log("Stopping recorder")
        const defunctRecorder = recorder.current;
        recorder.current = undefined;
        await defunctRecorder.stop();
        
        resetChunks();
        setRecording(false)
      }
      
      onStopStreaming()

    } catch (err) {
      console.error(err)
    }
  }

  /**
   * stop media stream event
   * - remove hark speaking detection listeners
   * - stop all media stream tracks
   * - clear media stream from ref
   */
  const onStopStreaming = () => {
    debug && console.log("onStopStreaming")
    if (listener.current) {
        listener.current.stop();
        listener.current = undefined;
    }

    if (stream.current) {
        stream.current.getTracks().forEach(track => {
            try {
                track.stop();
                stream.current.removeTrack(track);
            }
            catch (e) {
                console.error("Error stopping track:", e);
            }
        });

        // Check if audioSession exists before trying to use it
        if (audioDuckingControl === 'on_speaking' && 'audioSession' in navigator) {
            debug && console.log("Setting audio session type to 'playback'")
            navigator.audioSession['type'] = 'playback';
        }
        stream.current = undefined;
    }

    setSpeakingState('no_speech');
    speakingRef.current = false;
    currentSpeakingStartTime.current = null;
    setListeningForSpeech(false)
    setSpeaking(false)
}

  function printWavHeader(chunk) {
    if (!(chunk instanceof Uint8Array) && !(chunk instanceof ArrayBuffer)) {
      console.error('Input must be a Uint8Array or ArrayBuffer');
      return;
    }
  
    const view = new DataView(chunk instanceof ArrayBuffer ? chunk : chunk.buffer);
  
    try {
      const chunkId = String.fromCharCode(...new Uint8Array(view.buffer.slice(0, 4)));
      const chunkSize = view.getUint32(4, true);
      const format = String.fromCharCode(...new Uint8Array(view.buffer.slice(8, 12)));
      const subchunk1Id = String.fromCharCode(...new Uint8Array(view.buffer.slice(12, 16)));
      const subchunk1Size = view.getUint32(16, true);
      const audioFormat = view.getUint16(20, true);
      const numChannels = view.getUint16(22, true);
      const sampleRate = view.getUint32(24, true);
      const byteRate = view.getUint32(28, true);
      const blockAlign = view.getUint16(32, true);
      const bitsPerSample = view.getUint16(34, true);
      const subchunk2Id = String.fromCharCode(...new Uint8Array(view.buffer.slice(36, 40)));
      const subchunk2Size = view.getUint32(40, true);
  
      console.log('WAV Header Information:');
      console.log(`Chunk ID: ${chunkId}`);
      console.log(`Chunk Size: ${chunkSize}`);
      console.log(`Format: ${format}`);
      console.log(`Subchunk1 ID: ${subchunk1Id}`);
      console.log(`Subchunk1 Size: ${subchunk1Size}`);
      console.log(`Audio Format: ${audioFormat} (1 = PCM)`);
      console.log(`Number of Channels: ${numChannels}`);
      console.log(`Sample Rate: ${sampleRate}`);
      console.log(`Byte Rate: ${byteRate}`);
      console.log(`Block Align: ${blockAlign}`);
      console.log(`Bits Per Sample: ${bitsPerSample}`);
      console.log(`Subchunk2 ID: ${subchunk2Id}`);
      console.log(`Subchunk2 Size: ${subchunk2Size}`);
  
      // Additional checks
      if (chunkId !== 'RIFF') {
        console.warn('Warning: ChunkID is not "RIFF". This may not be a valid WAV file.');
      }
      if (format !== 'WAVE') {
        console.warn('Warning: Format is not "WAVE". This may not be a valid WAV file.');
      }
      if (subchunk1Id !== 'fmt ') {
        console.warn('Warning: Subchunk1ID is not "fmt ". The WAV format may be non-standard.');
      }
      if (subchunk2Id !== 'data') {
        console.warn('Warning: Subchunk2ID is not "data". The WAV format may be non-standard.');
      }
  
    } catch (error) {
      console.error('Error parsing WAV header:', error);
      console.log('Raw header data:', Array.from(new Uint8Array(view.buffer.slice(0, 44))));
    }
  }
  
const onDataAvailable = async (data) => {
  let finalData = data;

  if (!header.current) {
    if (debug) {
      const buffer = await data.arrayBuffer();
      printWavHeader(buffer);
    }
    header.current = data.slice(0, 44);
    finalData = data.slice(44);
  }

  function addChunkToCircularBuffer(chunk) {
    if (chunks.current.length  > 0) {
      chunks.current.shift();
    }
    chunks.current.push(chunk);
  }

  function addChunkToRecording(chunk) {
    debug && console.log("+");
    chunks.current.push(chunk);
  }

  if (onlyRecordOnSpeaking) {

    switch (speakingStateRef.current) {
      case 'getting_final_chunk':
        if (!waitingForFinalChunk.current) {
          throw new Error('Unexpected state: getting_final_chunk but not waiting for final chunk');
        }
        waitingForFinalChunk.current = false;
        chunks.current.push(finalData);
        setSpeakingState('no_speech');
        await onSendSpeechData();
        break;
      case 'speaking':
      case 'waiting_for_min_duration':
        addChunkToRecording(finalData);
        break;
      case 'waiting_for_silence_timeout':
        tempChunks.current.push(finalData);
        break;
      case 'no_speech':
        addChunkToCircularBuffer(finalData);
        break;
      default:
        console.error('Unexpected speaking state in onDataAvailable:', speakingStateRef.current);
        throw new Error('Unexpected speaking state in onDataAvailable: ' + speakingStateRef.current);
    }
  } else {
    addChunkToRecording(finalData);

    if (waitingForFinalChunk.current) {
      waitingForFinalChunk.current = false;
      await onSendSpeechData();
    }
  }
};

async function convertWavToMp3(wavBlob) {
  const buffer = await wavBlob.arrayBuffer();
  const wavHeader = new DataView(buffer, 0, 44);
  const wavSampleRate = wavHeader.getUint32(24, true);
  const wavNumChannels = wavHeader.getUint16(22, true);

  const samples = new Int16Array(buffer, 44); // Skip WAV header (44 bytes)
  const mp3Encoder = new lamejs.Mp3Encoder(wavNumChannels, wavSampleRate, 128); 
  
  // split "samples" into a left and right channel
  let left = [];
  let right = [];
  if (wavNumChannels == 1) {
    left = samples;
    right = undefined;
  } else if (wavNumChannels == 2) {
    for (let i = 0; (i+1) < samples.length; i += 2) {
      left.push(samples[i]);
      right.push(samples[i + 1]);
    }
  } else {
    throw new Error('Unsupported number of channels in mic input: ' + wavNumChannels);
  }

  const mp3Data = mp3Encoder.encodeBuffer(left, right);

  const mp3Blob = new Blob([mp3Data], { type: 'audio/mp3' });
  return mp3Blob;
}


const onSendSpeechData = async () => {
  debug && console.log("onSendSpeechData chunk count=", chunks.current.length)

  cancelFinalDataCallback();

  if (chunks.current && chunks.current.length > 0) {

    updateLongestSilence(); 

    let debugInfo = {
      chunkCount: chunks.current.length,
      duration: chunks.current.length * timeSlice,
    }

    // insert the WAV header before the first chunk
    chunks.current.unshift(header.current);

    // Concatenate all the chunks into a single blob
    const wavblob = new Blob(chunks.current, { type: 'audio/wav' });
    const blob = await convertWavToMp3(wavblob);

    onSpeechDataBlobAvailable?.(blob, debugInfo);
    
    resetChunks();

    if ((!continuousRecording) && recorder.current) {
      await onStopRecording();
    }    
  }
}


  return {
    recording,
    speaking,
    listeningForSpeech,
    soundDetected,
    mostRecentSpeakingDuration,
    longestSilenceDuration,
    audioInfo,
    startRecording,
    stopRecording,
  }
};