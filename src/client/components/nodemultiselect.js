import React, { useState, useEffect } from 'react';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';


export function NodeMultiSelect(params) {
    const { rootObject, nodes, onChange, label, tooltip, path, defaultValue, readOnly } = params;
    const [multiSelectMenu, setMultiSelectMenu] = useState([]);


    const onVariableChanged = (rootObject, path, value) => {
        onChange?.(rootObject, path, value);
    }

    useEffect(() => {

      if (nodes) {
        if (!path) {
          throw new Error("NodeMultiSelect: path is required!!!");
        }

        setMultiSelectMenu((prev) => {
          return [{
            label: label,
            path: path,
            type: "multiselect",
            tooltip: tooltip,
            defaultValue: defaultValue,
            options: nodes.map((node) => {
              return {
                label: node.instanceName,
                value: node.instanceID,
              };
            }),
          }];
        });
      }
    }, [nodes]);
    
    if (!nodes || !multiSelectMenu || multiSelectMenu.length == 0) {
        return null;
    }

    return (
          <SettingsMenu
                  menu={multiSelectMenu}
                  rootObject={rootObject}
                  onChange={onVariableChanged}
                  readOnly={readOnly}
            />
    );
}
