import React, {useState, useEffect, useRef } from "react";
import { NodeInputsEditor } from "./nodeinputseditor";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { nodeTypeMenus } from "./nodetypemenus.js";
import { 
  Box, 
  Button,
  Typography,
  Dialog, 
  DialogActions, 
  DialogContent, 
  DialogContentText, 
  DialogTitle,
  Paper,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { defaultAppTheme } from "@src/common/theme";
import { getWarningsForNode } from "./versioneditorutils";
import { PersonaChooser } from "./personas/personachooser";


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


const treatAsDebugCheckbox = [{
  label: "Hide output (editors can toggle 'Showing debug messages' to see output)",
  type: "checkbox",
  path: "hideOutput",
  defaultValue: false,
  tooltip: "Hide output (editors can toggle 'Showing debug messages' to see output)",
}];

export function NodeSettingsMenu(params) {
  const { node, nodes, onChange, onNodeStructureChange, onPersonaListChange, readOnly, versionInfo } = params;
  const { classes } = useStyles(defaultAppTheme);
  const [popupDialogOpen, setPopupDialogOpen] = useState(false);
  const [warningText, setWarningText] = useState(null);
  const [warningTitle, setWarningTitle] = useState(null);
  const onConfirmRef = useRef(null);

  if (!node) {
    return null;
  }

  const menu = nodeTypeMenus[node.nodeType];

  function onVariableChanged(object, relativePath, newValue) {
    onChange?.(object, relativePath, newValue);
    if (relativePath === "instanceName" || relativePath === "inputs" || relativePath === "personaLocation") {
      onNodeStructureChange?.(node, "visualUpdateNeeded", {});
    }
  }

  const handleDuplicate = () => {
    onNodeStructureChange?.(node, "duplicate", {})
  }
  
  const handleCancelPopup = () => {
    setPopupDialogOpen(false); // Close the dialog
  };

  const handleDelete = () => {
    setWarningText(`Are you sure you want to permanently delete the node "${node.instanceName}"? You will
    lose all settings perminantly.`)
    setWarningTitle(`Delete Node "${node.instanceName}"?`)
    onConfirmRef.current = () => onNodeStructureChange?.(node, "delete", {});
    setPopupDialogOpen(true);
  };

  const handleCopyParams = () => {
    setWarningText(`Are you sure you want to overwrite the endpoint of all nodes of type "${node.nodeType}"? You will
    lose all existing settings perminantly.`)
    setWarningTitle(`Copy parameters`)
    onConfirmRef.current = () => onNodeStructureChange?.(node, "copyParamsToSameType", {});
    setPopupDialogOpen(true);
  }


  const handleConfirmPopup = async () => {
    setPopupDialogOpen(false); // Close the dialog
    onConfirmRef.current();
  };

  const onInputChanged = (inputObject, path, newValue) => {
    onVariableChanged(inputObject, path, newValue);
    onNodeStructureChange?.(node, "input", {})
  }

  const renderWarnings = (node) => {
    const warnings = getWarningsForNode(node);
    if (warnings) {
      return (
        <Box
          sx={{
            marginTop:2,
            marginBottom:2,
          }}
        >
          <Typography
            variant="body1"
            style={{ color: '#FF9800', fontWeight: 'bold' }} // Using deep orange color
          >
            {warnings.map((warning) => `Warning: ${warning}`).join("\n")}
          </Typography>
        </Box>
      )
    }
    return null;
  }


  return (
    <Box>

      {renderWarnings(node)}

      {!node.isSourceNode &&
          <NodeInputsEditor
            node={node}
            nodes={nodes}
            readOnly={readOnly}
            onChange={onInputChanged}
          />
      }

      <SettingsMenu
            menu={treatAsDebugCheckbox}
            rootObject={node}
            onChange={onVariableChanged}
            readOnly={readOnly}
            key={"treatAsDebugCheckbox"}
      />

      <Typography>Persona</Typography>
      <PersonaChooser
        theme={defaultAppTheme}
        node={node}
        versionInfo={versionInfo}
        onChange={onVariableChanged}
        onPersonaListChange={onPersonaListChange}
        readOnly={readOnly}
      />

      <Typography variant="body1" className={classes.titleStyle}>Options</Typography>
        <SettingsMenu
          menu={menu}
          rootObject={node}
          onChange={onVariableChanged}
          readOnly={readOnly}
          key={"topLevelNodeOptions"}
        />

        <Box
              display="flex"
              justifyContent="center"
              marginTop={4}
              marginBottom={2}
            >
            <Button
              variant="contained"
              color="secondary"
              onClick={handleDuplicate} 
              sx={{margin:2}}
              disabled={readOnly}
            >
              Duplicate Node
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleCopyParams} 
              sx={{margin:2}}
              disabled={readOnly}
            >
              Copy Parameters To All {node.nodeType} Nodes
            </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDelete} 
                sx={{margin:2}}
                disabled={readOnly}
              >
                Delete Node
              </Button>
        </Box>
        <Dialog
          open={popupDialogOpen}
          onClose={() => handleCancelPopup()}
          aria-labelledby="delete-node-dialog-title"
          aria-describedby="delete-node-dialog-description"
        >
          <DialogTitle id="delete-node-dialog-title">
            {warningTitle}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-node-dialog-description">
              {warningText}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleCancelPopup()} color="primary">
              Cancel
            </Button>
            <Button onClick={() => handleConfirmPopup()} color="error" autoFocus>
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
    </Box>
  );
}
