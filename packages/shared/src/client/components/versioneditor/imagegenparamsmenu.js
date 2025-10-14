import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useConfig } from '@src/client/configprovider';
import { CollapsibleSection } from "@src/client/components/collapsiblesection";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { replacePlaceholderSettingWithFinalValue } from "../settingsmenus/menudatamodel";
import { stateManager } from "@src/client/statemanager";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import {
  computeStableDiffusionGuardrailOverrides,
  getStableDiffusionGuardrail,
} from "@src/common/stableDiffusionGuardrails";



export function ImageGenParamsMenu(props) {
  const { Constants } = useConfig();
  const { field, rootObject, onChange, readOnly } = props;
  const [modelSelectionMenu, setModelSelectionMenu] = useState(null);
  const currentEndpoint = useRef(null);
  const lastStableDiffusionModelRef = useRef(null);
  const { account } = React.useContext(stateManager);
  const modelMetadata = Constants.models?.imageGeneration ?? {};
  const imageEndpoints = Constants.endpoints?.imageGeneration ?? {};
  const aspectRatioModelSet = useMemo(() => {
    const candidate =
      imageEndpoints?.stablediffusion?.aspectRatioModels ?? [];
    const normalized = candidate
      .filter(Boolean)
      .map((value) => `${value}`.toLowerCase());
    return new Set(normalized);
  }, [imageEndpoints]);
  const defaultAspectRatio =
    imageEndpoints?.stablediffusion?.defaultAspectRatio ?? "1:1";
  const defaultOutputFormat =
    imageEndpoints?.stablediffusion?.defaultOutputFormat ?? "png";
  const defaultOutputQuality =
    imageEndpoints?.stablediffusion?.defaultOutputQuality ?? 90;

  const createModelOption = (modelId) => {
    const metadata = modelMetadata[modelId];
    return {
      label: metadata?.label ?? modelId,
      value: modelId,
    };
  };

  const endpointOption = [
    {
      label: "AI Endpoint",
      path: "params.endpoint",
      type: "dropdown",
      tooltip: "AI endpoint.",
      options: Object.keys(Constants.endpoints.imageGeneration).map((key) => {
          return {label: Constants.endpoints.imageGeneration[key].label, value: key};
      }),
    },
];

  function updateModelSelectionMenu() {
    if (currentEndpoint.current) {
      const endpoint = Constants.endpoints.imageGeneration[currentEndpoint.current];
      if (endpoint) {
        const modelOptions = (endpoint.models ?? []).map(createModelOption);

        const currentModelSelection = modelOptions.find((option) => option.value === rootObject.params.model);
        if (!currentModelSelection && endpoint.defaultModel) {
          onVariableChanged(rootObject, "params.model", endpoint.defaultModel);
        }

        if (!nullUndefinedOrEmpty(endpoint.defaultUrl, true) && rootObject.params.serverUrl !== endpoint.defaultUrl) {
          onVariableChanged(rootObject, "params.serverUrl", endpoint.defaultUrl);
        }

        if (typeof endpoint.defaultWidth !== "undefined" && Number(rootObject.params.width) !== Number(endpoint.defaultWidth)) {
          onVariableChanged(rootObject, "params.width", endpoint.defaultWidth);
        }

        if (typeof endpoint.defaultHeight !== "undefined" && Number(rootObject.params.height) !== Number(endpoint.defaultHeight)) {
          onVariableChanged(rootObject, "params.height", endpoint.defaultHeight);
        }

        if (!nullUndefinedOrEmpty(endpoint.defaultAspectRatio, true) && rootObject.params.aspectRatio !== endpoint.defaultAspectRatio) {
          onVariableChanged(rootObject, "params.aspectRatio", endpoint.defaultAspectRatio);
        }

        if (!nullUndefinedOrEmpty(endpoint.defaultOutputFormat, true) && rootObject.params.outputFormat !== endpoint.defaultOutputFormat) {
          onVariableChanged(rootObject, "params.outputFormat", endpoint.defaultOutputFormat);
        }

        if (typeof endpoint.defaultOutputQuality !== "undefined" && Number(rootObject.params.outputQuality) !== Number(endpoint.defaultOutputQuality)) {
          onVariableChanged(rootObject, "params.outputQuality", endpoint.defaultOutputQuality);
        }

        if (!nullUndefinedOrEmpty(endpoint.defaultAPIKey, true)) {
          const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
          if (!nullUndefinedOrEmpty(finalValue, true) && rootObject.params.apiKey !== finalValue) {
            onVariableChanged(rootObject, "params.apiKey", finalValue);
          }
        }

        setModelSelectionMenu([
          {
            label: "Model",
            path: "params.model",
            type: "dropdown",
            tooltip: "Model to use for requests",
            options: modelOptions,
          }]);

      }
    }
  }

  const applyStableDiffusionDefaults = useCallback(
    (targetObject, candidateParams = {}) => {
      const baseParams = targetObject?.params ?? {};
      const mergedParams = {
        ...baseParams,
        ...candidateParams,
      };

      const endpoint = `${mergedParams?.endpoint ?? ""}`.toLowerCase();
      if (endpoint !== "stablediffusion") {
        lastStableDiffusionModelRef.current = null;
        return;
      }

      const modelId = mergedParams?.model;
      if (nullUndefinedOrEmpty(modelId)) {
        return;
      }

      const guardrail = getStableDiffusionGuardrail(modelId);
      if (!guardrail) {
        return;
      }

      const defaults = guardrail.defaults ?? {};
      const currentModel = lastStableDiffusionModelRef.current;
      if (currentModel !== modelId) {
        lastStableDiffusionModelRef.current = modelId;

        Object.entries(defaults).forEach(([key, value]) => {
          const existingValue = mergedParams?.[key];
          if (existingValue === value) {
            return;
          }
          onChange?.(targetObject, `params.${key}`, value);
        });

        const clampUpdates = computeStableDiffusionGuardrailOverrides(modelId, {
          ...mergedParams,
          ...defaults,
        });
        Object.entries(clampUpdates ?? {}).forEach(([key, value]) => {
          if (defaults[key] !== undefined && defaults[key] === value) {
            return;
          }
          onChange?.(targetObject, `params.${key}`, value);
        });
        return;
      }

      const updates = computeStableDiffusionGuardrailOverrides(modelId, mergedParams);
      if (!updates || Object.keys(updates).length === 0) {
        return;
      }

      Object.entries(updates).forEach(([key, value]) => {
        onChange?.(targetObject, `params.${key}`, value);
      });
    },
    [onChange],
  );

  const onVariableChanged = useCallback(
    (object, relativePath, newValue) => {
      onChange?.(object, relativePath, newValue);

      if (!relativePath?.startsWith("params.")) {
        return;
      }

      const key = relativePath.slice("params.".length);
      if (key === "model" || key === "endpoint") {
        applyStableDiffusionDefaults(object, { [key]: newValue });
      }
    },
    [onChange, applyStableDiffusionDefaults],
  );

  const onEndpointChanged = (object, relativePath, newValue) => {
    if (currentEndpoint.current != newValue) {
      onVariableChanged(object, relativePath, newValue);
      currentEndpoint.current = newValue;
      updateModelSelectionMenu();
    }
  };

  const requiresAspectRatio = useMemo(() => {
    const modelId = `${rootObject.params.model ?? ""}`.toLowerCase();
    if (!modelId) {
      return false;
    }
    if (aspectRatioModelSet.has(modelId)) {
      return true;
    }
    return modelId.startsWith("sd3") || modelId.startsWith("flux");
  }, [rootObject.params.model, aspectRatioModelSet]);

  const filteredFields = useMemo(() => {
    if (!Array.isArray(field.fields)) {
      return [];
    }
    return field.fields.reduce((acc, item) => {
      if (!item) {
        return acc;
      }
      if (item.path === "params.width" || item.path === "params.height") {
        if (!requiresAspectRatio) {
          acc.push(item);
        }
        return acc;
      }
      if (item.path === "params.aspectRatio") {
        if (requiresAspectRatio) {
          acc.push(item);
        }
        return acc;
      }
      acc.push(item);
      return acc;
    }, []);
  }, [field.fields, requiresAspectRatio]);

  useEffect(() => {

    if (rootObject.params.endpoint) {
      currentEndpoint.current = rootObject.params.endpoint;
      updateModelSelectionMenu();
    }
  }, [rootObject.params.endpoint]);

  useEffect(() => {
    if (requiresAspectRatio) {
      if (nullUndefinedOrEmpty(rootObject.params.aspectRatio, true)) {
        onVariableChanged(rootObject, "params.aspectRatio", defaultAspectRatio);
      }
    }
  }, [requiresAspectRatio, rootObject.params.aspectRatio, defaultAspectRatio, onVariableChanged]);

  useEffect(() => {
    if (nullUndefinedOrEmpty(rootObject.params.outputFormat, true)) {
      onVariableChanged(rootObject, "params.outputFormat", defaultOutputFormat);
    }
    if (nullUndefinedOrEmpty(rootObject.params.outputQuality, true)) {
      onVariableChanged(rootObject, "params.outputQuality", defaultOutputQuality);
    }
    if (nullUndefinedOrEmpty(rootObject.params.samples, true)) {
      onVariableChanged(rootObject, "params.samples", 1);
    }
  }, [
    rootObject.params.outputFormat,
    rootObject.params.outputQuality,
    rootObject.params.samples,
    defaultOutputFormat,
    defaultOutputQuality,
    onVariableChanged,
  ]);

  const stableDiffusionEndpoint = `${rootObject?.params?.endpoint ?? ""}`.toLowerCase();
  const stableDiffusionModel = rootObject?.params?.model;

  useEffect(() => {
    applyStableDiffusionDefaults(rootObject, rootObject?.params ?? {});
  }, [applyStableDiffusionDefaults, rootObject, stableDiffusionEndpoint, stableDiffusionModel]);

  return (
    <CollapsibleSection
      title={field.label}
    >
     
      <SettingsMenu
        menu={endpointOption}
        rootObject={rootObject}
        onChange={onEndpointChanged}
        readOnly={readOnly}
        key={"endpointselect"}
      />

{modelSelectionMenu && (  
    <React.Fragment>
      <SettingsMenu
          menu={modelSelectionMenu}
          rootObject={rootObject}
          onChange={onVariableChanged}
          readOnly={readOnly}
          key={"modelselect"}
        />  

      <SettingsMenu
          menu={filteredFields}
          rootObject={rootObject}
          onChange={onVariableChanged}
          readOnly={readOnly}
          key={"aifields"}
        />  
      </React.Fragment> 
)}

    </CollapsibleSection>
  );
}
