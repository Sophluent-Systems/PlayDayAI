'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Waves, Activity, Volume2, VolumeX, Play } from 'lucide-react';
import { useSpeechDetection } from '@src/client/components/useSpeechDetection';
import { useConfig } from '@src/client/configprovider';
import { GlassCard } from '@src/client/components/ui/card';
import { PrimaryButton, SecondaryButton } from '@src/client/components/ui/button';
import { StatusPanel } from '@src/client/components/ui/statuspanel';

function ToggleControl({ label, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        checked ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/60 bg-surface text-emphasis hover:border-primary/40'
      }`}
    >
      <span className="space-y-1">
        <span className="block text-sm font-semibold">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
      <span
        className={`flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-primary' : 'bg-border/70'}`}
      >
        <span
          className={`ml-1 h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}

function NumberField({ label, value, onChange, suffix, min, max, step }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface px-4 py-2">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          min={min}
          max={max}
          step={step}
          className="flex-1 bg-transparent text-sm text-emphasis focus:outline-none"
        />
        {suffix ? <span className="text-xs uppercase tracking-[0.3em] text-muted">{suffix}</span> : null}
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
      <span>{label}</span>
      <div className="rounded-2xl border border-border/60 bg-surface">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-emphasis focus:outline-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

export default function VoiceTest() {
  const { Constants } = useConfig();
  const [encodedBlob, setEncodedBlob] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const encodedAudioRef = useRef(null);
  const [listenState, setListenState] = useState(false);
  const [onlyRecordOnSpeaking, setOnlyRecordOnSpeaking] = useState(true);

  const [timeSlice, setTimeSlice] = useState(Constants.audioRecordingDefaults.timeSlice);
  const [speechInterval, setSpeechInterval] = useState(Constants.audioRecordingDefaults.speechInterval);
  const [speechThreshold, setSpeechThreshold] = useState(Constants.audioRecordingDefaults.speechThreshold);
  const [silenceTimeout, setSilenceTimeout] = useState(Constants.audioRecordingDefaults.silenceTimeout);
  const [speechDetectMode, setSpeechDetectMode] = useState(Constants.audioRecordingDefaults.speechDetectMode);
  const [minimumSpeechDuration, setMinimumSpeechDuration] = useState(
    Constants.audioRecordingDefaults.minimumSpeechDuration
  );
  const [audioDuckingControl, setAudioDuckingControl] = useState(
    Constants.audioRecordingDefaults.audioDuckingControl || 'on_speaking'
  );
  const [echoCancellation, setEchoCancellation] = useState(Constants.audioRecordingDefaults.echoCancellation);
  const [audioSessionType, setAudioSessionType] = useState(
    Constants.audioRecordingDefaults.audioSessionType || 'play-and-record'
  );

  const {
    recording,
    speaking,
    listeningForSpeech,
    mostRecentSpeakingDuration,
    longestSilenceDuration,
    soundDetected,
    audioInfo,
    startRecording,
    stopRecording,
  } = useSpeechDetection({
    onlyRecordOnSpeaking,
    continuousRecording: true,
    debug: true,
    audioDuckingControl,
    echoCancellation,
    onSpeechDataBlobAvailable: (blob, info) => {
      setEncodedBlob(blob);
      setDebugInfo(info);
    },
    timeSlice: Number(timeSlice),
    speechInterval: Number(speechInterval),
    speechThreshold: Number(speechThreshold),
    silenceTimeout: Number(silenceTimeout),
    speechDetectMode,
    minimumSpeechDuration: Number(minimumSpeechDuration),
    vad: Constants.audioRecordingDefaults.vad,
  });

  const handleRecordToggle = () => {
    if (listenState) {
      stopRecording();
    } else {
      setEncodedBlob(null);
      setDebugInfo(null);
      startRecording();
    }
    setListenState((state) => !state);
  };

  const playAudio = () => {
    if (!encodedBlob || !encodedAudioRef.current) {
      return;
    }
    const url = URL.createObjectURL(encodedBlob);
    encodedAudioRef.current.src = url;
    encodedAudioRef.current.play();
  };

  useEffect(() => {
    return () => {
      if (encodedAudioRef.current?.src) {
        URL.revokeObjectURL(encodedAudioRef.current.src);
      }
    };
  }, []);

  return (
    <div className="space-y-8">
      <GlassCard>
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.35em] text-muted">Diagnostics</p>
              <h1 className="text-2xl font-semibold text-emphasis">Voice input test bench</h1>
              <p className="text-sm text-muted">
                Tune the streaming audio recorder, verify silence detection, and preview captured audio in real time.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton icon={listenState ? Square : Mic} onClick={handleRecordToggle}>
              {listenState ? 'Stop listening' : 'Start listening'}
            </PrimaryButton>
            <SecondaryButton icon={Play} onClick={playAudio} disabled={!encodedBlob}>
              Play encoded excerpt
            </SecondaryButton>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-emphasis">Recording behaviour</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ToggleControl
              label="Auto pause when silent"
              description="Only capture audio while speech is detected."
              checked={onlyRecordOnSpeaking}
              onChange={setOnlyRecordOnSpeaking}
            />
            <ToggleControl
              label="Echo cancellation"
              description="Reduce feedback for devices with open speakers."
              checked={echoCancellation}
              onChange={setEchoCancellation}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <NumberField label="Chunk duration" suffix="MS" value={timeSlice} onChange={setTimeSlice} step={50} />
            <NumberField label="Speech interval" suffix="MS" value={speechInterval} onChange={setSpeechInterval} step={50} />
            <NumberField label="Speech threshold" suffix="DB" value={speechThreshold} onChange={setSpeechThreshold} step={1} />
            <NumberField label="Silence timeout" suffix="MS" value={silenceTimeout} onChange={setSilenceTimeout} step={100} />
            <NumberField
              label="Minimum speech duration"
              suffix="MS"
              value={minimumSpeechDuration}
              onChange={setMinimumSpeechDuration}
              step={50}
            />
            <SelectField
              label="Detector"
              value={speechDetectMode}
              onChange={setSpeechDetectMode}
              options={[
                { value: 'hark', label: 'Hark (beamforming)' },
                { value: 'vad', label: 'VAD (browser)' },
              ]}
            />
            <SelectField
              label="Audio ducking"
              value={audioDuckingControl}
              onChange={setAudioDuckingControl}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_speaking', label: 'On speaking' },
                { value: 'always_on', label: 'Always on' },
              ]}
            />
            <SelectField
              label="Session type"
              value={audioSessionType}
              onChange={setAudioSessionType}
              options={[
                { value: 'playback', label: 'Playback' },
                { value: 'transient', label: 'Transient' },
                { value: 'transient-solo', label: 'Transient solo' },
                { value: 'ambient', label: 'Ambient' },
                { value: 'play-and-record', label: 'Play and record' },
                { value: 'auto', label: 'Auto' },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      <StatusPanel
        icon={speaking ? Volume2 : soundDetected ? Waves : VolumeX}
        title={speaking ? 'Speech detected' : soundDetected ? 'Sound detected' : 'Listening'}
        description={`Listening: ${listeningForSpeech ? 'yes' : 'no'} - Recording: ${recording ? 'active' : 'idle'}`}
      />

      <GlassCard>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border/50 bg-surface/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted">
              <Activity className="h-4 w-4" /> Metrics
            </h3>
            <dl className="mt-4 space-y-2 text-sm text-emphasis">
              <div className="flex justify-between">
                <dt>Most recent speech</dt>
                <dd>
                  {mostRecentSpeakingDuration
                    ? `${mostRecentSpeakingDuration} ms (${(mostRecentSpeakingDuration / 1000).toFixed(2)} s)`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Longest silence</dt>
                <dd>
                  {longestSilenceDuration
                    ? `${longestSilenceDuration} ms (${(longestSilenceDuration / 1000).toFixed(2)} s)`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Recorded chunks</dt>
                <dd>{debugInfo?.chunkCount ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Captured duration</dt>
                <dd>
                  {debugInfo?.duration
                    ? `${debugInfo.duration} ms (${(debugInfo.duration / 1000).toFixed(2)} s)`
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border/50 bg-surface/70 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted">
              <Waves className="h-4 w-4" /> Audio info
            </h3>
            <div className="mt-4 space-y-1 text-sm text-emphasis">
              {audioInfo
                ? Object.keys(audioInfo).map((field) => (
                    <div key={field} className="flex justify-between gap-4">
                      <span className="text-muted">{field}</span>
                      <span>{String(audioInfo[field])}</span>
                    </div>
                  ))
                : 'No stream metadata yet.'}
            </div>
          </div>
        </div>
      </GlassCard>

      <audio ref={encodedAudioRef} className="hidden" />
    </div>
  );
}
