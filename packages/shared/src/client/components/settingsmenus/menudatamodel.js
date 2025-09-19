import { Constants } from '@src/common/defaultconfig';
import {
  getNestedObjectProperty,
  setNestedObjectProperty,
} from "@src/common/objects";
import { nullUndefinedOrEmpty } from "@src/common/objects";

function getNode(nodes, instanceID) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].instanceID == instanceID) {
        return nodes[i];
      }
    }
    return null;
  }
  
export function iterateAllFields(rootObject, field, context, callback, path = "root") {
  if (!callback || !field || nullUndefinedOrEmpty(path)) {
    throw new Error(
      "Bad inputs to iterateAllFields: ",
      field,
      rootObject,
      callback
    );
  }

  if (Array.isArray(field)) {
    //
    // if "field" was just an array of fields...
    //
    const childrenResults = field.map((childField, index) => {
        return iterateAllFields(
            rootObject,
            childField,
            context,
            callback,
            path + `[${index}]`
        );
        });
    return childrenResults;

  } else {

    const callbackResult = callback(rootObject, field, context, `${path}.${field.path}`);
    let results = [callbackResult];

    if (field.nodes && Array.isArray(field.nodes)) {
        field.nodes.map((nodeField, index) => {
            const nodeObject = getNode(rootObject.nodes, nodeField.instanceID);
            if (!nodeObject) {
                throw new Error("Node not found: " + nodeField.instanceID);
            }
            const childrenResults = iterateAllFields(
                nodeObject,
                nodeField,
                context,
                callback,
                path + `.node[${index}].${nodeField.instanceID}`
            );
            results = results.concat(childrenResults);
        });
    }

    if (field.fields && Array.isArray(field.fields)) {
        const childrenResults = iterateAllFields(
            rootObject,
            field.fields,
            context,
            callback,
            `${path}.${field.path ? field.path : (field.label ? field.label : field.type)}.fields`  
        );
        results = results.concat(childrenResults);
    }

    return results;
  }
}

export function replacePlaceholderSettingWithFinalValue(inputValue, accountSpecificValues) {
    if (typeof inputValue == "string" && inputValue.startsWith("setting:")) {
      // Find the colon in the default value
      let colonIndex = inputValue.indexOf(";");
      // Grab evertyhing after "setting: but  before the semicolon"
      let settingName = inputValue.substring(8, colonIndex);

      if (!nullUndefinedOrEmpty(accountSpecificValues?.preferences?.[settingName])) {
        const newValue = accountSpecificValues.preferences[settingName];
        return newValue;
      } else {
        // inputValue is everything after the colon
        const newValue = inputValue.substring(colonIndex + 1);
        return newValue;
      }
    }

    return inputValue;
}

function getOrMigrateValue(rootObject, field, onVariableChanged, accountSpecificValues= {}) {

    let currentValue = getNestedObjectProperty(rootObject, field.path);

    //
    // If the current version doens't have it, maybe we're supposed to migrate
    // the value from an old variable name
    //
    if (nullUndefinedOrEmpty(currentValue, true) && field.migratePath) {
      Constants.debug.logVersionEditor &&
        console.log("Migrating: ", field.path, " to ", field.migratePath);
      let migratedValue = getNestedObjectProperty(
        rootObject,
        field.migratePath
      );
      if (!nullUndefinedOrEmpty(migratedValue)) {
        Constants.debug.logVersionEditor &&
          console.log(
            "Applying migrated value: ",
            field.path,
            " = ",
            migratedValue,
            " (was: ",
            currentValue,
            ")"
          );
        currentValue = migratedValue;
        onVariableChanged(rootObject, field.path, currentValue);
      }
    }

    //
    // Definitely don't have a value -- let's use the default
    //
    if (nullUndefinedOrEmpty(currentValue, true)) {
      let defaultValue = field.defaultValue;
      if (nullUndefinedOrEmpty(defaultValue, true)) {
        defaultValue = ""; // at least it's a string...
      }
      defaultValue = replacePlaceholderSettingWithFinalValue(defaultValue, accountSpecificValues);
      if (currentValue != defaultValue) {
        Constants.debug.logVersionEditor &&
          console.log(
            "Applying default value: ",
            field.path,
            " = ",
            defaultValue,
            " (was: ",
            currentValue,
            ")"
          );
        currentValue = defaultValue;
        onVariableChanged(rootObject, field.path, currentValue);
      }
    }

    if (nullUndefinedOrEmpty(currentValue, true)) {
      Constants.debug.logVersionEditor &&
        console.error(" Missing variable: ", field.path);
      throw new Error("Missing variable: " + field.path);
    }

    //
    // All done - return!
    //
    return currentValue;
}

function ensureStartingFieldValue(rootObject, field, onVariableChanged, accountSpecificValues, path) {

    if (!nullUndefinedOrEmpty(field.path)) {
      let currentValue = getOrMigrateValue(
        rootObject,
        field,
        onVariableChanged,
        accountSpecificValues
      );
      setNestedObjectProperty(rootObject, field.path, currentValue);
    }
}

export function initializeDataModel(rootObject, menuRoot, onVariableChanged, accountSpecificValues) {
  const allFields = iterateAllFields(
    rootObject,
    menuRoot,
    { onVariableChanged, accountSpecificValues },
    (rootObject, field, context, path) => {
      ensureStartingFieldValue(rootObject, field, context.onVariableChanged, context.accountSpecificValues, path);
    }
  );
}
