"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const textAreaClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm font-mono text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 min-h-[180px] resize-y";

export function ViewportEditor({ field, rootObject, onChange, readOnly }) {
  const initialValue = useMemo(
    () => getNestedObjectProperty(rootObject, field.path) ?? "",
    [rootObject, field.path]
  );
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const latest = getNestedObjectProperty(rootObject, field.path) ?? "";
    if (latest !== value) {
      setValue(latest);
    }
  }, [rootObject, field.path]);

  const handleChange = (event) => {
    const next = event.target.value;
    setValue(next);
    onChange?.(rootObject, field.path, next);
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <label className={labelClass}>
        Viewport payload
        <textarea
          value={value}
          onChange={handleChange}
          placeholder="Paste a base64 screenshot or serialized DOM snapshot."
          className={textAreaClass}
          disabled={readOnly}
          spellCheck={false}
        />
      </label>
      <p className="mt-2 text-xs text-muted">
        This field is typically populated automatically at runtime. Use it here only for testing recorded automation sessions.
      </p>
    </div>
  );
}

export default ViewportEditor;
