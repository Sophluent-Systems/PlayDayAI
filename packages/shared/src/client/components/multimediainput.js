"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";
import { UploadCloud, SendHorizonal, Trash2 } from "lucide-react";
import { SpeechRecorder } from "./speechrecorder";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const createEmptyMedia = () => ({
  text: {
    data: "",
    source: "blob",
    type: "text",
    mimeType: "text",
  },
});

function useObjectURLs(media) {
  const [urls, setUrls] = useState({ audio: null, image: null, video: null });

  useEffect(() => {
    const next = { audio: null, image: null, video: null };

    if (media.audio?.data) {
      next.audio = URL.createObjectURL(media.audio.data);
    }
    if (media.image?.data) {
      next.image = URL.createObjectURL(media.image.data);
    }
    if (media.video?.data) {
      next.video = URL.createObjectURL(media.video.data);
    }

    setUrls(next);

    return () => {
      Object.values(next)
        .filter(Boolean)
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, [media.audio, media.image, media.video]);

  return urls;
}

export function MultimediaInput({
  theme,
  inputLength,
  waitingForInput,
  sendAudioOnSpeechEnd,
  supportedMediaTypes,
  supportedInputModes = [],
  handleSendMessage,
  debug,
}) {
  const [media, setMedia] = useState(() => createEmptyMedia());

  const supportsText = nullUndefinedOrEmpty(supportedMediaTypes) || supportedMediaTypes.includes("text");
  const supportsAudio = supportedMediaTypes?.includes("audio");
  const supportsImage = supportedMediaTypes?.includes("image");
  const supportsVideo = supportedMediaTypes?.includes("video");
  const dropEnabled = supportsImage || supportsVideo;

  const allowText = supportsText || supportedInputModes.includes("text");
  const allowStt = supportedInputModes.includes("stt");
  const allowAudioClip = supportedInputModes.includes("audio") || supportsAudio;
  const allowAudio = allowStt || allowAudioClip;

  const MIN_TEXTAREA_HEIGHT = 44;
  const MAX_TEXTAREA_HEIGHT = 200;

  const textAreaRef = useRef(null);

  const previews = useObjectURLs(media);

  const computeInputMode = (payload) => {
    if (payload?.audio) {
      if (allowStt) {
        return "stt";
      }
      if (allowAudioClip) {
        return "audio";
      }
    }
    if (allowText) {
      return "text";
    }
    return null;
  };

  useEffect(() => {
    if (!allowText && media.text?.data) {
      setMedia((prev) => ({
        ...prev,
        text: { ...prev.text, data: "" },
      }));
    }
  }, [allowText, media.text?.data]);

  useEffect(() => {
    if (!allowText) {
      return;
    }

    const element = textAreaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(element.scrollHeight, MIN_TEXTAREA_HEIGHT),
      MAX_TEXTAREA_HEIGHT,
    );
    element.style.height = `${nextHeight}px`;
  }, [media.text?.data, allowText]);

  const resetMedia = () => setMedia(createEmptyMedia());

  const handleAudioSave = (blob) => {
    if (!blob) {
      return;
    }

    const audioPayload = {
      audio: {
        data: blob,
        mimeType: blob?.type || "audio/mpeg",
        source: "blob",
      },
    };

    if (sendAudioOnSpeechEnd) {
      const mode = computeInputMode(audioPayload);
      const options = mode ? { mode } : {};
      handleSendMessage(audioPayload, options);
      resetMedia();
      return;
    }

    setMedia((prev) => ({
      ...prev,
      audio: audioPayload.audio,
    }));
  };

  const handleMediaDelete = () => {
    setMedia((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key !== "text") {
          delete next[key];
        }
      });
      return next;
    });
  };

  const updateText = (text) => {
    if (!allowText) {
      return;
    }
    setMedia((prev) => ({
      ...prev,
      text: {
        data: text,
        source: "blob",
        mimeType: "text",
      },
    }));
  };

  const doSendMessage = () => {
    const payload = { ...media };
    if (!allowText || !payload.text?.data?.trim()) {
      delete payload.text;
    }
    if (!payload.text && !payload.audio && !payload.image && !payload.video) {
      return;
    }
    const mode = computeInputMode(payload);
    const options = mode ? { mode } : {};
    handleSendMessage(payload, options);
    resetMedia();
  };

  const messageHasContent = useMemo(() => {
    const hasText = allowText && Boolean(media.text?.data?.trim());
    const hasAudio = Boolean(media.audio);
    const hasAttachments = Boolean(media.image || media.video);
    return hasText || hasAudio || hasAttachments;
  }, [media, allowText]);

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (waitingForInput && messageHasContent) {
        doSendMessage();
      }
    }
  };

  const dropzone = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) {
        return;
      }
      const [type] = file.type.split("/");
      if ((type === "image" && !supportsImage) || (type === "video" && !supportsVideo)) {
        return;
      }
      setMedia((prev) => ({
        ...prev,
        [type]: {
          data: file,
          mimeType: file.type,
          source: "blob",
        },
      }));
    },
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/gif": [],
      "video/mp4": [],
      "video/mpeg": [],
      "video/quicktime": [],
    },
    multiple: false,
    noClick: !dropEnabled,
    disabled: !dropEnabled,
  });

  const { getRootProps, getInputProps, isDragActive } = dropzone;

  const accentBorderColor = theme?.colors?.borderColor || "rgba(148, 163, 184, 0.35)";
  const accentBackground = theme?.colors?.inputAreaBackgroundColor || "rgba(15, 23, 42, 0.35)";
  const textFieldBackground = theme?.colors?.inputAreaTextEntryBackgroundColor || "rgba(15, 23, 42, 0.18)";
  const textFieldColor = theme?.colors?.inputTextEnabledColor || theme?.palette?.textPrimary || "#F8FAFF";
  const placeholderColor = theme?.colors?.inputTextDisabledColor || theme?.palette?.textSecondary || "#94A3B8";
  const caretColor = theme?.palette?.accent || theme?.colors?.sendMessageButtonActiveColor || "#38BDF8";

  return (
    <div
      className="w-full rounded-3xl border border-border/60 bg-surface/90 p-4 shadow-soft"
      style={{ 
        backgroundColor: accentBackground, 
        borderColor: accentBorderColor,
        isolation: 'isolate',
        pointerEvents: 'auto'
      }}
    >
      {dropEnabled ? (
        <div
          {...getRootProps({
            className: clsx(
              "relative flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed text-sm transition",
              isDragActive
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/50 bg-surface/60 text-muted hover:border-primary/40 hover:bg-primary/5",
            ),
            style: { pointerEvents: 'auto' }
          })}
        >
          <input {...getInputProps()} />
          <UploadCloud className="mb-2 h-6 w-6" aria-hidden="true" />
          <p className="text-xs font-medium">
            {isDragActive
              ? "Drop the file to attach"
              : supportsImage && supportsVideo
              ? "Drag an image or video here, or click to browse"
              : supportsImage
              ? "Drag an image here, or click to browse"
              : "Drag a video here, or click to browse"}
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
        {allowText ? (
          <label className="relative block w-full cursor-text md:flex-1" style={{ minHeight: `${MIN_TEXTAREA_HEIGHT}px` }}>
            <textarea
              ref={textAreaRef}
              maxLength={inputLength}
              value={media.text?.data ?? ""}
              onChange={(event) => updateText(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={!waitingForInput}
              placeholder="Type your next turn here..."
              rows={1}
              className="block w-full resize-none rounded-2xl border border-border/60 px-4 py-3 text-base text-emphasis placeholder:text-[var(--placeholder-color)] transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ 
                backgroundColor: textFieldBackground,
                color: textFieldColor,
                caretColor,
                '--placeholder-color': placeholderColor,
                minHeight: `${MIN_TEXTAREA_HEIGHT}px`,
                height: 'auto',
                boxSizing: 'border-box',
                display: 'block',
                overflow: 'hidden',
                WebkitAppearance: 'none'
              }}
            />
          </label>
        ) : null}

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-3 md:w-auto md:flex-nowrap" style={{ pointerEvents: 'auto' }}>
          {allowAudio && !media.audio ? (
            <SpeechRecorder
              onRecordingComplete={handleAudioSave}
              disableListening={!waitingForInput || !allowAudio}
              debug={debug}
            />
          ) : null}

          {(media.audio || media.image || media.video) ? (
            <div className="flex flex-wrap items-center gap-3">
              {media.audio && previews.audio ? (
                <audio src={previews.audio} controls className="max-w-[180px] w-full sm:w-auto" />
              ) : null}
              {media.image && previews.image ? (
                <img
                  src={previews.image}
                  alt="Selected attachment"
                  className="h-20 w-20 rounded-2xl object-cover"
                />
              ) : null}
              {media.video && previews.video ? (
                <video src={previews.video} className="h-20 w-32 rounded-2xl object-cover" controls />
              ) : null}
              <button
                type="button"
                onClick={handleMediaDelete}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-rose-400 transition hover:border-rose-400/70 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30"
                title="Remove attachment"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={doSendMessage}
            disabled={!waitingForInput || !messageHasContent}
            className={clsx(
              "inline-flex h-11 min-w-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              waitingForInput && messageHasContent
                ? "bg-primary hover:bg-primary/90"
                : "bg-border/70 text-muted",
            )}
            style={{ pointerEvents: 'auto' }}
          >
            <SendHorizonal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden md:inline">Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MultimediaInput;





