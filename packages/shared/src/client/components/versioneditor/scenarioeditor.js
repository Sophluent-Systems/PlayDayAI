"use client";

import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Plus, Pencil, Trash2, Save } from "lucide-react";

const cardClass = "rounded-2xl border border-border/60 bg-surface/80 p-4 shadow-soft";
const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const textAreaClass = `${inputClass} min-h-[120px] resize-y`;
const iconButtonClass =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface text-muted transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40";

export function ScenarioEditor({ rootObject, field, value, onChange, readOnly }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [localCatalog, setLocalCatalog] = useState([]);
  const catalogRef = useRef([]);

  useEffect(() => {
    if (Array.isArray(value)) {
      const clone = JSON.parse(JSON.stringify(value));
      catalogRef.current = clone;
      setLocalCatalog(clone);
    } else {
      catalogRef.current = [];
      setLocalCatalog([]);
    }
  }, [value]);

  const commit = (next) => {
    catalogRef.current = next;
    setLocalCatalog(next);
    onChange?.(rootObject, field.path, next);
  };

  const handleAddScenario = () => {
    const next = [
      ...catalogRef.current,
      {
        name: `Scenario ${catalogRef.current.length + 1}`,
        text: "",
        firstEligibleTurn: 3,
        lastEligibleTurn: 999,
      },
    ];
    setEditingIndex(next.length - 1);
    catalogRef.current = next;
    setLocalCatalog(next);
  };

  const handleEditScenario = (index) => setEditingIndex(index);

  const handleDeleteScenario = (index) => {
    const next = catalogRef.current.filter((_, idx) => idx !== index);
    commit(next);
    setEditingIndex(null);
  };

  const handleScenarioChange = (index, name, value) => {
    const next = [...catalogRef.current];
    next[index] = {
      ...next[index],
      [name]: value,
    };
    catalogRef.current = next;
    setLocalCatalog(next);
  };

  const handleDoneEditing = () => {
    commit(catalogRef.current);
    setEditingIndex(null);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-soft backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emphasis">Scenarios</h3>
        <button
          type="button"
          onClick={handleAddScenario}
          disabled={readOnly}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-primary/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add scenario
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {localCatalog.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 bg-surface/60 px-4 py-6 text-center text-sm text-muted">
            No scenarios yet.
          </p>
        ) : null}

        {localCatalog.map((scenario, index) => {
          const isEditing = editingIndex === index;
          return (
            <div key={`scenario-${index}`} className={cardClass}>
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <p className={labelClass}>Name</p>
                    <input
                      className={inputClass}
                      value={scenario.name}
                      name="name"
                      placeholder="Scenario name"
                      onChange={(event) => handleScenarioChange(index, "name", event.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div>
                    <p className={labelClass}>Text</p>
                    <textarea
                      className={textAreaClass}
                      value={scenario.text}
                      name="text"
                      rows={4}
                      placeholder="Define the scenario context"
                      onChange={(event) => handleScenarioChange(index, "text", event.target.value)}
                      disabled={readOnly}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className={labelClass}>First Eligible Turn</p>
                      <input
                        type="number"
                        className={inputClass}
                        value={scenario.firstEligibleTurn}
                        name="firstEligibleTurn"
                        min={1}
                        max={999}
                        onChange={(event) => handleScenarioChange(index, "firstEligibleTurn", Number(event.target.value))}
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <p className={labelClass}>Last Eligible Turn</p>
                      <input
                        type="number"
                        className={inputClass}
                        value={scenario.lastEligibleTurn}
                        name="lastEligibleTurn"
                        min={1}
                        max={999}
                        onChange={(event) => handleScenarioChange(index, "lastEligibleTurn", Number(event.target.value))}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDoneEditing}
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
                    <p className="text-sm font-semibold text-emphasis">{scenario.name}</p>
                    <p className="text-xs text-muted line-clamp-2">{scenario.text || "No scenario text"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditScenario(index)}
                      className={clsx(iconButtonClass, "text-primary")}
                      disabled={readOnly}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteScenario(index)}
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

export default ScenarioEditor;
