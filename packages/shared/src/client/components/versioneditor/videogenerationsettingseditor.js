"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getNestedObjectProperty, nullUndefinedOrEmpty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const selectClass = `${inputClass} appearance-none`;
const textAreaClass = `${inputClass} min-h-[90px] resize-y`;

const DEFAULT_SETTINGS = {
  durationSeconds: 8,
  frameRate: 24,
  aspectRatio: "16:9",
  stylePreset: "",
  safetySensitivity: "medium",
  negativePrompts: [],
  cameraPath: "",
};

function coerceSettings(value) {
  if (nullUndefinedOrEmpty(value)) {
    return { ...DEFAULT_SETTINGS };
  }

  const settings = { ...DEFAULT_SETTINGS, ...value };

  settings.durationSeconds = Number.isFinite(Number(settings.durationSeconds))
    ? Number(settings.durationSeconds)
    : DEFAULT_SETTINGS.durationSeconds;
  settings.frameRate = Number.isFinite(Number(settings.frameRate))
    ? Number(settings.frameRate)
    : DEFAULT_SETTINGS.frameRate;

  if (!Array.isArray(settings.negativePrompts)) {
    if (typeof settings.negativePrompts === "string") {
      settings.negativePrompts = settings.negativePrompts
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    } else {
      settings.negativePrompts = [...DEFAULT_SETTINGS.negativePrompts];
    }
  }

  return settings;
}

export function VideoGenerationSettingsEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => coerceSettings(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [settings, setSettings] = useState(initialValue);

  useEffect(() => {
    const latest = coerceSettings(getNestedObjectProperty(rootObject, field.path));
    setSettings((prev) => {
      const prevKey = JSON.stringify(prev);
      const latestKey = JSON.stringify(latest);
      if (prevKey !== latestKey) {
        return latest;
      }
      return prev;
    });
  }, [rootObject, field.path]);

  const commitChange = (next) => {
    setSettings(next);
    onChange?.(rootObject, field.path, next);
  };

  const updateField = (key, value, transform) => {
    commitChange({
      ...settings,
      [key]: transform ? transform(value) : value,
    });
  };

  const handleNegativePromptsChange = (text) => {
    const prompts = text
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    updateField("negativePrompts", prompts);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Duration (seconds)
          <input
            type="number"
            min={1}
            max={120}
            step={1}
            value={settings.durationSeconds}
            onChange={(event) =>
              updateField("durationSeconds", event.target.value, (val) =>
                Math.max(1, Math.min(120, Number(val) || DEFAULT_SETTINGS.durationSeconds))
              )
            }
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Frame rate (fps)
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            value={settings.frameRate}
            onChange={(event) =>
              updateField("frameRate", event.target.value, (val) =>
                Math.max(1, Math.min(120, Number(val) || DEFAULT_SETTINGS.frameRate))
              )
            }
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Aspect ratio
          <input
            type="text"
            value={settings.aspectRatio}
            onChange={(event) => updateField("aspectRatio", event.target.value)}
            placeholder="e.g. 16:9"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Style preset
          <input
            type="text"
            value={settings.stylePreset}
            onChange={(event) => updateField("stylePreset", event.target.value)}
            placeholder="cinematic, watercolor, etc."
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Safety sensitivity
          <select
            value={settings.safetySensitivity}
            onChange={(event) => updateField("safetySensitivity", event.target.value)}
            className={selectClass}
            disabled={readOnly}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className={labelClass}>
          Camera path (JSON or shorthand)
          <input
            type="text"
            value={settings.cameraPath}
            onChange={(event) => updateField("cameraPath", event.target.value)}
            placeholder='e.g. orbit(subject, 3s)'
            className={inputClass}
            disabled={readOnly}
          />
        </label>
      </div>

      <div className="mt-5">
        <label className={labelClass}>
          Negative prompts (one per line)
          <textarea
            value={(settings.negativePrompts ?? []).join("\n")}
            onChange={(event) => handleNegativePromptsChange(event.target.value)}
            placeholder="bad quality&#10;motion blur"
            className={textAreaClass}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
}

export default VideoGenerationSettingsEditor;
