"use client";

import React, { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";
import { getNestedObjectProperty } from "@src/common/objects";

const cardClass = "rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-soft";
const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40";

function normalizeConnectorRefs(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => ({
    connectorId: entry.connectorId ?? "",
    authProfileId: entry.authProfileId ?? "",
    scopes: Array.isArray(entry.scopes)
      ? entry.scopes.filter(Boolean)
      : typeof entry.scopes === "string"
      ? entry.scopes
          .split(/\r?\n|,/)
          .map((scope) => scope.trim())
          .filter(Boolean)
      : [],
  }));
}

export function ConnectorRefsEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => normalizeConnectorRefs(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [connectorRefs, setConnectorRefs] = useState(initialValue);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    const latest = normalizeConnectorRefs(getNestedObjectProperty(rootObject, field.path));
    const currentKey = JSON.stringify(connectorRefs);
    const latestKey = JSON.stringify(latest);
    if (currentKey !== latestKey) {
      setConnectorRefs(latest);
      setEditingIndex(null);
    }
  }, [rootObject, field.path]);

  const commitChange = (nextRefs) => {
    setConnectorRefs(nextRefs);
    onChange?.(rootObject, field.path, nextRefs);
  };

  const handleAddConnector = () => {
    if (readOnly) return;
    const next = [
      ...connectorRefs,
      {
        connectorId: "",
        authProfileId: "",
        scopes: [],
      },
    ];
    commitChange(next);
    setEditingIndex(next.length - 1);
  };

  const handleUpdate = (index, patch) => {
    commitChange(
      connectorRefs.map((entry, idx) =>
        idx === index
          ? {
              ...entry,
              ...patch,
            }
          : entry
      )
    );
  };

  const handleDelete = (index) => {
    if (readOnly) return;
    commitChange(connectorRefs.filter((_, idx) => idx !== index));
    setEditingIndex(null);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emphasis">Connector registry references</h3>
        <button
          type="button"
          onClick={handleAddConnector}
          disabled={readOnly}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add connector
        </button>
      </div>

      <div className="space-y-4">
        {connectorRefs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-surface/60 px-4 py-6 text-center text-sm text-muted">
            No connectors configured.
          </p>
        ) : null}

        {connectorRefs.map((entry, index) => {
          const isEditing = editingIndex === index;
          const scopesText = (entry.scopes ?? []).join("\n");

          return (
            <div key={`connector-ref-${index}`} className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emphasis">{entry.connectorId || "Connector (unnamed)"}</p>
                  <p className="text-xs text-muted">
                    {entry.authProfileId ? `Profile: ${entry.authProfileId}` : "No auth profile set"}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingIndex(isEditing ? null : index)}
                      className={clsx(iconButtonClass, "text-primary")}
                      title={isEditing ? "Collapse" : "Edit"}
                    >
                      {isEditing ? <Save className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className={clsx(iconButtonClass, "text-rose-400")}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="mt-4 space-y-4">
                  <label className={labelClass}>
                    Connector ID
                    <input
                      type="text"
                      value={entry.connectorId}
                      onChange={(event) => handleUpdate(index, { connectorId: event.target.value })}
                      placeholder="e.g. salesforce/crm"
                      className={inputClass}
                      disabled={readOnly}
                    />
                  </label>

                  <label className={labelClass}>
                    Auth profile ID
                    <input
                      type="text"
                      value={entry.authProfileId}
                      onChange={(event) => handleUpdate(index, { authProfileId: event.target.value })}
                      placeholder="Optional stored profile name"
                      className={inputClass}
                      disabled={readOnly}
                    />
                  </label>

                  <label className={labelClass}>
                    Scopes (one per line)
                    <textarea
                      value={scopesText}
                      onChange={(event) =>
                        handleUpdate(index, {
                          scopes: event.target.value
                            .split(/\r?\n/)
                            .map((scope) => scope.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="ads.readonly&#10;ads.campaigns.readwrite"
                      className={`${inputClass} min-h-[90px] resize-y`}
                      disabled={readOnly}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConnectorRefsEditor;
