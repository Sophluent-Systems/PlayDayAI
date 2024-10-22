'use strict';

class AdaptiveFilterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.filterCoefficients = new Float32Array(1024).fill(0);
    this.learningRate = 0.01; // Reduced from 0.5 to prevent instability
    this.latencyEstimator = new LatencyEstimator();
    this.delayBuffer = new Float32Array(2048); // Buffer for delayed speaker input
    this.delayBufferIndex = 0;
    this.stableLatencyAchieved = false;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    if (event.data.type === 'getStableLatency') {
      this.port.postMessage({ type: 'stableLatency', value: this.stableLatencyAchieved });
    }
    // Handle other message types as needed
  }

  adaptiveEchoCancellationAlgorithm(micInput, speakerInput, output) {
    const latency = this.latencyEstimator.estimateLatency(micInput, speakerInput);
    
    if (this.latencyEstimator.isStable && !this.stableLatencyAchieved) {
      console.log("POSTING MESSAGE: Stable latency achieved: ", latency)
      this.stableLatencyAchieved = true;
      this.port.postMessage({ type: 'stableLatencyAchieved', latency: latency });
    }

    // Update delay buffer
    for (let i = 0; i < speakerInput.length; i++) {
      this.delayBuffer[this.delayBufferIndex] = speakerInput[i];
      this.delayBufferIndex = (this.delayBufferIndex + 1) % this.delayBuffer.length;
    }

    for (let i = 0; i < micInput.length; i++) {
      // Estimate the echo
      let estimatedEcho = 0;
      for (let j = 0; j < this.filterCoefficients.length; j++) {
        const delayedIndex = (this.delayBufferIndex - latency - j + this.delayBuffer.length) % this.delayBuffer.length;
        estimatedEcho += this.filterCoefficients[j] * this.delayBuffer[delayedIndex];
      }

      // Calculate the error
      const error = micInput[i] - estimatedEcho;

      // Update filter coefficients
      for (let j = 0; j < this.filterCoefficients.length; j++) {
        const delayedIndex = (this.delayBufferIndex - latency - j + this.delayBuffer.length) % this.delayBuffer.length;
        this.filterCoefficients[j] += this.learningRate * error * this.delayBuffer[delayedIndex];
      }

      // Output the error (which is the cleaned signal)
      output[i] = error;
    }

    return true;
  }

  process(inputs, outputs) {
    const micInput = inputs[0][0];
    const speakerInput = inputs[1][0];
    const output = outputs[0][0];

    if (!micInput || !speakerInput || !output) {
      console.error('Invalid input or output');
      return false;
    }

    return this.adaptiveEchoCancellationAlgorithm(micInput, speakerInput, output);
  }
}
class LatencyEstimator {
  constructor() {
    this.latency = 0;
    this.correlationBuffer = new Float32Array(2048).fill(0);
    this.correlationThreshold = 0.4;
    this.stableLatencyDeltaThreshold = 10;
    this.latencyHistory = new Float32Array(50).fill(0); // Increased history size
    this.latencyIndex = 0;
    this.stableCount = 0;
    this.isStable = false;
    this.stabilityThreshold = 5; // Increased stability threshold
    this.sampleRate = 48000; // Assume 48kHz sample rate, adjust if different
  }

  normalizeArray(arr) {
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const std = Math.sqrt(arr.reduce((sum, val) => sum + (val - mean) ** 2, 0) / arr.length);
    return arr.map(val => (val - mean) / std);
  }

  estimateLatency(micInput, speakerInput) {
    const normalizedMicInput = this.normalizeArray(micInput);
    const normalizedSpeakerInput = this.normalizeArray(speakerInput);

    this.correlationBuffer.fill(0);

    for (let i = 0; i < normalizedMicInput.length; i++) {
      for (let j = 0; j < normalizedSpeakerInput.length; j++) {
        this.correlationBuffer[i + j] += normalizedMicInput[i] * normalizedSpeakerInput[j];
      }
    }

    const normFactor = Math.sqrt(normalizedMicInput.reduce((sum, val) => sum + val ** 2, 0) * 
                                 normalizedSpeakerInput.reduce((sum, val) => sum + val ** 2, 0));
    for (let i = 0; i < this.correlationBuffer.length; i++) {
      this.correlationBuffer[i] /= normFactor;
    }

    let maxCorrelation = 0;
    let maxIndex = 0;
    for (let i = 0; i < this.correlationBuffer.length; i++) {
      if (Math.abs(this.correlationBuffer[i]) > maxCorrelation) {
        maxCorrelation = Math.abs(this.correlationBuffer[i]);
        maxIndex = i;
      }
    }

    if (maxCorrelation > this.correlationThreshold) {
      const newLatency = (maxIndex - normalizedMicInput.length / 2) / this.sampleRate * 1000; // Convert to milliseconds

      // Update moving average with outlier rejection
      this.latencyHistory[this.latencyIndex] = newLatency;
      this.latencyIndex = (this.latencyIndex + 1) % this.latencyHistory.length;

      // Sort latency history and remove outliers
      const sortedLatencies = [...this.latencyHistory].sort((a, b) => a - b);
      const q1 = sortedLatencies[Math.floor(sortedLatencies.length / 4)];
      const q3 = sortedLatencies[Math.floor(3 * sortedLatencies.length / 4)];
      const iqr = q3 - q1;
      const validLatencies = sortedLatencies.filter(l => l >= q1 - 1.5 * iqr && l <= q3 + 1.5 * iqr);

      // Calculate new latency estimate
      const newEstimate = validLatencies.reduce((sum, val) => sum + val, 0) / validLatencies.length;

      // Check for stability
      const latencyDifference = Math.abs(newEstimate - this.latency);
      if (latencyDifference < this.stableLatencyDeltaThreshold) {
        this.stableCount++;
        if (this.stableCount >= this.stabilityThreshold) {
          this.isStable = true;
        }
      } else {
        this.stableCount = 0;
        this.isStable = false;
      }

      // Gradual update of latency estimate
      this.latency = this.latency * 0.9 + newEstimate * 0.1;

      //console.log(`Latency: ${this.latency.toFixed(2)} ms, Difference: ${latencyDifference.toFixed(2)} ms, Stable: ${this.isStable}`);
    }

    return Math.round(this.latency);
  }
}

registerProcessor('adaptive-filter', AdaptiveFilterProcessor);