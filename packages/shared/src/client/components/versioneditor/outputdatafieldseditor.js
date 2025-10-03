"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";

const cardClass = "rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-soft";
const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const textAreaClass = `${inputClass} min-h-[90px] resize-y`;
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40";

export function OutputDataFieldsEditor({ readOnly, rootObject, relativePath, outputDataFields = [], onChange }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [fields, setFields] = useState(outputDataFields);

  useEffect(() => {
    onChange?.(rootObject, relativePath, fields);
  }, [fields, onChange, rootObject, relativePath]);

  const handleAddDataField = () => {
    const nextField = { variableName: "", dataType: "string", instructions: "", required: false };
    setFields((prev) => [...prev, nextField]);
    setEditingIndex(fields.length);
  };

  const handleEditDataField = (index) => setEditingIndex(index);

  const handleDeleteDataField = (index) => {
    setFields((prev) => prev.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleValueChange = (index, field, value) => {
    setFields((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const handleFinishEditing = () => setEditingIndex(null);

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emphasis">Data Fields</h3>
        <button
          type="button"
          onClick={handleAddDataField}
          disabled={readOnly}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Output Field
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {fields.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-surface/60 px-4 py-6 text-center text-sm text-muted">
            No output fields yet.
          </p>
        ) : null}

        {fields.map((field, index) => {
          const isEditing = editingIndex === index;
          return (
            <div key={`output-field-${index}`} className={cardClass}>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <p className={labelClass}>Variable Name</p>
                    <input
                      className={inputClass}
                      value={field.variableName}
                      placeholder="Enter variable name"
                      onChange={(event) => handleValueChange(index, "variableName", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "Escape") {
                          handleFinishEditing();
                        }
                      }}
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <p className={labelClass}>Datatype</p>
                    <select
                      className={`${inputClass} appearance-none bg-surface`}
                      value={field.dataType ?? "string"}
                      onChange={(event) => handleValueChange(index, "dataType", event.target.value)}
                      disabled={readOnly}
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="array">Array</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>

                  <div>
                    <p className={labelClass}>Instructions</p>
                    <textarea
                      className={textAreaClass}
                      rows={4}
                      value={field.instructions ?? ""}
                      placeholder="Enter instructions"
                      onChange={(event) => handleValueChange(index, "instructions", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === "Escape") {
                          handleFinishEditing();
                        }
                      }}
                      disabled={readOnly}
                    />
                  </div>

                  <label className="flex items-center gap-3 text-sm font-semibold text-emphasis">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(event) => handleValueChange(index, "required", !!event.target.checked)}
                      disabled={readOnly}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>Required</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFinishEditing}
                      className={clsx(iconButtonClass, "text-primary")}
                      disabled={readOnly}
                      title="Save"
                    >
                      <Save className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emphasis">{field.variableName || "Unnamed field"}</p>
                    <p className="text-xs text-muted">{field.instructions || "No instructions"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditDataField(index)}
                      className={clsx(iconButtonClass, "text-primary")}
                      disabled={readOnly}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDataField(index)}
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

export default OutputDataFieldsEditor;
