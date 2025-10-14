import React, { useEffect, useState, useRef, useMemo } from "react";
import { useConfig } from '@src/client/configprovider';
import { CollapsibleSection } from "@src/client/components/collapsiblesection";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { replacePlaceholderSettingWithFinalValue } from "../settingsmenus/menudatamodel";
import { stateManager } from "@src/client/statemanager";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const PARAMETER_PRESETS = [
  {
    id: "creative",
    label: "Creative",
    values: {
      temperature: 0.95,
      top_p: 0.97,
      top_k: 32,
      repetition_penalty: 1.0,
      newTokenTarget: 400,
      tokenLimit: 4096,
      streaming: true,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    values: {
      temperature: 0.7,
      top_p: 0.92,
      top_k: 8,
      repetition_penalty: 1.1,
      newTokenTarget: 250,
      tokenLimit: 4096,
      streaming: true,
    },
  },
  {
    id: "conservative",
    label: "Conservative",
    values: {
      temperature: 0.35,
      top_p: 0.85,
      top_k: 6,
      repetition_penalty: 1.2,
      newTokenTarget: 180,
      tokenLimit: 4096,
      streaming: true,
    },
  },
  {
    id: "custom",
    label: "Custom...",
    values: null,
  },
];

const DEFAULT_PRESET_ID = "balanced";
const PRESET_LOOKUP = new Map(PARAMETER_PRESETS.map((preset) => [preset.id, preset]));
const CONNECTION_FIELD_PATHS = new Set([
  "params.inputFormat",
  "params.outputFormat",
  "params.serverUrl",
  "params.apiKey",
]);

function approxEqual(a, b, tolerance = 0.01) {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }

  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return Math.abs(aNumber - bNumber) <= tolerance;
  }

  return false;
}

function matchesPresetValues(values, params, allowMissing = false) {
  if (!values || !params) {
    return false;
  }

  return Object.entries(values).every(([key, value]) => {
    const current = params[key];

    if (current == null) {
      return allowMissing;
    }

    if (typeof value === "boolean") {
      return Boolean(current) === value;
    }

    if (typeof value === "number") {
      return approxEqual(current, value);
    }

    return current === value;
  });
}

function detectPreset(params) {
  if (!params) {
    return DEFAULT_PRESET_ID;
  }

  const storedPreset = params.parameterPreset;
  if (storedPreset && PRESET_LOOKUP.has(storedPreset)) {
    if (storedPreset === "custom") {
      return "custom";
    }
    const presetDefinition = PRESET_LOOKUP.get(storedPreset);
    if (presetDefinition?.values && matchesPresetValues(presetDefinition.values, params, storedPreset === DEFAULT_PRESET_ID)) {
      return storedPreset;
    }
  }

  for (const preset of PARAMETER_PRESETS) {
    if (!preset.values) {
      continue;
    }
    if (matchesPresetValues(preset.values, params, preset.id === DEFAULT_PRESET_ID)) {
      return preset.id;
    }
  }

  return "custom";
}

function formatPresetSummary(values) {
  if (!values) {
    return "";
  }

  const parts = [];

  if (typeof values.temperature === "number") {
    parts.push(`Temperature ${values.temperature.toFixed(2)}`);
  }
  if (typeof values.top_p === "number") {
    parts.push(`Top P ${values.top_p.toFixed(2)}`);
  }
  if (typeof values.top_k === "number") {
    parts.push(`Top K ${values.top_k}`);
  }
  if (typeof values.repetition_penalty === "number") {
    parts.push(`Repetition penalty ${values.repetition_penalty.toFixed(2)}`);
  }
  if (typeof values.newTokenTarget === "number") {
    parts.push(`Response target ${values.newTokenTarget} tokens`);
  }

  return parts.join(" • ");
}

export function LLMParamsMenu(props) {
  const { Constants } = useConfig();
  const { field, rootObject, onChange, readOnly } = props;
  const { account } = React.useContext(stateManager);

  const [modelOptions, setModelOptions] = useState([]);
  const [modelTooltip, setModelTooltip] = useState("Model to use for requests");
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESET_ID);

  const currentEndpoint = useRef(null);
  const shouldResetModel = useRef(false);

  const params = rootObject?.params ?? {};
  const modelMetadata = Constants.models?.llm ?? {};

  const connectionFields = useMemo(() => {
    return (field.fields ?? []).filter((entry) => CONNECTION_FIELD_PATHS.has(entry.path));
  }, [field.fields]);

  const advancedParameterFields = useMemo(() => {
    return (field.fields ?? []).filter((entry) => !CONNECTION_FIELD_PATHS.has(entry.path));
  }, [field.fields]);

  const parameterFieldPaths = useMemo(() => {
    return new Set(advancedParameterFields.map((entry) => entry.path));
  }, [advancedParameterFields]);

  const detectedPreset = useMemo(() => detectPreset(params), [
    params.temperature,
    params.top_p,
    params.top_k,
    params.repetition_penalty,
    params.newTokenTarget,
    params.tokenLimit,
    params.streaming,
    params.parameterPreset,
  ]);

  useEffect(() => {
    setSelectedPreset(detectedPreset);
  }, [detectedPreset]);

  const createModelOption = (modelId) => {
    const metadata = modelMetadata[modelId];
    return {
      label: metadata?.label ?? modelId,
      value: modelId,
    };
  };

  const endpointOption = [
    {
      label: "Provider",
      path: "params.endpoint",
      type: "dropdown",
      tooltip: "Choose which LLM provider to use.",
      options: Object.keys(Constants.endpoints.llm).map((key) => {
        return { label: Constants.endpoints.llm[key].label, value: key };
      }),
    },
  ];

  const onVariableChanged = (object, relativePath, newValue, options = {}) => {
    onChange?.(object, relativePath, newValue);

    if (!options.skipPresetAdjustment && parameterFieldPaths.has(relativePath)) {
      if (selectedPreset !== "custom") {
        setSelectedPreset("custom");
      }
      if (rootObject?.params?.parameterPreset !== "custom") {
        onChange?.(rootObject, "params.parameterPreset", "custom");
      }
    }
  };

  function applyPreset(presetId) {
    const preset = PRESET_LOOKUP.get(presetId);
    if (!preset?.values || readOnly) {
      return;
    }

    Object.entries(preset.values).forEach(([key, value]) => {
      onVariableChanged(rootObject, `params.${key}`, value, { skipPresetAdjustment: true });
    });

    setSelectedPreset(presetId);
    onChange?.(rootObject, "params.parameterPreset", presetId);
  }

  const refreshEndpointDetails = () => {
    if (!currentEndpoint.current) {
      setModelOptions([]);
      setModelTooltip("Model to use for requests");
      return;
    }

    const endpoint = Constants.endpoints.llm[currentEndpoint.current];
    if (!endpoint) {
      setModelOptions([]);
      setModelTooltip("Model to use for requests");
      return;
    }

    const endpointModelOptions = Array.isArray(endpoint.models)
      ? endpoint.models.map(createModelOption)
      : [];

    setModelOptions(endpointModelOptions);
    setModelTooltip(endpoint.modelTooltip ?? "Model to use for requests");

    const needsReset = shouldResetModel.current;

    const ensureField = (path, fallbackValue) => {
      if (nullUndefinedOrEmpty(fallbackValue)) {
        return;
      }
      const fieldKey = path.split(".").pop();
      if (fieldKey && nullUndefinedOrEmpty(params[fieldKey])) {
        onVariableChanged(rootObject, path, fallbackValue, { skipPresetAdjustment: true });
      }
    };

    if (needsReset || nullUndefinedOrEmpty(params.model)) {
      if (!nullUndefinedOrEmpty(endpoint.defaultModel)) {
        onVariableChanged(rootObject, "params.model", endpoint.defaultModel, { skipPresetAdjustment: true });
      }
      ensureField("params.serverUrl", endpoint.defaultUrl);
      ensureField("params.inputFormat", endpoint.defaultInputFormat);
      if (endpoint.defaultAPIKey) {
        const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
        onVariableChanged(rootObject, "params.apiKey", finalValue, { skipPresetAdjustment: true });
      }
    } else {
      ensureField("params.serverUrl", endpoint.defaultUrl);
      ensureField("params.inputFormat", endpoint.defaultInputFormat);
      if (nullUndefinedOrEmpty(params.apiKey) && endpoint.defaultAPIKey) {
        const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
        onVariableChanged(rootObject, "params.apiKey", finalValue, { skipPresetAdjustment: true });
      }
    }

    if (needsReset) {
      applyPreset(DEFAULT_PRESET_ID);
    } else if (nullUndefinedOrEmpty(params.parameterPreset)) {
      onChange?.(rootObject, "params.parameterPreset", DEFAULT_PRESET_ID);
    }

    shouldResetModel.current = false;
  };

  const onEndpointChanged = (object, relativePath, newValue) => {
    if (currentEndpoint.current !== newValue) {
      onVariableChanged(object, relativePath, newValue);
      currentEndpoint.current = newValue;
      shouldResetModel.current = true;
      refreshEndpointDetails();
    }
  };

  useEffect(() => {
    if (rootObject.params.endpoint) {
      currentEndpoint.current = rootObject.params.endpoint;
      refreshEndpointDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootObject.params.endpoint]);

  const modelMenu = useMemo(() => ([
    {
      label: "Model",
      path: "params.model",
      type: "text",
      tooltip: modelTooltip,
      maxChar: 150,
    },
  ]), [modelTooltip]);

  const currentModelValue = params.model ?? "";
  const presetSummary = selectedPreset !== "custom"
    ? formatPresetSummary(PRESET_LOOKUP.get(selectedPreset)?.values)
    : "";

  const handlePresetSelect = (presetId) => {
    if (readOnly) {
      return;
    }
    if (presetId === "custom") {
      setSelectedPreset("custom");
      onChange?.(rootObject, "params.parameterPreset", "custom");
      return;
    }
    applyPreset(presetId);
  };

  const handleModelSuggestion = (modelId) => {
    if (readOnly) {
      return;
    }
    onVariableChanged(rootObject, "params.model", modelId, { skipPresetAdjustment: true });
  };

  return (
    <CollapsibleSection title={field.label}>
      <div className="space-y-6">
        <div className="space-y-3">
          <SettingsMenu
            menu={endpointOption}
            rootObject={rootObject}
            onChange={onEndpointChanged}
            readOnly={readOnly}
            key="endpoint-select"
          />

          {connectionFields.length > 0 ? (
            <SettingsMenu
              menu={connectionFields}
              rootObject={rootObject}
              onChange={onVariableChanged}
              readOnly={readOnly}
              key="connection-fields"
            />
          ) : null}
        </div>

        <div className="space-y-3">
          <SettingsMenu
            menu={modelMenu}
            rootObject={rootObject}
            onChange={onVariableChanged}
            readOnly={readOnly}
            key="model-text"
          />

          {modelOptions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Known models
              </p>
              <div className="flex flex-wrap gap-2">
                {modelOptions.map((option) => {
                  const isActive = option.value === currentModelValue;
                  const buttonClasses = isActive
                    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                    : "rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-primary/50 hover:text-primary dark:border-slate-600 dark:text-slate-300";

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={buttonClasses}
                      onClick={() => handleModelSuggestion(option.value)}
                      disabled={readOnly}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PARAMETER_PRESETS.map((preset) => {
              const isActive = preset.id === selectedPreset;
              const buttonClasses = isActive
                ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition dark:bg-slate-100 dark:text-slate-900"
                : "rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-primary/60 hover:text-primary dark:border-slate-600 dark:text-slate-300";

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={buttonClasses}
                  onClick={() => handlePresetSelect(preset.id)}
                  disabled={readOnly}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {selectedPreset !== "custom" && presetSummary ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{presetSummary}</p>
          ) : null}

          {selectedPreset === "custom" ? (
            <SettingsMenu
              menu={advancedParameterFields}
              rootObject={rootObject}
              onChange={onVariableChanged}
              readOnly={readOnly}
              key="advanced-params"
            />
          ) : null}
        </div>
      </div>
    </CollapsibleSection>
  );
}
