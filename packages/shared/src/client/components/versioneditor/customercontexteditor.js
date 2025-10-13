"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const inputClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const DEFAULT_CONTEXT = {
  loginCustomerId: "",
  customerId: "",
  oauthProfileId: "",
};

function normalizeContext(value) {
  if (!value) {
    return { ...DEFAULT_CONTEXT };
  }

  return {
    loginCustomerId: value.loginCustomerId ?? "",
    customerId: value.customerId ?? "",
    oauthProfileId: value.oauthProfileId ?? "",
  };
}

export function CustomerContextEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => normalizeContext(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [context, setContext] = useState(initialValue);

  useEffect(() => {
    const latest = normalizeContext(getNestedObjectProperty(rootObject, field.path));
    if (JSON.stringify(latest) !== JSON.stringify(context)) {
      setContext(latest);
    }
  }, [rootObject, field.path]);

  const updateField = (key, value) => {
    const next = { ...context, [key]: value };
    setContext(next);
    onChange?.(rootObject, field.path, next);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Login customer ID
          <input
            type="text"
            value={context.loginCustomerId}
            onChange={(event) => updateField("loginCustomerId", event.target.value)}
            placeholder="Manager account ID (optional)"
            className={inputClass}
            disabled={readOnly}
          />
        </label>

        <label className={labelClass}>
          Customer ID
          <input
            type="text"
            value={context.customerId}
            onChange={(event) => updateField("customerId", event.target.value)}
            placeholder="Ads account ID"
            className={inputClass}
            disabled={readOnly}
          />
        </label>
      </div>

      <div className="mt-5">
        <label className={labelClass}>
          OAuth profile ID
          <input
            type="text"
            value={context.oauthProfileId}
            onChange={(event) => updateField("oauthProfileId", event.target.value)}
            placeholder="Stored OAuth credential reference"
            className={inputClass}
            disabled={readOnly}
          />
        </label>
      </div>
    </div>
  );
}

export default CustomerContextEditor;
