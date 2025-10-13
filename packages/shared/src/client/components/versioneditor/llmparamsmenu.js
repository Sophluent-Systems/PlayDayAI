import React, { useEffect, useState, useRef } from "react";
import { useConfig } from '@src/client/configprovider';
import { CollapsibleSection } from "@src/client/components/collapsiblesection";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { replacePlaceholderSettingWithFinalValue } from "../settingsmenus/menudatamodel";
import { stateManager } from "@src/client/statemanager";
import { nullUndefinedOrEmpty } from "@src/common/objects";

export function LLMParamsMenu(props) {
  const { Constants } = useConfig();
  const { field, rootObject, onChange, readOnly } = props;
  const { account } = React.useContext(stateManager);
  const [modelSelectionMenu, setModelSelectionMenu] = useState(null);
  const currentEndpoint = useRef(null);
  const shouldResetModel = useRef(false);

  const modelMetadata = Constants.models?.llm ?? {};

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
      options: Object.keys(Constants.endpoints.llm).map((key) => {
          return {label: Constants.endpoints.llm[key].label, value: key};
      }),
    },
];

  function updateModelSelectionMenu() {
    if (currentEndpoint.current) {
      const endpoint = Constants.endpoints.llm[currentEndpoint.current];
      if (endpoint) {
        const modelOptions = Array.isArray(endpoint.models) ? endpoint.models.map(createModelOption) : [];
        const selectionType = endpoint.modelSelectionType ?? (modelOptions.length > 0 ? "dropdown" : "text");
        const needsReset = shouldResetModel.current;
        const applyDefaultModel = () => {
          if (!nullUndefinedOrEmpty(endpoint.defaultModel)) {
            onVariableChanged(rootObject, "params.model", endpoint.defaultModel);
          }
          if (!nullUndefinedOrEmpty(endpoint.defaultUrl)) {
            onVariableChanged(rootObject, "params.serverUrl", endpoint.defaultUrl);
          }
          if (!nullUndefinedOrEmpty(endpoint.defaultInputFormat)) {
            onVariableChanged(rootObject, "params.inputFormat", endpoint.defaultInputFormat);
          }
          if (endpoint.defaultAPIKey) {
            const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
            onVariableChanged(rootObject, "params.apiKey", finalValue);
          }
        };

        if (selectionType === "text") {
          const currentModel = rootObject?.params?.model;
          if (needsReset || nullUndefinedOrEmpty(currentModel)) {
            applyDefaultModel();
          } else {
            if (nullUndefinedOrEmpty(rootObject?.params?.serverUrl)) {
              onVariableChanged(rootObject, "params.serverUrl", endpoint.defaultUrl);
            }
            if (nullUndefinedOrEmpty(rootObject?.params?.inputFormat)) {
              onVariableChanged(rootObject, "params.inputFormat", endpoint.defaultInputFormat);
            }
            if (nullUndefinedOrEmpty(rootObject?.params?.apiKey) && endpoint.defaultAPIKey) {
              const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
              onVariableChanged(rootObject, "params.apiKey", finalValue);
            }
          }

          setModelSelectionMenu([
            {
              label: "Model",
              path: "params.model",
              type: "text",
              tooltip: endpoint.modelTooltip ?? "Model to use for requests",
              placeholder: endpoint.modelPlaceholder,
            },
          ]);
          shouldResetModel.current = false;
          return;
        }

        const currentModelSelection = modelOptions.find((option) => option.value === rootObject.params.model);
        if (needsReset || !currentModelSelection) {
          applyDefaultModel();
        }

        setModelSelectionMenu([
          {
            label: "Model",
            path: "params.model",
            type: "dropdown",
            tooltip: "Model to use for requests",
            options: modelOptions,
          }]);
        shouldResetModel.current = false;
      } else {
        setModelSelectionMenu(null);
      }
    }
  }

  const onVariableChanged = (object, relativePath, newValue) => {
    onChange?.(object, relativePath, newValue);
  }

  const onEndpointChanged = (object, relativePath, newValue) => {
    if (currentEndpoint.current != newValue) {
      onVariableChanged(object, relativePath, newValue);
      currentEndpoint.current = newValue;
      shouldResetModel.current = true;
      updateModelSelectionMenu();
    }
  }

  useEffect(() => {

    if (rootObject.params.endpoint) {
      currentEndpoint.current = rootObject.params.endpoint;
      updateModelSelectionMenu();
    }
  }, [rootObject.params.endpoint]);


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
          menu={field.fields}
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
