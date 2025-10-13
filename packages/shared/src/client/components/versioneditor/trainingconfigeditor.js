"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const selectClass = `${inputClass} appearance-none`;
const textAreaClass = `${inputClass} min-h-[72px] resize-y`;

const DEFAULT_CONFIG = {
  optimizer: "adamw",
  learningRate: 1e-4,
  epochs: 3,
  loraRank: 16,
  targetTokens: 200000,
  checkpointInterval: 1000,
  gpuTier: "A10",
  evalDatasets: [],
};

function normalizeTrainingConfig(value) {
  if (!value) {
    return { ...DEFAULT_CONFIG };
  }
  return {
    optimizer: value.optimizer ?? DEFAULT_CONFIG.optimizer,
    learningRate: Number(value.learningRate) || DEFAULT_CONFIG.learningRate,
    epochs: Number.isFinite(Number(value.epochs)) ? Number(value.epochs) : DEFAULT_CONFIG.epochs,
    loraRank: Number.isFinite(Number(value.loraRank)) ? Number(value.loraRank) : DEFAULT_CONFIG.loraRank,
    targetTokens: Number.isFinite(Number(value.targetTokens))
      ? Number(value.targetTokens)
      : DEFAULT_CONFIG.targetTokens,
    checkpointInterval: Number.isFinite(Number(value.checkpointInterval))
      ? Number(value.checkpointInterval)
      : DEFAULT_CONFIG.checkpointInterval,
    gpuTier: value.gpuTier ?? DEFAULT_CONFIG.gpuTier,
    evalDatasets: Array.isArray(value.evalDatasets)
      ? value.evalDatasets.filter(Boolean)
      : typeof value.evalDatasets === "string"
      ? value.evalDatasets
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [...DEFAULT_CONFIG.evalDatasets],
  };
}

export function TrainingConfigEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => normalizeTrainingConfig(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [config, setConfig] = useState(initialValue);

  useEffect(() => {
    const latest = normalizeTrainingConfig(getNestedObjectProperty(rootObject, field.path));
    if (JSON.stringify(latest) !== JSON.stringify(config)) {
      setConfig(latest);
    }
  }, [rootObject, field.path]);

  const updateField = (key, value) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onChange?.(rootObject, field.path, next);
  };

  const updateNumberField = (key, value, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      updateField(key, fallback);
    } else {
      updateField(key, numeric);
    }
  };

  const updateEvalDatasets = (value) => {
    const datasets = value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    updateField("evalDatasets", datasets);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Optimizer
          <select
            value={config.optimizer}
            onChange={(event) => updateField("optimizer", event.target.value)}
            className={selectClass}
            disabled={readOnly}
          >
            <option value="adamw">AdamW</option>
            <option value="sgd">SGD</option>
            <option value="adafactor">Adafactor</option>
            <option value="lion">Lion</option>
          </select>
        </label>

        <label className={labelClass}>
          Learning rate
          <input
            type="number"
            step={1e-5}
            min={1e-6}
            value={config.learningRate}
            onChange={(event) => updateNumberField("learningRate", event.target.value, DEFAULT_CONFIG.learningRate)}
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Epochs
          <input
            type="number"
            min={1}
            max={50}
            value={config.epochs}
            onChange={(event) => updateNumberField("epochs", event.target.value, DEFAULT_CONFIG.epochs)}
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          LoRA rank
          <input
            type="number"
            min={1}
            max={256}
            value={config.loraRank}
            onChange={(event) => updateNumberField("loraRank", event.target.value, DEFAULT_CONFIG.loraRank)}
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Target tokens
          <input
            type="number"
            min={1000}
            value={config.targetTokens}
            onChange={(event) => updateNumberField("targetTokens", event.target.value, DEFAULT_CONFIG.targetTokens)}
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Checkpoint interval
          <input
            type="number"
            min={100}
            value={config.checkpointInterval}
            onChange={(event) =>
              updateNumberField("checkpointInterval", event.target.value, DEFAULT_CONFIG.checkpointInterval)
            }
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          GPU tier
          <select
            value={config.gpuTier}
            onChange={(event) => updateField("gpuTier", event.target.value)}
            className={selectClass}
            disabled={readOnly}
          >
            <option value="A10">A10 (24 GB)</option>
            <option value="A100">A100 (40 GB)</option>
            <option value="H100">H100 (80 GB)</option>
            <option value="L40S">L40S</option>
            <option value="custom">Custom / Other</option>
          </select>
        </label>
      </div>

      <div className="mt-5">
        <label className={labelClass}>
          Evaluation datasets (one per line)
          <textarea
            value={(config.evalDatasets ?? []).join("\n")}
            onChange={(event) => updateEvalDatasets(event.target.value)}
            placeholder="gs://bucket/eval.jsonl&#10;https://example.com/checkpoint-validation.jsonl"
            className={textAreaClass}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
}

export default TrainingConfigEditor;
