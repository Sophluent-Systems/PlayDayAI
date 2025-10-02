"use client";

import React, { useCallback, useState } from "react";
import clsx from "clsx";
import { useDropzone } from "react-dropzone";
import { FileText } from "lucide-react";

export function FileDropZone({ onFileDrop, disabled, file }) {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileDrop?.(acceptedFiles[0]);
      }
      setIsDragging(false);
    },
    [onFileDrop]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    disabled,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const isActive = Boolean(file) || isDragging;

  return (
    <div
      {...getRootProps()}
      className={clsx(
        "group relative flex min-h-[140px] w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isActive
          ? "border-primary/60 bg-primary/10 text-primary shadow-[0_20px_45px_-28px_rgba(99,102,241,0.35)]"
          : "border-border/60 bg-surface/80 text-muted hover:border-primary/40 hover:bg-primary/5"
      )}
    >
      <input {...getInputProps()} />
      {file ? (
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
            <FileText className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="max-w-[220px] truncate text-sm font-semibold text-emphasis">
            {file.name}
          </span>
          <span className="text-xs text-muted">
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-emphasis">
            {isDragging ? "Drop the file here" : "Drag and drop a file"}
          </p>
          <p className="text-xs text-muted">
            Supports documents, images, and audio clips.
          </p>
        </div>
      )}
    </div>
  );
}