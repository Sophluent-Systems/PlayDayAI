"use client";

import React, { useEffect, useState } from "react";
import { Plus, Pencil, Save, Trash2, X, Loader2 } from "lucide-react";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { FileDropZone } from "@src/client/components/standard/filedropzone";
import { callUploadBlob } from "@src/client/blobclient";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const textAreaClass = `${inputClass} min-h-[90px] resize-y`;
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40";

export function FileStoreEditor({ files = [], onChange, readOnly, rootObject, relativePath }) {
  const [filesState, setFilesState] = useState(files);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [fileToUpload, setFileToUpload] = useState(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    onChange?.(rootObject, relativePath, filesState);
  }, [filesState, onChange, rootObject, relativePath]);

  const getMimeTypeFromExtension = (extension) => {
    switch (extension) {
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      case "gif":
        return "image/gif";
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "mp4":
        return "video/mp4";
      case "csv":
        return "text/csv";
      case "zip":
        return "application/zip";
      case "tar":
        return "application/x-tar";
      case "gz":
        return "application/gzip";
      default:
        return "application/octet-stream";
    }
  };

  const getNextAvailableFileName = () => {
    let i = 1;
    while (true) {
      const candidate = `file${i}`;
      if (!filesState.some((file) => file.fileName === candidate)) {
        return candidate;
      }
      i += 1;
    }
  };

  const handleAddFile = () => {
    const newFileName = getNextAvailableFileName();
    const newFile = {
      fileName: newFileName,
      file: {},
    };
    setFilesState((prev) => [...prev, newFile]);
    setEditingFileIndex(filesState.length);
    setUrl("");
    setFileToUpload(null);
    setHasUnsavedChanges(false);
  };

  const handleEditFile = (index) => {
    const fileToEdit = filesState[index];
    setEditingFileIndex(index);
    if (fileToEdit.file) {
      if (fileToEdit.file.source === "storage") {
        setFileToUpload({ name: fileToEdit.fileName, type: fileToEdit.file.mimeType });
        setUrl("");
      } else if (fileToEdit.file.source === "url") {
        setUrl(fileToEdit.file.data ?? "");
        setFileToUpload(null);
      }
    } else {
      setFileToUpload(null);
      setUrl("");
    }
  };

  const handleDeleteFile = (index) => {
    setFilesState((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleFileNameChange = (index, value) => {
    setFilesState((prev) => {
      const next = [...prev];
      if (next.some((file, i) => i !== index && file.fileName === value)) {
        return next;
      }
      next[index] = {
        ...next[index],
        fileName: value,
      };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (index, value) => {
    setFilesState((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        description: value,
      };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleFileDrop = (file) => {
    setFileToUpload(file);
    setUrl("");
    if (editingFileIndex !== null) {
      handleFileNameChange(editingFileIndex, file.name ?? getNextAvailableFileName());
    }
    setHasUnsavedChanges(true);
  };

  const handleUrlChange = (event) => {
    const newUrl = event.target.value;
    setUrl(newUrl);
    setFileToUpload(null);
    if (editingFileIndex !== null) {
      const suggestedName = newUrl.split("/").pop()?.split("#")[0]?.split("?")[0] ?? getNextAvailableFileName();
      handleFileNameChange(editingFileIndex, suggestedName);
    }
    setHasUnsavedChanges(true);
  };

  const handleClearFile = () => {
    setFileToUpload(null);
    setUrl("");
    if (editingFileIndex !== null) {
      setFilesState((prev) => {
        const next = [...prev];
        next[editingFileIndex] = {
          ...next[editingFileIndex],
          file: {},
        };
        return next;
      });
    }
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm("You have unsaved changes. Cancel editing?");
      if (!confirmCancel) {
        return;
      }
    }

    if (editingFileIndex !== null) {
      if (filesState[editingFileIndex]?.file && Object.keys(filesState[editingFileIndex].file).length === 0) {
        setFilesState((prev) => prev.filter((_, idx) => idx !== editingFileIndex));
      }
    }

    setEditingFileIndex(null);
    setFileToUpload(null);
    setUrl("");
    setHasUnsavedChanges(false);
  };

  const handleFinishEditing = async () => {
    const index = editingFileIndex;
    if (index === null) {
      return;
    }

    const currentFile = filesState[index];
    if (!currentFile.fileName || currentFile.fileName.trim().length === 0) {
      handleFileNameChange(index, getNextAvailableFileName());
    }

    setUploading(index);

    try {
      if (fileToUpload instanceof File) {
        const uploadResult = await callUploadBlob(fileToUpload, currentFile.fileName);
        if (uploadResult) {
          setFilesState((prev) => {
            const next = [...prev];
            next[index] = {
              ...next[index],
              file: {
                data: uploadResult.blobID,
                mimeType: uploadResult.mimeType,
                source: "storage",
              },
            };
            return next;
          });
        }
      } else if (url && url !== currentFile.file?.data) {
        const extension = url.split(".").pop()?.toLowerCase() ?? "";
        const mimeType = getMimeTypeFromExtension(extension);
        setFilesState((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            file: {
              data: url,
              mimeType,
              source: "url",
            },
          };
          return next;
        });
      }

      setHasUnsavedChanges(false);
      setEditingFileIndex(null);
      setFileToUpload(null);
      setUrl("");
    } catch (error) {
      console.error("Error uploading file", error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emphasis">File Store</h3>
        <button
          type="button"
          onClick={handleAddFile}
          disabled={readOnly}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add File
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {filesState.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-surface/60 px-4 py-6 text-center text-sm text-muted">
            No files have been added yet.
          </p>
        ) : null}

        {filesState.map((file, index) => {
          const isEditing = editingFileIndex === index;
          return (
            <div
              key={`file-${index}`}
              className={clsx(
                "rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-soft",
                isEditing ? "ring-1 ring-primary/40" : undefined,
              )}
            >
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <p className={fieldLabelClass}>File Name</p>
                    <input
                      className={inputClass}
                      value={file.fileName}
                      placeholder="Enter file name"
                      onChange={(event) => handleFileNameChange(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "Escape") {
                          handleFinishEditing();
                        }
                      }}
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <p className={fieldLabelClass}>Description / Keywords</p>
                    <textarea
                      className={textAreaClass}
                      rows={2}
                      value={file.description || ""}
                      placeholder="Enter description or keywords"
                      onChange={(event) => handleDescriptionChange(index, event.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="space-y-3">
                    <p className={fieldLabelClass}>File Source</p>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start">
                      {nullUndefinedOrEmpty(fileToUpload) && !file.file?.source ? (
                        <input
                          className={inputClass}
                          placeholder="Paste a URL here"
                          value={url}
                          onChange={handleUrlChange}
                          disabled={readOnly || Boolean(fileToUpload)}
                        />
                      ) : null}

                      {nullUndefinedOrEmpty(url) && !file.file?.source ? (
                        <div className="flex h-full items-center justify-center md:w-64">
                          <FileDropZone onFileDrop={handleFileDrop} file={fileToUpload} disabled={readOnly} />
                        </div>
                      ) : null}

                      {file.file?.source === "storage" ? (
                        <p className="rounded-2xl border border-border/40 bg-surface/60 px-4 py-2 text-sm text-muted">
                          Uploaded blob: <span className="font-medium text-emphasis">{file.fileName}</span>
                        </p>
                      ) : null}

                      {file.file?.source === "url" ? (
                        <p className="rounded-2xl border border-border/40 bg-surface/60 px-4 py-2 text-sm text-muted">
                          URL: <span className="font-medium text-emphasis">{file.file.data}</span>
                        </p>
                      ) : null}
                    </div>
                    {(url || fileToUpload || file.file?.data) ? (
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className={clsx(iconButtonClass, "text-rose-400")}
                        disabled={readOnly}
                        title="Clear file"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {uploading === index ? (
                      <span className="inline-flex h-10 w-10 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleFinishEditing}
                          className={clsx(iconButtonClass, "text-primary")}
                          disabled={
                            readOnly ||
                            uploading !== null ||
                            !file.fileName ||
                            file.fileName.trim().length === 0 ||
                            (nullUndefinedOrEmpty(fileToUpload) && nullUndefinedOrEmpty(url) && nullUndefinedOrEmpty(file.file?.data))
                          }
                          title="Save"
                        >
                          <Save className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className={clsx(iconButtonClass, "text-muted")}
                          disabled={uploading !== null}
                          title="Cancel"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emphasis">{file.fileName}</p>
                    <p className="text-xs text-muted">{file.description || "No description"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditFile(index)}
                      className={clsx(iconButtonClass, "text-primary")}
                      disabled={readOnly}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(index)}
                      className={clsx(iconButtonClass, "text-rose-400")}
                      disabled={readOnly}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FileStoreEditor;
