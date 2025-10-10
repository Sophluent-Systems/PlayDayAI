import hark from 'hark';
import { MicVAD } from '@ricky0123/vad-web';

export class SpeechDetector {
    constructor({debug, speechDetectMode} = {}) {
        this.stream = null;
        this.debug = debug ? true : false;
        this.detector = null;
        this.speechDetectMode = speechDetectMode || 'hark';
        this.isSpeaking = false;
        this.lastVoiceTimestamp = 0;
        this.onSoundDetected = null;
        this.micVad = null;
        this.logDebug = (...args) => {
            if (!this.debug) {
                return;
            }
            console.debug('[SpeechDetector]', ...args);
        };
        this.logWarn = (...args) => {
            if (!this.debug) {
                return;
            }
            console.warn('[SpeechDetector]', ...args);
        };
    }

    async start({
        stream, 
        speechInterval, 
        speechThreshold, 
        onSpeechStart,
        onSpeechEnd,
        onSoundDetected,
        silenceTimeout,
        minimumSpeechDuration,
        vadOptions = {},
    }) {
        this.stream = stream;
        this.onSoundDetected = onSoundDetected || null;

        const internalOnSpeechStart = () => {
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                this.logDebug('speech start');
                onSpeechStart();
            }
            this.lastVoiceTimestamp = Date.now();
            this.onSoundDetected?.(true);
        };


        const internalOnSpeechEnd = () => {
            if (this.isSpeaking) {
                this.isSpeaking = false;
                this.logDebug('speech end');
                onSpeechEnd();
            }
            this.onSoundDetected?.(false);
        };

        if (this.speechDetectMode === 'hark') {
            const listener = hark(stream, {
                interval: speechInterval,  
                play: false,
                threshold: speechThreshold,  
                silenceTimeout,
            });
            
            listener.on('speaking', internalOnSpeechStart);
            listener.on('stopped_speaking', internalOnSpeechEnd);
            this.detector = listener;

        } else if (this.speechDetectMode === 'vad' || this.speechDetectMode === 'mic_vad') {
            if (typeof window === 'undefined') {
                throw new Error('SpeechDetector VAD mode is only available in the browser runtime.');
            }

            const ensureTrailingSlash = (value, fallback = '/') => {
                const resolved = value || fallback;
                return resolved.endsWith('/') ? resolved : `${resolved}/`;
            };

            const baseAssetPath = ensureTrailingSlash(vadOptions.assetBasePath, '/vad/');
            const onnxWasmBasePath = ensureTrailingSlash(
                vadOptions.onnxWasmBasePath,
                'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/'
            );
            const chosenModel = vadOptions.model === 'legacy' ? 'legacy' : 'v5';

            this.micVad?.destroy();

            const micVadConfig = {
                model: chosenModel,
                startOnLoad: false,
                baseAssetPath,
                onnxWASMBasePath: onnxWasmBasePath,
                workletOptions: {
                    ...(vadOptions.workletOptions || {}),
                    numberOfInputs: 1,
                },
                redemptionMs: typeof vadOptions.redemptionMs === 'number'
                    ? vadOptions.redemptionMs
                    : silenceTimeout,
                minSpeechMs: typeof vadOptions.minSpeechMs === 'number'
                    ? vadOptions.minSpeechMs
                    : minimumSpeechDuration,
                onFrameProcessed: (probabilities) => {
                    const speechDetected = probabilities.isSpeech > probabilities.notSpeech;
                    this.onSoundDetected?.(speechDetected);
                },
                onVADMisfire: () => {
                    this.onSoundDetected?.(false);
                    internalOnSpeechEnd();
                },
                onSpeechStart: internalOnSpeechStart,
                onSpeechRealStart: internalOnSpeechStart,
                onSpeechEnd: () => {
                    internalOnSpeechEnd();
                },
                getStream: async () => stream,
                pauseStream: async () => {},
                resumeStream: async () => stream,
            };

            if (typeof vadOptions.positiveSpeechThreshold === 'number') {
                micVadConfig.positiveSpeechThreshold = vadOptions.positiveSpeechThreshold;
            }
            if (typeof vadOptions.negativeSpeechThreshold === 'number') {
                micVadConfig.negativeSpeechThreshold = vadOptions.negativeSpeechThreshold;
            }
            if (typeof vadOptions.preSpeechPadMs === 'number') {
                micVadConfig.preSpeechPadMs = vadOptions.preSpeechPadMs;
            }
            if (typeof vadOptions.submitUserSpeechOnPause === 'boolean') {
                micVadConfig.submitUserSpeechOnPause = vadOptions.submitUserSpeechOnPause;
            }

            const micVad = await MicVAD.new(micVadConfig);

            await micVad.start();

            this.detector = {
                stop: () => {
                    micVad.destroy();
                    this.micVad = null;
                }
            };

            this.micVad = micVad;
        } else {
            throw new Error('Invalid speech detection speechDetectMode: ' + this.speechDetectMode);
        }
    }

    stop() {
        if (this.detector?.stop) {
            try {
                this.detector.stop();
            } catch (error) {
                this.logWarn('Error stopping speech detector', error);
            }
            this.detector = null;
        }

        if (this.micVad) {
            try {
                this.micVad.destroy();
            } catch (error) {
                this.logWarn('Error destroying MicVAD instance', error);
            }
            this.micVad = null;
        }

        if (this.onSoundDetected) {
            this.onSoundDetected(false);
            this.onSoundDetected = null;
        }
    }
}
