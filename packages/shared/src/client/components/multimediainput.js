import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useDropzone } from 'react-dropzone';
import { Trash2, SendHorizontal } from 'lucide-react';
import { SpeechRecorder } from './speechrecorder';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const emptyMedia = {
  text: {
    data: '',
    source: 'blob',
    type: 'text',
    mimeType: 'text',
  },
};

export const MultimediaInput = (props) => {
  const {
    theme,
    inputLength,
    waitingForInput,
    sendAudioOnSpeechEnd,
    supportedMediaTypes,
    handleSendMessage,
    debug,
  } = props;

  const [media, setMedia] = useState(emptyMedia);
  const [isDragging, setIsDragging] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');

  const palette = useMemo(
    () => ({
      surface: theme?.colors?.inputAreaTextEntryBackgroundColor ?? '#1f2937',
      text: theme?.colors?.inputTextEnabledColor ?? '#f8fafc',
      muted: theme?.colors?.inputTextDisabledColor ?? '#94a3b8',
      accent: theme?.colors?.sendMessageButtonActiveColor ?? '#38bdf8',
      accentHover: theme?.colors?.sendMessageButtonActiveHoverColor ?? '#0ea5e9',
    }),
    [theme],
  );

  const cssVars = {
    '--pd-input-surface': palette.surface,
    '--pd-text-primary': palette.text,
    '--pd-text-muted': palette.muted,
    '--pd-highlight': palette.accent,
    '--pd-highlight-hover': palette.accentHover,
  };

  const supportsText = nullUndefinedOrEmpty(supportedMediaTypes) || supportedMediaTypes.includes('text');
  const supportsAudio = supportedMediaTypes && supportedMediaTypes.includes('audio');
  const supportsImage = supportedMediaTypes && supportedMediaTypes.includes('image');
  const supportsVideo = supportedMediaTypes && supportedMediaTypes.includes('video');

  const handleAudioSave = (blob) => {
    if (sendAudioOnSpeechEnd) {
      handleSendMessage({
        audio: {
          data: blob,
          mimeType: 'audio/webm',
          source: 'blob',
        },
      });
    } else {
      setMedia((prev) => ({
        ...prev,
        audio: {
          data: blob,
          mimeType: 'audio/webm',
          source: 'blob',
        },
      }));
    }
  };

  useEffect(() => {
    if (media?.audio) {
      const newAudioUrl = URL.createObjectURL(media.audio.data);
      setAudioUrl(newAudioUrl);
      return () => URL.revokeObjectURL(newAudioUrl);
    }
    setAudioUrl('');
    return undefined;
  }, [media]);

  const handleMediaDelete = () => {
    setMedia((prev) => {
      const next = { ...prev };
      Object.keys(prev).forEach((type) => {
        if (type !== 'text') {
          delete next[type];
        }
      });
      return next;
    });
  };

  const doSendMessage = () => {
    const payload = { ...media };
    if (payload.text?.data === '') {
      delete payload.text;
    }
    handleSendMessage(payload);
    setMedia(emptyMedia);
  };

  const handleInputKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      doSendMessage();
    }
  };

  const updateText = (text) => {
    setMedia((prev) => ({
      ...prev,
      text: {
        data: text,
        source: 'blob',
        mimeType: 'text',
      },
    }));
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      const type = file.type.split('/')[0];
      setMedia((prev) => ({
        ...prev,
        [type]: {
          data: file,
          mimeType: file.type,
          source: 'blob',
        },
      }));
      setIsDragging(false);
    },
    noClick: true,
    noKeyboard: true,
    accept: {
      'audio/mpeg': [],
      'audio/webm': [],
      'video/mp4': [],
      'video/mpeg': [],
      'video/quicktime': [],
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
    },
    onDragOver: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const dropzoneActive = supportsImage || supportsVideo;
  const rootProps = dropzoneActive ? getRootProps({ className: 'focus:outline-none' }) : {};
  const inputProps = dropzoneActive ? getInputProps() : {};

  const hasAttachments = Boolean(media.image || media.video || media.audio);

  return (
    <div
      {...rootProps}
      style={cssVars}
      className={clsx(
        'relative flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-[color:var(--pd-input-surface)]/70 p-4 shadow-inner shadow-black/20 transition',
        isDragging && 'border-[color:var(--pd-highlight)]/60 bg-[color:var(--pd-highlight)]/10',
      )}
    >
      {dropzoneActive && (
        <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-4 text-center text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--pd-text-muted)]">
          <input {...inputProps} />
          {isDragging
            ? 'Drop the file to attach it'
            : supportsImage && supportsVideo
            ? 'Drag imagery or video here, or paste from clipboard'
            : supportsImage
            ? 'Drag an image or paste to attach'
            : 'Drag a video file or paste a link'}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {supportsText && (
          <input
            type="text"
            value={media.text?.data ?? ''}
            onChange={(event) => updateText(event.target.value)}
            onKeyUp={handleInputKeyPress}
            maxLength={inputLength}
            disabled={!waitingForInput}
            placeholder="Type your next turn here..."
            className="h-12 flex-1 rounded-xl border border-white/10 bg-[color:var(--pd-input-surface)] px-4 text-sm font-medium text-[color:var(--pd-text-primary)] placeholder:text-[color:var(--pd-text-muted)] focus:border-[color:var(--pd-highlight)]/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--pd-highlight)]/30 disabled:cursor-not-allowed disabled:opacity-60"
          />
        )}

        {supportsAudio && !media.audio && (
          <div className="flex justify-end md:justify-center">
            <SpeechRecorder
              onRecordingComplete={handleAudioSave}
              audioTrackConstraints={{ noiseSuppression: true, echoCancellation: true }}
              showVisualizer
              speechDetection
              disableListening={!waitingForInput}
              debug={debug}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {media.audio && audioUrl && (
            <audio src={audioUrl} controls className="max-w-[220px] rounded-lg bg-black/40" />
          )}
          {hasAttachments && (
            <button
              type="button"
              onClick={handleMediaDelete}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--pd-text-primary)] transition hover:border-red-400/60 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={doSendMessage}
            disabled={!waitingForInput}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--pd-highlight)] text-black shadow-soft transition hover:bg-[color:var(--pd-highlight-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
