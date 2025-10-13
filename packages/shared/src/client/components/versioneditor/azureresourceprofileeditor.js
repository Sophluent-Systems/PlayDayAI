"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const DEFAULT_PROFILE = {
  tenantId: "",
  subscriptionId: "",
  aiFoundryEndpoint: "",
  loggingWorkspaceId: "",
  telemetrySampleRate: 1,
};

function normalizeProfile(value) {
  if (!value) {
    return { ...DEFAULT_PROFILE };
  }
  return {
    tenantId: value.tenantId ?? "",
    subscriptionId: value.subscriptionId ?? "",
    aiFoundryEndpoint: value.aiFoundryEndpoint ?? value.endpoint ?? "",
    loggingWorkspaceId: value.loggingWorkspaceId ?? "",
    telemetrySampleRate: Number.isFinite(Number(value.telemetrySampleRate))
      ? Number(value.telemetrySampleRate)
      : DEFAULT_PROFILE.telemetrySampleRate,
  };
}

export function AzureResourceProfileEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => normalizeProfile(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [profile, setProfile] = useState(initialValue);

  useEffect(() => {
    const latest = normalizeProfile(getNestedObjectProperty(rootObject, field.path));
    const latestKey = JSON.stringify(latest);
    const currentKey = JSON.stringify(profile);
    if (latestKey !== currentKey) {
      setProfile(latest);
    }
  }, [rootObject, field.path]);

  const updateField = (key, value) => {
    const next = {
      ...profile,
      [key]: key === "telemetrySampleRate" ? Math.max(0, Number(value) || 0) : value,
    };
    setProfile(next);
    onChange?.(rootObject, field.path, next);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Entra tenant ID
          <input
            type="text"
            value={profile.tenantId}
            onChange={(event) => updateField("tenantId", event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Subscription ID
          <input
            type="text"
            value={profile.subscriptionId}
            onChange={(event) => updateField("subscriptionId", event.target.value)}
            placeholder="Optional subscription GUID"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Azure AI Foundry endpoint
          <input
            type="text"
            value={profile.aiFoundryEndpoint}
            onChange={(event) => updateField("aiFoundryEndpoint", event.target.value)}
            placeholder="https://your-resource.cognitiveservices.azure.com"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Log Analytics workspace ID
          <input
            type="text"
            value={profile.loggingWorkspaceId}
            onChange={(event) => updateField("loggingWorkspaceId", event.target.value)}
            placeholder="Optional workspace ID"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Telemetry sample rate
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={profile.telemetrySampleRate}
            onChange={(event) => updateField("telemetrySampleRate", event.target.value)}
            className={inputClass}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
}

export default AzureResourceProfileEditor;
