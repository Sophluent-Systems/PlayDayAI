import { useEffect, useRef, useState } from 'react';
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
  speechDetectMode: 'vad',
  debug: false,
  audioDuckingControl: 'on_speaking',
  audioSessionType: 'play-and-record',
  audioSessionChangeDelay: 200,
  vad: {
    assetBaseUrl: '/vad/',
    onnxWasmBaseUrl: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/',
    model: 'v5',
    positiveSpeechThreshold: undefined,
    negativeSpeechThreshold: undefined,
    redemptionMs: undefined,
    minSpeechMs: undefined,
    preSpeechPadMs: undefined,
    submitUserSpeechOnPause: false,
    workletOptions: undefined,
  },
}

export const useSpeechDetection = (config = {}) => {
if (typeof window === 'undefined') {
    // Early return or mock the hook's API if on the server
    return {
    recording: false,
    speaking: false,
    listeningForSpeech: false,
    soundDetected: false,
    mostRecentSpeakingDuration: 0,
    longestSilenceDuration: 0,
    audioInfo: {},
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
    vad: vadConfig = {},
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
  const pendingHeaderChunks = useRef([]);
  const pendingHeaderBytes = useRef(0);
  const {
    assetBaseUrl: vadAssetBaseUrl,
    onnxWasmBaseUrl: vadOnnxWasmBaseUrl,
    model: vadModel,
    positiveSpeechThreshold: vadPositiveSpeechThreshold,
    negativeSpeechThreshold: vadNegativeSpeechThreshold,
    redemptionMs: vadRedemptionMs,
    minSpeechMs: vadMinSpeechMs,
    preSpeechPadMs: vadPreSpeechPadMs,
    submitUserSpeechOnPause: vadSubmitUserSpeechOnPause,
    workletOptions: vadWorkletOptions,
  } = vadConfig;

  const debugLog = (...args) => {
    if (!debug) {
      return;
    }
    console.debug('[SpeechDetection]', ...args);
  };

  const debugWarn = (...args) => {
    if (!debug) {
      return;
    }
    console.warn('[SpeechDetection]', ...args);
  };

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
    debugLog(`Speaking state: ${speakingStateRef.current} -> ${state}`);
    speakingStateRef.current = state;
  };

  const resetChunks = () => {
    chunks.current = [];
    tempChunks.current = [];
    pendingHeaderChunks.current = [];
    pendingHeaderBytes.current = 0;
  }
  
  const cleanup = async () => {
    debugLog("cleanup")
    if (recorder.current) {
      await onStopRecording();
    }
    if (stream.current) {
      onStopStreaming();
    }
    setSpeaking(false);
    setListeningForSpeech(false);
    setRecording(false);
    setSoundDetected(false);
    resetChunks();
    cancelSilenceTimer();
    cancelSpeechTimer();
    cancelFinalDataCallback();
  };
  
  useEffect(() => {
    const init = async () => {
    if (typeof window != "undefined") {
        debugLog("useSpeechDetection: Init")
        if (!ExtendableMediaRecorder.current) {
          try {
            const EMR = await import('extendable-media-recorder');
            ExtendableMediaRecorder.current = EMR.MediaRecorder;

            if (!wavRecorderRegistered) {

              const { connect } = await import('extendable-media-recorder-wav-encoder');

              await EMR.register(await connect());
              setWavRecorderRegistered(true);
            }


          } catch (e) {
            debugWarn('Falling back to native MediaRecorder', e);
          }

          if (!ExtendableMediaRecorder.current && typeof window !== 'undefined') {
            if (window.MediaRecorder && typeof window.MediaRecorder.isTypeSupported === 'function' && window.MediaRecorder.isTypeSupported('audio/wav')) {
              ExtendableMediaRecorder.current = window.MediaRecorder;
            } else {
              throw new Error('WAV recording is not supported in this browser.');
            }
          }

          if (audioDuckingControl === 'always_on' && typeof navigator !== 'undefined' && 'audioSession' in navigator) {
            debugLog(`Setting audio session type to '${audioSessionType}'`)
            navigator.audioSession['type'] = audioSessionType;
          }
        }
      }
    };

    init().catch((error) => {
      console.error('Failed to initialise speech detection recording', error);
    });

    return () => {
      cleanup().catch((error) => {
        console.error('Error during speech detection cleanup', error);
      });
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
    debugLog("Final data callback timeout")
    setSpeakingState('no_speech');
    await onSendSpeechData();
  }, timeSlice * 2); // Wait for double the timeSlice duration
};

const cancelFinalDataCallback = () => {
  if (finalDataCallbackTimeout.current) {
    debugLog("Cancel final data callback")
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

  // Main function to set up echo cancellation
  async function setupEchoCancellation() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
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
    debugLog("onStartStreaming")

    try {
      if (stream.current) {
        onStopStreaming();
      }
      
      header.current = undefined;
      pendingHeaderChunks.current = [];
      pendingHeaderBytes.current = 0;
      
      setSpeakingState('no_speech');
      
      const requestStream = async (enableEcho) => navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: enableEcho,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      let audioSessionChangeOccurred = false;
      if (audioDuckingControl === 'on_speaking' && 'audioSession' in navigator) {
        const start = Date.now();
        const handleStateChange = () => {
          debugLog(`Audio session state change: ${navigator.audioSession.state}`);

          if (navigator.audioSession.state === "active") {
            const end = Date.now();
            debugLog(`Audio session activated after ${end - start}ms`);
            navigator.audioSession.onstatechange = null;

            const invokeDetector = () => {
              startListeningForSpeech().catch((error) => {
                console.error('Failed to start speech detector after audio session activation', error);
              });
            };

            if (audioSessionChangeDelay > 0) {
              setTimeout(invokeDetector, audioSessionChangeDelay);
            } else {
              invokeDetector();
            }
          }
        };

        navigator.audioSession.onstatechange = handleStateChange;
        navigator.audioSession['type'] = audioSessionType;
        audioSessionChangeOccurred = true;
        debugLog(`Audio session type set to '${audioSessionType}' -- waiting for state change to occur`);
      }
        
      if (echoCancellation) {
        debugLog("Setting up echo cancellation");

        try {
          stream.current = await setupEchoCancellation();
        } catch (error) {
          console.error('Falling back to basic media stream', error);
          stream.current = await requestStream(true);
        }
      } else {
        debugLog("Skipping echo cancellation");

        stream.current = await requestStream(false);
      }

      if (!audioSessionChangeOccurred) {
        await startListeningForSpeech();
      }
      
      debugLog("Stream active:", stream.current.active);
      if (debug) {
        let trackInfo = stream.current.getAudioTracks();
        if (Array.isArray(trackInfo) && trackInfo.length > 0) {
          trackInfo = trackInfo[0];
        }
        debugLog("Audio Info: ", trackInfo);
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
      throw err;
    }
  }

  const startListeningForSpeech = async () => {
    if (!stream.current) {
      return;
    }

    if (listener.current) {
      listener.current.stop();
      listener.current = undefined;
    }

    debugLog("Initializing speech detector");

    try {
      const detector = new SpeechDetector({ debug, speechDetectMode });
      await detector.start({
        stream: stream.current,
        speechInterval,
        speechThreshold,
        silenceTimeout,
        minimumSpeechDuration,
        onSpeechStart: onStartSpeaking,
        onSpeechEnd: onStopSpeaking,
        onSoundDetected: (detected) => {
          setSoundDetected(detected);
        },
        vadOptions: {
          assetBasePath: vadAssetBaseUrl,
          onnxWasmBasePath: vadOnnxWasmBaseUrl,
          model: vadModel,
          positiveSpeechThreshold: vadPositiveSpeechThreshold,
          negativeSpeechThreshold: vadNegativeSpeechThreshold,
          redemptionMs: vadRedemptionMs,
          minSpeechMs: vadMinSpeechMs,
          preSpeechPadMs: vadPreSpeechPadMs,
          submitUserSpeechOnPause: vadSubmitUserSpeechOnPause,
          workletOptions: vadWorkletOptions,
        },
      });

      listener.current = detector;
      setListeningForSpeech(true);
      debugLog("Speech detector started and listening for speech events");
    } catch (error) {
      console.error('Failed to start speech detector', error);
      setListeningForSpeech(false);
    }
  };

  const startSpeechTimer = () => {
    cancelSpeechTimer();
    speechTimer.current = setTimeout(() => {
      debugLog("Minimum speech duration met")
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
      debugLog("Cancel speech timer")
      clearTimeout(speechTimer.current);
      speechTimer.current = null;
    }
  };

const onSilenceTimeout = () => {
  debugLog("Silence timeout")
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
  debugLog(`Silence timeout captured ${chunks.current.length} primary chunks and ${tempChunks.current.length} queued chunks`);

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
      debugLog("Cancel silence timer")
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    silenceStartTime.current = null;
  };
 

  const updateLongestSilence = () => {
    if (silenceStartTime.current) {
      const currentSilenceDuration = Date.now() - silenceStartTime.current;
      debugLog("Silence duration:", currentSilenceDuration);
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
            debugLog(
                `Merging ${tempChunks.current.length} queued chunks back into active recording`,
              );
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
        debugLog("Speaking duration:", speakingDuration);
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
    debugLog('start speaking');
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
    debugLog("onStartRecording")
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
        debugLog("Recording! timeSlice=", timeSlice);
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
    debugLog('stop speaking');
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
    debugLog("onStopRecording")
    try {

      if (recorder.current) {
        debugLog("Stopping recorder")
        const defunctRecorder = recorder.current;
        recorder.current = undefined;
        defunctRecorder.stop();
        
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
    debugLog("onStopStreaming")
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
            debugLog("Setting audio session type to 'playback'")
            navigator.audioSession['type'] = 'playback';
        }
        stream.current = undefined;
    }

    setSpeakingState('no_speech');
    speakingRef.current = false;
    currentSpeakingStartTime.current = null;
    setListeningForSpeech(false)
    setSpeaking(false)
    setSoundDetected(false);
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

      debugLog('WAV header', {
        chunkId,
        chunkSize,
        format,
        subchunk1Id,
        subchunk1Size,
        audioFormat,
        numChannels,
        sampleRate,
        byteRate,
        blockAlign,
        bitsPerSample,
        subchunk2Id,
        subchunk2Size,
      });

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
      debugLog('Raw header data', Array.from(new Uint8Array(view.buffer.slice(0, 44))));
    }
  }
  
const bytesForLog = (chunk) => {
  if (!chunk) {
    return 0;
  }
  if (typeof chunk.size === 'number') {
    return chunk.size;
  }
  if (typeof chunk.byteLength === 'number') {
    return chunk.byteLength;
  }
  return 0;
};

const onDataAvailable = async (data) => {
  let finalData = data;

  if (!header.current) {
    const dataSize = bytesForLog(data);

    if (pendingHeaderBytes.current > 0) {
      pendingHeaderChunks.current.push(data);
      pendingHeaderBytes.current += dataSize;
      const combined = new Blob(pendingHeaderChunks.current, { type: data.type || 'audio/wav' });

      if (combined.size < 44) {
        debugWarn(`Accumulating WAV header bytes (have ${combined.size}/44); waiting for more data`);
        return;
      }

      header.current = combined.slice(0, 44);
      finalData = combined.slice(44);
      pendingHeaderChunks.current = [];
      pendingHeaderBytes.current = 0;
    } else if (dataSize < 44) {
      pendingHeaderChunks.current = [data];
      pendingHeaderBytes.current = dataSize;
      debugWarn(`Received initial chunk smaller than WAV header (${dataSize} bytes); waiting for next chunk`);
      return;
    } else {
      header.current = data.slice(0, 44);
      finalData = data.slice(44);
    }

    if (debug && header.current) {
      try {
        const headerBuffer = await header.current.arrayBuffer();
        printWavHeader(headerBuffer);
      } catch (error) {
        console.warn('Unable to inspect WAV header', error);
      }
    }

    debugLog(`Captured WAV header (${header.current?.size || 0} bytes)`);
  }

  if (finalData instanceof Blob && finalData.size === 0) {
    debugLog('No audio payload in chunk after extracting WAV header');
    return;
  }

  debugLog(
    `onDataAvailable received chunk: state=${speakingStateRef.current} size=${bytesForLog(finalData)} bytes`,
  );

  function addChunkToCircularBuffer(chunk) {
    if (chunks.current.length  > 0) {
      chunks.current.shift();
    }
    debugLog(
        `Buffering pre-roll chunk (${bytesForLog(chunk)} bytes); circular buffer length=${chunks.current.length + 1}`,
      );
    chunks.current.push(chunk);
  }

  function addChunkToRecording(chunk) {
    debugLog(
        `Appending recording chunk (${bytesForLog(chunk)} bytes); total chunks=${chunks.current.length + 1}`,
      );
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
        debugLog(
            `Queued chunk during silence timeout (${bytesForLog(finalData)} bytes); temp buffer length=${tempChunks.current.length}`,
          );
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

  const mp3Chunks = [];
  const samplesPerFrame = 1152;

  if (wavNumChannels === 1) {
    for (let i = 0; i < samples.length; i += samplesPerFrame) {
      const sampleChunk = samples.subarray(i, i + samplesPerFrame);
      const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }
    }
  } else if (wavNumChannels === 2) {
    const left = new Int16Array(samples.length / 2);
    const right = new Int16Array(samples.length / 2);

    for (let i = 0, j = 0; i + 1 < samples.length; i += 2, j += 1) {
      left[j] = samples[i];
      right[j] = samples[i + 1];
    }

    for (let i = 0; i < left.length; i += samplesPerFrame) {
      const leftChunk = left.subarray(i, i + samplesPerFrame);
      const rightChunk = right.subarray(i, i + samplesPerFrame);
      const mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Chunks.push(mp3buf);
      }
    }
  } else {
    throw new Error('Unsupported number of channels in mic input: ' + wavNumChannels);
  }

  const flushChunk = mp3Encoder.flush();
  if (flushChunk.length > 0) {
    mp3Chunks.push(flushChunk);
  }

  const mp3Blob = new Blob(mp3Chunks, { type: 'audio/mpeg' });
  debugLog(`Converted WAV (${wavBlob.size} bytes) to MP3 (${mp3Blob.size} bytes)`);
  return mp3Blob;
}


const onSendSpeechData = async () => {
  debugLog("onSendSpeechData chunk count=", chunks.current.length)

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
    debugLog(`Assembled WAV blob=${wavblob.size} bytes from ${chunks.current.length} chunks`);
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
