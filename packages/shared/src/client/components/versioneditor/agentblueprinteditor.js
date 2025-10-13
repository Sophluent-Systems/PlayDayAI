"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getNestedObjectProperty } from "@src/common/objects";

const labelClass = "text-xs font-semibold uppercase tracking-[0.3em] text-muted";
const textAreaClass =
  "w-full rounded-2xl border border-border/60 bg-surface px-4 py-2 text-sm font-mono text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 min-h-[240px] resize-y";

const DEFAULT_BLUEPRINT = {
  name: "Assistant",
  description: "Helpful agent",
  instructions: [],
  tools: [],
  memory: {
    strategy: "ephemeral",
  },
};

function formatBlueprint(value) {
  const blueprint = value && typeof value === "object" ? value : DEFAULT_BLUEPRINT;
  try {
    return JSON.stringify(blueprint, null, 2);
  } catch (error) {
    return JSON.stringify(DEFAULT_BLUEPRINT, null, 2);
  }
}

export function AgentBlueprintEditor({ field, rootObject, onChange, readOnly }) {
  const initialJson = useMemo(
    () => formatBlueprint(getNestedObjectProperty(rootObject, field.path)),
    [rootObject, field.path]
  );
  const [textValue, setTextValue] = useState(initialJson);
  const [error, setError] = useState(null);

  useEffect(() => {
    const latestJson = formatBlueprint(getNestedObjectProperty(rootObject, field.path));
    if (latestJson !== textValue) {
      setTextValue(latestJson);
      setError(null);
    }
  }, [rootObject, field.path]);

  const handleChange = (event) => {
    const nextText = event.target.value;
    setTextValue(nextText);
    try {
      const parsed = JSON.parse(nextText);
      setError(null);
      onChange?.(rootObject, field.path, parsed);
    } catch (parseError) {
      setError(parseError.message);
    }
  };

  return (
    <div className="rounded-3xl border border-border/60 bg-surface/80 p-6 shadow-soft backdrop-blur-xl">
      <label className={labelClass}>
        Agent blueprint (JSON)
        <textarea
          value={textValue}
          onChange={handleChange}
          className={textAreaClass}
          disabled={readOnly}
          spellCheck={false}
        />
      </label>
      {error ? (
        <p className="mt-2 rounded-xl border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Provide a valid AgentKit blueprint. Include <code>tools</code>, <code>policies</code>, and <code>memory</code> sections as needed.
        </p>
      )}
    </div>
  );
}

export default AgentBlueprintEditor;
