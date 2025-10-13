"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
const textAreaClass = `${inputClass} min-h-[72px] resize-y`;

const DEFAULT_CONFIG = {
  freshnessWindow: "7d",
  locale: "en-US",
  snippetLimit: 5,
  safeMode: true,
  allowedDomains: [],
};

function normalizeSearchConfig(value) {
  if (!value) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    freshnessWindow: value.freshnessWindow ?? DEFAULT_CONFIG.freshnessWindow,
    locale: value.locale ?? DEFAULT_CONFIG.locale,
    snippetLimit: Number.isFinite(Number(value.snippetLimit))
      ? Number(value.snippetLimit)
      : DEFAULT_CONFIG.snippetLimit,
    safeMode: typeof value.safeMode === "boolean" ? value.safeMode : Boolean(value.safeMode ?? DEFAULT_CONFIG.safeMode),
    allowedDomains: Array.isArray(value.allowedDomains)
      ? value.allowedDomains.filter(Boolean)
      : typeof value.allowedDomains === "string"
      ? value.allowedDomains
          .split(/\r?\n|,/)
          .map((domain) => domain.trim())
          .filter(Boolean)
      : [...DEFAULT_CONFIG.allowedDomains],
  };
}

export function SearchConfigEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => normalizeSearchConfig(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [config, setConfig] = useState(initialValue);

  useEffect(() => {
    const latest = normalizeSearchConfig(getNestedObjectProperty(rootObject, field.path));
    if (JSON.stringify(latest) !== JSON.stringify(config)) {
      setConfig(latest);
    }
  }, [rootObject, field.path]);

  const updateField = (key, value) => {
    const next = { ...config, [key]: value };
    setConfig(next);
    onChange?.(rootObject, field.path, next);
  };

  const updateAllowedDomains = (value) => {
    const domains = value
      .split(/\r?\n/)
      .map((domain) => domain.trim())
      .filter(Boolean);
    updateField("allowedDomains", domains);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Freshness window
          <input
            type="text"
            value={config.freshnessWindow}
            onChange={(event) => updateField("freshnessWindow", event.target.value)}
            placeholder="e.g. 7d, 48h"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Locale
          <input
            type="text"
            value={config.locale}
            onChange={(event) => updateField("locale", event.target.value)}
            placeholder="en-US"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Snippet limit
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={config.snippetLimit}
            onChange={(event) =>
              updateField("snippetLimit", Math.max(1, Math.min(50, Number(event.target.value) || DEFAULT_CONFIG.snippetLimit)))
            }
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={`${labelClass} flex items-center gap-3`}>
          <input
            type="checkbox"
            checked={config.safeMode}
            onChange={(event) => updateField("safeMode", !!event.target.checked)}
            disabled={readOnly}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-semibold text-emphasis">Enable safe search</span>
        </label>
      </div>

      <div className="mt-5">
        <label className={labelClass}>
          Allowed domains (one per line, optional)
          <textarea
            value={(config.allowedDomains ?? []).join("\n")}
            onChange={(event) => updateAllowedDomains(event.target.value)}
            placeholder="example.com&#10;docs.example.com"
            className={textAreaClass}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
}

export default SearchConfigEditor;
