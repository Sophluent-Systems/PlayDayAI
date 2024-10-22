import React, { useState, useEffect } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import { 
    Box,
    Paper,
} from '@mui/material';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { NodeMultiSelect } from '@src/client/components/nodemultiselect';


const useStyles = makeStyles()((theme, pageTheme) => {
    const {
      colors,
      fonts,
    } = pageTheme;
    return ({
    inputField: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    container: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.palette.primary.main,
      borderStyle: 'solid',
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.background.main , 
      marginTop: theme.spacing(4), 
      width: '100%',
    },
    titleStyle: {
      marginBottom: theme.spacing(2),
    },
    nodeInputStyle: {
      padding: '8px',
      marginBottom: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: colors.inputAreaTextEntryBackgroundColor, 
    },
  })});



const topLevelCheckbox = [{
    label: "Include message history as input",
    type: "checkbox",
    path: "includeHistory",
    defaultValue: true,
    tooltip: "Publish to the world?",
}];

const additionalOptions = [{  
    /*  SUBSECTION */
    label: "Advanced",
    type: "subSection",
    fields: [
        {
            label: "Ignore compression",
            type: "checkbox",
            path: "historyParams.ignoreCompression",
            defaultValue: false,
            tooltip: "Include all messages, ignoring compression (might create very large requests)",
        },
        {
            label: "Include deleted",
            type: "checkbox",
            path: "historyParams.includeDeleted",
            defaultValue: false,
            tooltip: "Include messages that have been deleted",
        },
        {
            label: "Include interrupted (errors, stopped by user)",
            type: "checkbox",
            path: "historyParams.includeFailed",
            defaultValue: false,
            tooltip: "Include messages that have failed or been halted",
        },
    ]
}];

const spanModeOption = [{
    label: "History Options",
    type: "radio",
    options: [
      { label: "Full history", value: "full" },
      { label: "Exclude certain ranges", value: "exclude" },
      { label: "Include only certain ranges", value: "include" },
    ],
    path: "historyParams.spanSelectionMode",
    defaultValue: "full",
    tooltip: "Include only certain ranges of the history?",
}];

const excludeOptions = [{  
  /*  SUBSECTION */
  label: "excludeOptions",
  type: "fieldlist",
  fields: [
    {
      label: "# of items to exclude from start of history",
      type: "decimal",
      range: [0, 1000],
      path: "startingSpan",
      defaultValue: 0,
      tooltip: "The number of \'messages\' in the history to remove starting from the beginning of the list",
    },
    {
      label: "# of items to exclude from recent history",
      type: "decimal",
      range: [0, 1000],
      path: "endingSpan",
      defaultValue: 0,
      tooltip: "The number of \'messages\' in the history to remove, starting from the most recent message",
    },
  ]
}];

const includeOptions = [{  
  /*  SUBSECTION */
  label: "includeOptions",
  type: "fieldlist",
  fields: [
    {
      label: "# of items to include from start of history",
      type: "decimal",
      range: [0, 1000],
      path: "historyParams.startingSpan",
      tooltip: "The number of \'messages\' in the history to include starting from the beginning of the list",
    },
    {
      label: "# of items to include from recent history",
      type: "decimal",
      range: [0, 1000],
      path: "historyParams.endingSpan",
      tooltip: "The number of \'messages\' in the history to include, starting from the most recent message",
    },
  ]
}];

export function HistoryInputSelector(params) {
    const { nodes, input, onChange, readOnly } = params;
    const { classes } = useStyles(defaultAppTheme);
    const [includeHistory, setIncludeHistory] = useState(true);

    const onVariableChanged = (rootObject, path, value) => {
        if (path == "includeHistory") {
            setIncludeHistory(value);
        }
        if (!path) {
            throw new Error("onVariableChanged: Bad path " + path);
        }
        onChange(rootObject, path, value);
    }

    useEffect(() => {
        if (input) {
            setIncludeHistory(input.includeHistory);
        }
    }, [input]);
    
    if (!input || !nodes) {
        return null;
    }

    return (
    <Box {...params}>
      <Paper className={classes.nodeInputStyle}>
          <SettingsMenu
              menu={topLevelCheckbox}
              rootObject={input}
              onChange={onVariableChanged}
              readOnly={readOnly}
          />
          
          <SettingsMenu
                  menu={spanModeOption}
                  rootObject={input}
                  onChange={onVariableChanged}
                  readOnly={!includeHistory || readOnly}
            />

          <NodeMultiSelect
              nodes={nodes}
              rootObject={input}
              label='Select nodes to include (empty means "all nodes")'
              tooltip="Select nodes to include in the history"
              path="historyParams.includedNodes"
              defaultValue={[]}
              readOnly={!includeHistory || readOnly}
              onChange={(...params) => {
                onVariableChanged(...params);
              }}
          />

          {input.historyParams?.spanSelectionMode === 'exclude' && (
              <Box sx={{marginTop:2, marginLeft: 4}}>
                  <SettingsMenu
                  menu={excludeOptions}
                  rootObject={input}
                  onChange={onVariableChanged}
                  readOnly={!includeHistory || readOnly}
              />
              </Box>
          )}

          {input.historyParams?.spanSelectionMode === 'include' && (
              <Box  sx={{marginTop:2, marginLeft: 4}}>
              <SettingsMenu
                  menu={includeOptions}
                  rootObject={input}
                  onChange={onVariableChanged}
                  readOnly={!includeHistory || readOnly}
              />
              </Box>
          )}

          <Box  sx={{marginTop: 2}}>
              <SettingsMenu
                  menu={additionalOptions}
                  rootObject={input}
                  onChange={onVariableChanged}
                  readOnly={!includeHistory || readOnly}
              />
          </Box>
      </Paper>
    </Box>
    );
}
