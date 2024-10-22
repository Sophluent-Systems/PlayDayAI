import React, { useEffect, useState, useRef } from "react";
import { useConfig } from '@src/client/configprovider';
import { CollapsibleSection } from "@src/client/components/collapsiblesection";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { replacePlaceholderSettingWithFinalValue } from "../settingsmenus/menudatamodel";
import { stateManager } from "@src/client/statemanager";



export function ImageGenParamsMenu(props) {
  const { Constants } = useConfig();
  const { field, rootObject, onChange, readOnly } = props;
  const [modelSelectionMenu, setModelSelectionMenu] = React.useState(null);
  const currentEndpoint = useRef(null);
  const { account } = React.useContext(stateManager);

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
        const newOptions = endpoint.models.map((option) => {return {label: option, value: option}});

        let currentModelSelection = newOptions.find((option) => option.value == rootObject.params.model);
        if (!currentModelSelection) {
          // set the first option
          onVariableChanged(rootObject, "params.model", endpoint.defaultModel);
          onVariableChanged(rootObject, "params.serverUrl", endpoint.defaultUrl);
          onVariableChanged(rootObject, "params.width", endpoint.defaultWidth);
          onVariableChanged(rootObject, "params.height", endpoint.defaultHeight);
          if (endpoint.defaultAPIKey) {
            const finalValue = replacePlaceholderSettingWithFinalValue(endpoint.defaultAPIKey, account);
            onVariableChanged(rootObject, "params.apiKey", finalValue);
          }
        }

        setModelSelectionMenu([
          {
            label: "Model",
            path: "params.model",
            type: "dropdown",
            tooltip: "Model to use for requests",
            options: endpoint.models.map((option) => {return {label: option, value: option}}),
          }]);

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