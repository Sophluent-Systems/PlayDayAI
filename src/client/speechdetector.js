import hark from 'hark';
import { VADWrapper } from 'voice-activity-detection';

export class SpeechDetector {
    constructor({debug, speechDetectMode} = {}) {
        this.stream = null;
        this.debug = debug ? true : false;
        this.detector = null;
        this.speechDetectMode = speechDetectMode || 'hark';
        this.isSpeaking = false;
        this.lastVoiceTimestamp = 0;
    }

    async start({
        stream, 
        speechInterval, 
        speechThreshold, 
        onSpeechStart,
        onSpeechEnd,
        onSoundDetected,
    }) {
        this.stream = stream;

        const internalOnSpeechStart = () => {
            if (!this.isSpeaking) {
                this.isSpeaking = true;
                onSpeechStart();
            }
            this.lastVoiceTimestamp = Date.now();
            onSoundDetected?.(true);
        };


        const internalOnSpeechEnd = () => {
            if (this.isSpeaking) {
                this.isSpeaking = false;
                onSpeechEnd();
            }
            onSoundDetected?.(false);
        };

        if (this.speechDetectMode === 'hark') {
            const listener = hark(stream, {
                interval: speechInterval,  
                play: false,
                threshold: speechThreshold,  
                silenceTimeout: speechInterval,
            });
            
            listener.on('speaking', internalOnSpeechStart);
            listener.on('stopped_speaking', internalOnSpeechEnd);
            this.detector = listener;

        } else if (this.speechDetectMode === 'vad') {
            const linearThreshold = Math.pow(10, speechThreshold / 20);

            const vad = new VADWrapper({
                fftSize: 512,
                bufferLen: 512,
                smoothingTimeConstant: 0.99,
                minCaptureFreq: 85,
                maxCaptureFreq: 255,
                noiseCaptureDuration: 1000,
                minNoiseLevel: linearThreshold * 0.5,
                maxNoiseLevel: linearThreshold * 1.5,
                avgNoiseMultiplier: 1.2,
                onVoiceStart: internalOnSpeechStart,
                onVoiceStop: internalOnSpeechEnd,
                onUpdate: (val) => {
                    const speechDetected = val > 0;
                    onSoundDetected?.(speechDetected);
                }
            });

            vad.init(stream);
            vad.start();
            this.detector = vad;
        } else {
            throw new Error('Invalid speech detection speechDetectMode: ' + this.speechDetectMode);
        }
    }

    stop() {
        if (this.detector) {
            if (this.speechDetectMode === 'hark' || this.speechDetectMode === 'vad') {
                this.detector.stop();
                this.detector = null;
            } else {
                throw new Error('Invalid speech detection speechDetectMode: ' + this.speechDetectMode);
            }
        }
    }
}