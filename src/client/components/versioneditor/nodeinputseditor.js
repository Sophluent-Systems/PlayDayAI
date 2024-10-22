import React, { useState, useEffect, useRef } from 'react';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import { Delete } from '@mui/icons-material';
import { Edit } from '@mui/icons-material';
import { Add } from '@mui/icons-material';
import { Save } from '@mui/icons-material';
import {
  Button,
  Box,
  Paper, 
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import { HistoryInputSelector } from './historyinputselector';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { getMetadataForNodeType } from '@src/common/nodeMetadata';


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

const requireAllEventTriggersOption = [
  {
    label: "Require all event triggers to fire before running (if unchecked, run when any 1 event fires)",
    type: "checkbox",
    path: "requireAllEventTriggers",
    defaultValue: false,
    tooltip: "Require all the input events to fire to be present before running this node (or if unchecked run once for each input that becomes available).",
  },
  {
    label: "Require all variables to be ready before running (if unchecked, run when any 1 event fires)",
    type: "checkbox",
    path: "requireAllVariables",
    defaultValue: false,
    tooltip: "Require all the variables to be present before running this node (or if unchecked run once for each input that becomes available).",
  },
]

export function NodeInputsEditor({ readOnly, node, onChange, nodes, producerNodeID }) {
  const { classes } = useStyles(defaultAppTheme);
  const [editingIndex, setEditingIndex] = useState(null);
  const [paramOverrideOptions, setParamOverrideOptions] = useState([]);
  const [nodeLookupTable, setNodeLookupTable] = useState({});//[instanceID: nodeObject, ...
  const firstRenderRef = useRef(true);
  const [canUseHistoryAsInput, setCanUseHistoryAsInput] = useState(false);

  if (firstRenderRef.current) {
    firstRenderRef.current = false;
  }

  useEffect(() => {
    if (nodes) {
      let newLookupTable = {};
      nodes.forEach((node) => {
        newLookupTable[node.instanceID] = node;
      });
      setNodeLookupTable(newLookupTable);
    } else {
      setNodeLookupTable({});
    }
  }, [nodes]);

  useEffect(() => {
    if (node && producerNodeID) {
      // set the editing index to this producerID, if it's an input
      const index = node.inputs.findIndex(input => input.producerInstanceID === producerNodeID);
      if (index >= 0) {
        setEditingIndex(index);
      }
    }
  }, [producerNodeID, node]);

  useEffect(() => {
    if (node) {
      let newOptions = [{
        label: "None",
        value: null,
        mediaType: null,
      }];
      if (node.AllowedParamOverrides) {
        setParamOverrideOptions([newOptions, ...node.AllowedParamOverrides]);
      }
      setCanUseHistoryAsInput(getMetadataForNodeType(node.nodeType).nodeAttributes.canUseHistoryAsInput);
    }
  }, [node]);

  const handleEditInput = (index) => {
    setEditingIndex(index);
  };

  const handleAddInput = () => {
    const newinput = { 
      producerInstanceID: nodes[0].instanceID,
      includeHistory: true,
      historyParams: {},
      param: {
        variable: ""
      }
    };
    const newIndex = (node.inputs?.length || 0);
    let newState = [...(node.inputs ? node.inputs : []), newinput];
    setEditingIndex(newIndex);
    handleFinishedEditing(newState);
  };

  const handleDeleteInput = (index) => {
    let newState = [...node.inputs];
    newState.splice(index, 1);
    handleFinishedEditing(newState);
  };
  
  const handleValueChange = (event, index, path, value) => {
    event.stopPropagation();
    onChange?.(node.inputs[index], path, value);
  };

  const handleSaveButtonPress = (e) => {
    e.stopPropagation();
    setEditingIndex(null);
  };

  function handleFinishedEditing(newNodesInputState) {
      onChange?.(node, "inputs", newNodesInputState);
  }

  const handleHistoryOptionChange = (rootObject, path, value) => {
    //
    // XXX This is a horrible hack but prevents an inexplicable issue where
    // this function is called after we refresh nodes, and the root object
    // is an event object, and path/value are undefined.
    //
    if (typeof path !== "string") {
      console.error("handleHistoryOptionChange: Likely caught inexplicable bug: rootObject=", rootObject);
      return;
    }
    onChange?.(rootObject, path, value);
  }

  if (!node) {
    return null;
  }

  return (
    <Box className={classes.container}>
      <Typography variant="h6" className={classes.titleStyle}>
        Inputs
      </Typography>
      <List>
      {node.inputs ? node.inputs.map((input, index) => (
        <Paper key={`input-${index}`} className={classes.nodeInputStyle}>
          <ListItem>
            {editingIndex === index ? (
              
              <Grid container alignItems="flex-start">
                <Grid item xs={12} margin={1}>
                  <Typography variant="h6" className={classes.titleStyle}>
                    Input node: {nodes.find(n => n.instanceID == input.producerInstanceID).instanceName}
                  </Typography>
                </Grid>
                {canUseHistoryAsInput &&
                    <Grid item xs={12} margin={1}>
                      <HistoryInputSelector 
                          node={node} 
                          nodes={nodes} 
                          input={input} 
                          onChange={handleHistoryOptionChange}
                          sx={{margin: 0}}
                          readOnly={readOnly} 
                        />
                    </Grid>
                }
                <Grid item xs={1}>
                  <IconButton onClick={(e) => handleSaveButtonPress(e)} disabled={readOnly} >
                    <Save />
                  </IconButton>
                </Grid>
              </Grid>
            ) : (
              <React.Fragment>
                <ListItemText 
                  primary={`Node: ${nodeLookupTable[input.producerInstanceID]?.instanceName ? nodeLookupTable[input.producerInstanceID]?.instanceName : ""} `}
                  secondary={
                    <>
                      {(canUseHistoryAsInput && input.includeHistory) ? "History included" : "History ignored"}
                      {input.param?.variable ? (<>
                        <br />
                        <span style={{ fontSize: 'smaller', color: '#888' }}>overriding params.{input.param.variable}</span>
                      </>) : null}
                    </>} 
                  onClick={() => handleEditInput(index)}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleEditInput(index)} disabled={readOnly} >
                    <Edit />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDeleteInput(index)} disabled={readOnly} >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </React.Fragment>
            )}
          </ListItem>
        </Paper>
      )) : null}
      {node.inputs && (node.inputs.length > 1) && (
        <SettingsMenu
          menu={requireAllEventTriggersOption}
          rootObject={node}
          onChange={onChange}
          readOnly={readOnly}
          key={"requireAllEventTriggersOption"}
        />
      )}
      </List>
      <Button
        variant="contained"
        color="primary"
        onClick={handleAddInput}
        startIcon={<Add />}
        disabled={readOnly}
      >
        Add Input
      </Button>
    </Box>
  );
}
