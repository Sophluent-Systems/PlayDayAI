"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";
import { UploadCloud, SendHorizonal, Trash2 } from "lucide-react";
import { SpeechRecorder } from "./speechrecorder";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const emptyMedia = {
  text: {
    data: "",
    source: "blob",
    type: "text",
    mimeType: "text",
  },
};

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
  handleSendMessage,
  debug,
}) {
  const [media, setMedia] = useState(emptyMedia);

  const supportsText = nullUndefinedOrEmpty(supportedMediaTypes) || supportedMediaTypes.includes("text");
  const supportsAudio = supportedMediaTypes?.includes("audio");
  const supportsImage = supportedMediaTypes?.includes("image");
  const supportsVideo = supportedMediaTypes?.includes("video");
  const dropEnabled = supportsImage || supportsVideo;

  const previews = useObjectURLs(media);

  const handleAudioSave = (blob) => {
    if (sendAudioOnSpeechEnd) {
      handleSendMessage({
        audio: {
          data: blob,
          mimeType: "audio/webm",
          source: "blob",
        },
      });
      return;
    }

    setMedia((prev) => ({
      ...prev,
      audio: {
        data: blob,
        mimeType: "audio/webm",
        source: "blob",
      },
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
    if (!payload.text?.data?.trim()) {
      delete payload.text;
    }
    handleSendMessage(payload);
    setMedia(emptyMedia);
  };

  const messageHasContent = useMemo(() => {
    const hasText = Boolean(media.text?.data?.trim());
    const hasMedia = Boolean(media.audio || media.image || media.video);
    return hasText || hasMedia;
  }, [media]);

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

  return (
    <div
      className="w-full rounded-3xl border border-border/60 bg-surface/90 p-4 shadow-soft backdrop-blur-xl"
      style={{ backgroundColor: accentBackground, borderColor: accentBorderColor }}
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
        {supportsText ? (
          <div className="flex-1">
            <textarea
              maxLength={inputLength}
              value={media.text?.data ?? ""}
              onChange={(event) => updateText(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={!waitingForInput}
              placeholder="Type your next turn here…"
              className="min-h-[56px] w-full resize-y rounded-2xl border border-border/60 px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
              style={{ backgroundColor: textFieldBackground }}
            />
          </div>
        ) : null}

        <div className="flex w-full items-center justify-end gap-3 md:w-auto">
          {supportsAudio && !media.audio ? (
            <SpeechRecorder
              onRecordingComplete={handleAudioSave}
              disableListening={!waitingForInput}
              debug={debug}
            />
          ) : null}

          {(media.audio || media.image || media.video) ? (
            <div className="flex items-center gap-3">
              {media.audio && previews.audio ? (
                <audio src={previews.audio} controls className="max-w-[180px]" />
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
              "inline-flex h-11 min-w-[48px] items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              waitingForInput && messageHasContent
                ? "bg-primary hover:bg-primary/90"
                : "bg-border/70 text-muted",
            )}
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
