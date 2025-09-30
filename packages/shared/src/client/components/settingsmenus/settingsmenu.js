import React, { useEffect, useState, useRef } from "react";
import {
    MenuTextField,
    MenuDecimalField,
    MenuFloatField,
    MenuCheckboxField,
    MenuSelectDropdown,
    MenuRadioField,
    MenuMultiselectField,
    MenuCodeEditor,
  } from "./menucontrols.js";
import { ScenarioEditor } from "../versioneditor/scenarioeditor.js";
import { LLMParamsMenu } from "../versioneditor/llmparamsmenu.js";
import { OutputDataFieldsEditor } from "../versioneditor/outputdatafieldseditor.js";
import { FileStoreEditor } from "../versioneditor/filestoreeditor.js";
import { getNestedObjectProperty } from "@src/common/objects.js";
import { CollapsibleSection } from "@src/client/components/collapsiblesection.js";
import { initializeDataModel } from "./menudatamodel.js";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { stateManager } from "@src/client/statemanager.js";
import { ImageGenParamsMenu } from "../versioneditor/imagegenparamsmenu.js";
import { AudioGenParamsMenu } from "../versioneditor/audiogenparamsmenu.js";

export function SettingsMenu({ menu, rootObject, onChange, readOnly }) {
  const { account } = React.useContext(stateManager);
  
  useEffect(() => {
    if (menu && rootObject) {
      initializeDataModel(rootObject, menu, onChange, {preferences: account?.preferences});
    }
  }, [menu, rootObject]);

  function updateVariableValue(object, relativePath, newValue) {
    onChange?.(object, relativePath, newValue);
  }


  const renderTextField = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);

    return (
      <MenuTextField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderDecimalField = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    return (
      <MenuDecimalField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderFloatFields = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    return (
      <MenuFloatField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };


  const renderRadioField = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    return (
      <MenuRadioField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderMultiselectField = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    return (
      <MenuMultiselectField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderCheckboxField = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);

    return (
      <MenuCheckboxField
        field={field}
        rootObject={rootObject}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderSelectDropdown = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    return (
      <MenuSelectDropdown
        field={field}
        rootObject={rootObject}
        options={field.options}
        value={currentValue}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderDataFieldsEditor = (field, rootObject, path) => {
    let outputDataFields = getNestedObjectProperty(rootObject, field.path);
    return (
      <OutputDataFieldsEditor
        key={path}
        rootObject={rootObject}
        outputDataFields={outputDataFields}
        relativePath={field.path}
        onChange={(rootObject, relativePath, newValue) =>
          updateVariableValue(rootObject, relativePath, newValue)
        }
        readOnly={readOnly}
      />
    );
  };

  const renderFileStoreEditor = (field, rootObject, path) => {
    let files = getNestedObjectProperty(rootObject, field.path);
    return (
      <FileStoreEditor
        key={path}
        rootObject={rootObject}
        files={files}
        relativePath={field.path}
        onChange={(rootObject, relativePath, newValue) => 
          updateVariableValue(rootObject, relativePath, newValue)
        }
        readOnly={readOnly}
      />
    );
  };

  const renderLLMParamsMenu = (field, rootObject, path) => {
    return (
      <LLMParamsMenu
        field={field}
        rootObject={rootObject}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)}
        readOnly={readOnly}
        key={path}
      />
    );
  }

  const renderImageGenParamsMenu = (field, rootObject, path) => {
    return (
      <ImageGenParamsMenu
        field={field}
        rootObject={rootObject}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)}
        readOnly={readOnly}
        key={path}
      />
    );
  }

  const renderAudioGenParamsMenu = (field, rootObject, path) => {
    return (
      <AudioGenParamsMenu
        field={field}
        rootObject={rootObject}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)}
        readOnly={readOnly}
        key={path}
      />
    );
  }

  const renderCodeEditor = (field, rootObject, path) => {
    let currentValue = getNestedObjectProperty(rootObject, field.path);
    let outputDataFields = getNestedObjectProperty(
      rootObject,
      field.path
    );
    return (
      <MenuCodeEditor
        field={field}
        rootObject={rootObject}
        value={currentValue}
        outputDataFields={outputDataFields}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderScenarioEditor = (field, rootObject, path) => {
    let catalog = getNestedObjectProperty(rootObject, field.path);
    return (
      <ScenarioEditor
        field={field}
        value={catalog}
        rootObject={rootObject}
        onChange={(object, relativePath, newValue) =>
          updateVariableValue(object, relativePath, newValue)
        }
        key={path}
        readOnly={readOnly}
      />
    );
  };

  const renderSectionHeader = (field, rootObject, path) => (
    <h3 key={path} className="text-lg font-semibold text-slate-700 dark:text-slate-200">
      {field.label}
    </h3>
  );

  const renderSubSection = (field, rootObject, path) => {
    let disabled = false;
    if (field.conditional) {
      let conditionalValue = getNestedObjectProperty(
        rootObject,
        field.conditional
      );
      if (!conditionalValue) {
        disabled = true;
      }
    }

    if (!disabled) {
      return (
        <CollapsibleSection
          title={field.label}
          key={path}
          disabled={disabled}
        >
          <div className="space-y-4">
            {field.fields && renderFieldList(field.fields, rootObject, path)}
          </div>
        </CollapsibleSection>
      );
    }
  };


  function renderField(field, rootObject, path = "root") {
    if (nullUndefinedOrEmpty(path)) {
      throw new Error("renderField: Bad path " + path);
    }

    switch (field.type) {
      case "text":
        return renderTextField(field, rootObject, path);
      case "decimal":
        return renderDecimalField(field, rootObject, path);
      case "float":
        return renderFloatFields(field, rootObject, path);
      case "radio":
        return renderRadioField(field, rootObject, path);
      case "multiselect":
        return renderMultiselectField(field, rootObject, path);
      case "checkbox":
        return renderCheckboxField(field, rootObject, path);
      case "dropdown":
        return renderSelectDropdown(field, rootObject, path);
      case "scenarioEditor":
        return renderScenarioEditor(field, rootObject, path);
      case "dataFieldsEditor":
        return renderDataFieldsEditor(field, rootObject, path);
      case "fileStoreEditor":
        return renderFileStoreEditor(field, rootObject, path);
      case "codeEditor":
        return renderCodeEditor(field, rootObject, path);
      case "sectionHeader":
        return renderSectionHeader(field, rootObject, path);
      case "subSection":
        return renderSubSection(field, rootObject, path);
      case "fieldlist":
        return renderFieldList(field.fields, rootObject, path);
      case "llmparams":
        return renderLLMParamsMenu(field, rootObject, path);
      case "imagegenparams":
        return renderImageGenParamsMenu(field, rootObject, path);
      case "audiogenparams":
        return renderAudioGenParamsMenu(field, rootObject, path);
    }
  }

  function renderFieldList(fieldList, rootObject, path = "root") {
    if (nullUndefinedOrEmpty(path)) {
      throw new Error("renderFieldList: Bad path " + path);
    }
    if (!fieldList || fieldList.length == 0) {
      return <React.Fragment key={path} />;
    }
    const allFields = fieldList.map((field, index) => {
            const childPath = path + `.fields[${index}].${field.path ? field.path : (field.type ? field.type : field.label)}`;
            return (
              <div key={`${index}-${path}`} className="my-4">
                {renderField(field, rootObject, childPath)}
              </div>
            )
    });
    return allFields;
  }

  return (
    <React.Fragment>
      <div className="space-y-5">
        {renderFieldList(menu, rootObject)}
      </div>
    </React.Fragment>
  );
}
