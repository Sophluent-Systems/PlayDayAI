import { useRouter } from "next/router";
import React, { memo, useState, useEffect, useRef } from "react";
import { StandardContentArea } from "@src/client/components/standard/standardcontentarea";
import { InfoBubble } from "@src/client/components/standard/infobubble";
import { defaultAppTheme } from "@src/common/theme";
import { Error as ErrorIcon } from "@mui/icons-material";
import { makeStyles } from "tss-react/mui";
import { CheckCircle } from "@mui/icons-material";
import { Save } from "@mui/icons-material";
import { DeleteForever } from "@mui/icons-material";
import { VersionSelector } from "@src/client/components/versionselector";
import { PlayArrow } from "@mui/icons-material";
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';
import { editorSaveRequestState, dirtyEditorState } from '@src/client/states';
import {
  Button,
  Tooltip,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Paper,
  Grid,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  callGetVersionInfoForEdit,
  callReplaceAppVersion,
  callDeleteGameVersion,
} from "@src/client/editor";
import { useConfig } from '@src/client/configprovider';
import {
  objectDepthFirstSearch,
  flattenObject,
  setNestedObjectProperty,
  getNestedObjectProperty,
} from "@src/common/objects";
import { stateManager } from "@src/client/statemanager";
import { diffLines, diffArrays } from "diff";
import { nullUndefinedOrEmpty } from "@src/common/objects";
import { NodeSettingsMenu } from "./nodesettingsmenu";
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { VersionTemplates } from "./versiontemplates";
import { NodeGraphDisplay } from "./graphdisplay/nodegraphdisplay";
import { v4 as uuidv4 } from "uuid";
import { ModalMenu } from '@src/client/components/standard/modalmenu';
import { marked } from 'marked';
import { replacePlaceholderSettingWithFinalValue } from '@src/client/components/settingsmenus/menudatamodel';
import{ getMetadataForNodeType } from '@src/common/nodeMetadata';
import { getAddableNodeTypes } from '@src/common/nodeMetadata';
import { analyticsReportEvent} from "@src/client/analytics";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { NodeInputsEditor } from "./nodeinputseditor";
import { NodeInitMenu } from "./nodeinitmenu";

const globalOptions = [
  {
    label: "Published",
    type: "checkbox",
    path: "published",
    tooltip: "Make this version accessible to users?",
  },
  {
    label: "Bill App's AI Keys for All Users",
    type: "checkbox",
    path: "alwaysUseBuiltInKeys",
    tooltip: "Allow all users to use the app's AI keys (you'll be billed for usage)",
  },
];

const addableNodeTypes = getAddableNodeTypes();

const useStyles = makeStyles()((theme, pageTheme) => {
  const { colors, fonts } = pageTheme;
  return {
    inputField: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    themeEditorContainer: {
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
      borderWidth: 1,
      borderColor: theme.palette.primary.main,
      borderStyle: "solid",
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.background.main,
      marginTop: theme.spacing(4),
      width: "100%",
    },
    themeEditorTitle: {
      marginBottom: theme.spacing(2),
    },
    themeEditorField: {
      marginBottom: theme.spacing(2),
      padding: theme.spacing(1),
    },
    scenarioStyle: {
      padding: "8px",
      marginBottom: "8px",
      border: "1px solid #ccc",
      borderRadius: "4px",
      backgroundColor: colors.inputAreaTextEntryBackgroundColor,
    },
    outputDataFieldsStyle: {
      padding: "8px",
      marginBottom: "8px",
      border: "1px solid #ccc",
      borderRadius: "4px",
      backgroundColor: colors.inputAreaTextEntryBackgroundColor,
    },
    gameTypography: {
      fontSize: '1.5em',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '0.2em',
      fontFamily: fonts.titleFont,
      color: colors.titleFontColor,
      left: 0, 
      right: 0,
      textAlign: 'center',
      textShadow: `0px 0px 10px ${theme.palette.text.secondary}`,
      marginBottom: '0',
    },
    versionTypography: {
      fontSize: '1.5em',
      letterSpacing: '0.2em',
      fontFamily: fonts.titleFont,
      color: colors.titleFontColor,
      left: 0, 
      right: 0,
      textAlign: 'center',
      marginBottom: '0',
    },
  };
});


export function TemplateChooser({ templateChosen }) {
  const handleTemplateClick = (template) => {
      if (templateChosen) {
          templateChosen(template);
      }
  };

  return (
      <Grid container spacing={2} justifyContent="center">
          {VersionTemplates.map((template, index) => (
              <Grid item key={index} xs={12} sm={6} md={4} lg={3}>
               <Button onClick={() => handleTemplateClick(template)}  >
                  <Paper elevation={3} sx={{ padding: 2, textAlign: 'center' }}>
                          {template.icon}
                      <Typography variant="h6" component="div" sx={{ marginTop: 1 }}>
                          {template.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                          {template.description}
                      </Typography>
                  </Paper>
                </Button>
              </Grid>
          ))}
      </Grid>
  );
}

function VersionEditor(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { versionName } = router.query;
  const { classes } = useStyles(defaultAppTheme);
  const {
    loading,
    account,
    game,
    version,
    updateVersion,
    switchVersionByName,
    gamePermissions,
  } = React.useContext(stateManager);
  const [dirtyEditor, setDirtyEditor] = useAtom(dirtyEditorState);
  const [editorSaveRequest, setEditorSaveRequest] = useAtom(editorSaveRequestState);
  const dirtyEditorRef = useRef(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const [versionInfo, setVersionInfo] = useState(null);
  const [newVersionInfo, setNewVersionInfo] = useState(null);
  const newVersionInfoRef = useRef(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [readOnly, setreadOnly] = useState(true);
  const [settingsDiff, setSettingsDiff] = useState(null);
  const [menu, setMenu] = useState([]);
  const [vh] = useAtom(vhState);
  const [addNodeAnchorEl, setAddNodeAnchorEl] = useState(null);
  const settingsDiffTimeoutId = useRef(null);
  const versionInfoUpdateTimeoutId = useRef(null);
  const [modalEditingMode, setModalEditingMode] = useState(undefined);
  const initDataRef = useRef(null);
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [useAppKeysDialogOpen, setUseAppKeysDialogOpen] = useState(false);

  const gameTheme = game?.theme ? game.theme : defaultAppTheme;

  async function submitNewVersionInfo() {
    console.log("++++++++++++++++++ SUBMITTING NEW VERSION INFO");
    try {
      await callReplaceAppVersion(newVersionInfoRef.current);
      setNewVersionInfo({ ...newVersionInfoRef.current });
      dirtyEditorRef.current = false;
      setDirtyEditor(false);
      setIsUpdated(true);
      updateSettingsDiff(versionInfo, newVersionInfoRef.current);
      await updateVersion(true);
    } catch (error) {
      alert("Error saving updates: " + error);
    }
  }

  const doDiscardChanges = () => {
    if (dirtyEditor) {
      newVersionInfoRef.current = JSON.parse(JSON.stringify(versionInfo));
      setNewVersionInfo(newVersionInfoRef.current);
      dirtyEditorRef.current = false;
      setDirtyEditor(false);
      setIsUpdated(false);
      updateSettingsDiff(versionInfo, newVersionInfoRef.current);
      setDiscardChangesDialogOpen(false);
    }
  }

  const handleDiscardChanges = () => {
    setDiscardChangesDialogOpen(true);
  };

  // Event handler for keydown event
  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "s") {
      event.preventDefault();
      if (dirtyEditor) {
        submitNewVersionInfo();
      }
    }
  };

  // Attach event listener on mount and clean up on unmount
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);

    analyticsReportEvent('edit_version', {
      event_category: 'Editor',
      event_label: 'Edit version',
      gameID: game?.gameID,    // Unique identifier for the game
      versionID: version?.versionID,  // Version of the game being played
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);



  useEffect(() => {
    if (version && gamePermissions &&
        (readOnly !== shouldBeReadOnly())) {
      refreshVersionInfo();
    }
  }, [gamePermissions]);

  useEffect(() => {
    if (version) {
      refreshVersionInfo();
    }
  }, [version]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (dirtyEditor) {
        // Display a confirmation dialog
        event.preventDefault();
        event.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Clean up the listener when the component unmounts
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirtyEditor]);

  useEffect(() => {
    updateSettingsDiff(versionInfo, newVersionInfoRef.current);
    console.log("updateSettingsDiff");
  }, [versionInfo, newVersionInfo]);

  function shouldBeReadOnly() {
    let hasEditPermissions = gamePermissions?.includes("game_edit");

    return !hasEditPermissions;
  }
  
  useEffect(() => {
    async function doSave() {
      if (editorSaveRequest === "save") {
        if (dirtyEditor) {
          await submitNewVersionInfo();
        }
        setEditorSaveRequest("saved");
      }
    }

    doSave();
  }, [editorSaveRequest]);

  async function refreshVersionInfo() {
    if (version) {
      try {
        const versionInfoFromServer = await callGetVersionInfoForEdit(
          game.gameID,
          version.versionName
        );
        setVersionInfo(versionInfoFromServer);
        newVersionInfoRef.current = JSON.parse(
          JSON.stringify(versionInfoFromServer)
        );
        setNewVersionInfo(newVersionInfoRef.current);
        setreadOnly(shouldBeReadOnly());
      } catch (error) {
        console.log("Error fetching version info:", error);
        router.replace("/");
      }
    } else {
      setMenu([]);
    }
  }

  function updateVersionInfo(versionInfoUpdate) {
    console.log("updateVersionInfo");
    let versionInfoCopy = JSON.parse(JSON.stringify(versionInfoUpdate));
    newVersionInfoRef.current = versionInfoCopy;
    setNewVersionInfo(newVersionInfoRef.current);
    if (!dirtyEditorRef.current) {
      dirtyEditorRef.current = true;
      setDirtyEditor(true);
    }
    updateSettingsDiff(versionInfo, newVersionInfoRef.current);
  }

  function templateChosen(template) {
    console.log("templateChosen: ", template)
    let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
    if (nullUndefinedOrEmpty(versionInfoCopy.stateMachineDescription)) {
      versionInfoCopy.stateMachineDescription = {};
    }
    versionInfoCopy.stateMachineDescription.nodes = template.nodes.map((node) => {
      replaceAllNodePlaceholderSettings(node); 
      return node;
    });
    if (!nullUndefinedOrEmpty(template.personas)) {
      versionInfoCopy.personas = JSON.parse(JSON.stringify(template.personas));
    }
    updateVersionInfo(versionInfoCopy);
  }

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false); // Close the dialog
  };

  const handleDeleteVersion = () => {
    setDeleteDialogOpen(true);
  };



  const handleConfirmDelete = async () => {
    await callDeleteGameVersion(versionInfo.gameID, versionInfo.versionName);
    setDeleteDialogOpen(false); // Close the dialog

    Constants.debug.logVersionEditor &&
      console.log(
        "handleConfirmDelete: Loading page without this version selected"
      );

    switchVersionByName(null);
  };

  const onVariableChanged = (object, relativePath, newValue) => {
    const previousValue = getNestedObjectProperty(object, relativePath);
    if (previousValue !== newValue) {
      setNestedObjectProperty(object, relativePath, newValue);
      if (!dirtyEditorRef.current) {
        dirtyEditorRef.current = true;
        setDirtyEditor(true);
      }
      updateSettingsDiff(versionInfo, newVersionInfoRef.current);
    }
  }

  function flattenWithoutNodes(obj) {
    let result = [];
  
    function process(path, value) {
      if (path.startsWith("stateMachineDescription.nodes")) {
        return false;
      }
      if (typeof value !== 'object' || value === null) {
        result.push(`${path}=${value}`);
      }
      return true;
    }
  
    objectDepthFirstSearch(obj, process);
    return result;
  }



  function updateSettingsDiff(oldVersionInfo, updatedVersionInfo) {
    

    // 
    // This timeout system avoids updating the diff on every typing
    // keypress which grinds the UI to a halt
    //

    if (settingsDiffTimeoutId.current) {
      clearTimeout(settingsDiffTimeoutId.current);
      settingsDiffTimeoutId.current=null;
    }
    // Start a new timeout
    settingsDiffTimeoutId.current = setTimeout(() => {


          let renderDiff = <React.Fragment />;

          if (!nullUndefinedOrEmpty(oldVersionInfo) && !nullUndefinedOrEmpty(updatedVersionInfo)) {

            let before = flattenWithoutNodes(oldVersionInfo);
            let after = flattenWithoutNodes(updatedVersionInfo);

            let oldNodes = [...(oldVersionInfo.stateMachineDescription?.nodes ? oldVersionInfo.stateMachineDescription.nodes : [])];
            let newNodes = [...(updatedVersionInfo.stateMachineDescription?.nodes ? updatedVersionInfo.stateMachineDescription.nodes : [])];

            for (let i=0; i<oldNodes.length; i++) {
              const oldNode = oldNodes[i];
              // attempt to find the index of this node in nowNOdes
              const newNodeIndex = newNodes.findIndex((n) => n.instanceID == oldNode.instanceID);
              const newNode = newNodeIndex >= 0 ? newNodes[newNodeIndex] : null;

              let flattened = flattenObject(oldNode, oldNode.instanceName ? `node[${oldNode.instanceName}]` : `node[${oldNode.nodeType}]`)
              before = [...before, ...flattened];

              if (newNode) {
                flattened = flattenObject(newNode, newNode.instanceName ? `node[${newNode.instanceName}]` : `node[${newNode.nodeType}]`);
                after = [...after, ...flattened];
              
                newNodes.splice(newNodeIndex, 1);
              }
            }

            for (let i=0; i<newNodes.length; i++) {
              const newNode = newNodes[i];
              let flattened = flattenObject(newNode, newNode.instanceName ? `node[${newNode.instanceName}]` : `node[${newNode.nodeType}]`);
              after = [...after, ...flattened];
            }
            
            let diff = diffLines(before.join("\n\n"), after.join("\n\n"));

            Constants.debug.logVersionDiffs && console.log("DIFF: ", diff);

            renderDiff = diff.map((part, index) => {
              Constants.debug.logVersionDiffs && console.log(`part[${index}]`, part);
              const color = part.added ? "green" : part.removed ? "red" : "grey";
              if (part.added || part.removed) {
                Constants.debug.logVersionDiffs && console.log("PRINTING DIFF: ", part.value);
                return (
                  <Typography
                    key={index}
                    style={{ color, display: "block" }}
                    component="div" 
                    dangerouslySetInnerHTML={{ __html: marked(part.value + "\n\n") }} 
                  />
                );
              }
            });
          }

          setSettingsDiff(<Box sx={{ width: "100%" }}>{renderDiff}</Box>);
      }, 300); // delay
  }


  const handleAddNodeClose = () => {
    setAddNodeAnchorEl(null);
  };


  const handleAddNode = (templateName) => {    
    handleAddNodeClose();
    onNodeStructureChange(null, "add", {templateName});
  };

  
  function delayedUpdateVersionInfo() {
    if (versionInfoUpdateTimeoutId.current) {
      clearTimeout(versionInfoUpdateTimeoutId.current);
      versionInfoUpdateTimeoutId.current = null;
    }
    versionInfoUpdateTimeoutId.current = setTimeout(() => {
      let versionInfoCopy = { ...newVersionInfoRef.current };
      updateVersionInfo(versionInfoCopy);
    }, 300);
  }

  function onPersonaListChange(persona, action, optionalParams={}) {
    console.log("onPersonaListChange", persona, action, optionalParams);

    switch (action) {
      case "upsert":{
        let versionInfoCopy = { ...newVersionInfoRef.current };
        versionInfoCopy.personas = versionInfoCopy.personas ? [...versionInfoCopy.personas] : [];
        let personaIndex = versionInfoCopy.personas.findIndex((p) => p.personaID == persona.personaID);
        if (personaIndex >= 0) {
          versionInfoCopy.personas[personaIndex] = persona;
        } else {
          versionInfoCopy.personas.push(persona);
        }
        updateVersionInfo(versionInfoCopy);
      }
      break;
      default:
        throw new Error("Unknown persona action: " + action);
    }
  }

  function replaceAllNodePlaceholderSettings(newNode) {
        // check if any of the newnode params need to have a default value replaced
        if (typeof newNode.params?.apiKey !== "undefined") {
          const finalApiKey = replacePlaceholderSettingWithFinalValue(newNode.params.apiKey, account);
          console.log("Migrated API key -> ", finalApiKey);
          newNode.params.apiKey = finalApiKey;
        }
  }

  function onNodeStructureChange(node, action, optionalParams={}) {
    //console.log("onNodeStructureChange ", action)
    const { templateName, producer, producerInstanceID, inputParams } = optionalParams;

    let returnValue = null;
    switch (action) {
      case "add":{
        // Need to deep-copy this node
        const nodeMetadata = getMetadataForNodeType(templateName);
        const initMenu = nodeMetadata.initMenu;
        initDataRef.current = JSON.parse(JSON.stringify(nodeMetadata.newNodeTemplate));
        initDataRef.current.instanceID = uuidv4();
        if (initMenu) {
          setModalEditingMode({
            menu: initMenu,
            mode: 'nodeInit',
            onConfirm: (result) => result && onNodeStructureChange(node, "finishadd", {templateName}),
          });
          return;
        } else {
          return onNodeStructureChange(node, "finishadd", {});
        }
      }
      break;
      case "overwrite":
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        versionInfoCopy.stateMachineDescription.nodes = versionInfoCopy.stateMachineDescription.nodes.map((n) => {
          if (n.instanceID == node.instanceID) {
            return node;
          }
          return n;
        });
        updateVersionInfo(versionInfoCopy);
      break;
      case "finishadd": {
        let newNode = initDataRef.current;
        initDataRef.current = null;
        replaceAllNodePlaceholderSettings(newNode);
        let suffix = 0;
        let instanceName = newNode.instanceName;      
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        while (versionInfoCopy.stateMachineDescription.nodes.find((n) => n.instanceName == newNode.instanceName)) {
          suffix++;
          newNode.instanceName = `${instanceName}${suffix}`;
        }
        versionInfoCopy.stateMachineDescription.nodes.push(newNode);
        updateVersionInfo(versionInfoCopy)
      }
      break;
      case "delete": {
        console.log("   DELETE NODE: ", node.instanceID, newVersionInfoRef.current.stateMachineDescription.nodes)
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        // Must remove the node but also all inputs that reference this node
        versionInfoCopy.stateMachineDescription.nodes = versionInfoCopy.stateMachineDescription.nodes.filter(
          (n) => n.instanceID != node.instanceID
        );
        // Remove inputs referencing the deleted node
        versionInfoCopy.stateMachineDescription.nodes.map((n) => {
          if (n.inputs && Array.isArray(n.inputs)) {
            n.inputs = n.inputs.filter((input) => input.producerInstanceID != node.instanceID);
          }
        });
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "duplicate": {
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        let newDuplicateNode = JSON.parse(JSON.stringify(node));
        newDuplicateNode.instanceID = uuidv4();
        
        //
        // Find a unique instanceName for the new node
        //
        let match = newDuplicateNode.instanceName.match(/(\d+)$/);
        let suffix = match ? parseInt(match[1]) : 0;        
        // Start with the base name without the numeric suffix, if it was present
        let baseName = match ? newDuplicateNode.instanceName.slice(0, match.index) : newDuplicateNode.instanceName;        
        // Keep incrementing the suffix and updating the instanceName 
        // until a unique name is found
        while (versionInfoCopy.stateMachineDescription.nodes.find((n) => n.instanceName === newDuplicateNode.instanceName)) {
          suffix++;
          newDuplicateNode.instanceName = baseName + suffix;
        }

        versionInfoCopy.stateMachineDescription.nodes.push(newDuplicateNode);
        updateVersionInfo(versionInfoCopy);
        // Get the ref to the new node
        returnValue = newVersionInfoRef.current.stateMachineDescription.nodes.find((n) => n.instanceID == newDuplicateNode.instanceID);
        console.log("Duplicated node: ", returnValue)
      }
      break;
      case "input": {
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "visualUpdateNeeded":
        delayedUpdateVersionInfo();
      break;
      case "copyParamsToSameType": {
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        let paramsToCopy = getMetadataForNodeType(node.nodeType).parametersToCopy;
        if (!paramsToCopy) {
          return;
        }
        paramsToCopy.map((param) => {
          const overwriteValue = getNestedObjectProperty(node.params, param);
          versionInfoCopy.stateMachineDescription.nodes.map((n) => {
            if (n.nodeType == node.nodeType) {
                setNestedObjectProperty(n.params, param, overwriteValue);
              }
          });
        });
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "setinputparams": {
        // Ensure the node is the same reference as the one in the current version info
        // since it's possible for a reference to become stale, for example, if the node
        // was just created/duplicated and now we're adding an edge right away
        const nodeToUse = newVersionInfoRef.current.stateMachineDescription.nodes.find((n) => n.instanceID == node.instanceID);
        if (nodeToUse.nodeType == "start") {
           // Not possible to add an input to this node type
           console.log("Cannot add an input to this node type");
           return;
        }

        // See if there's an existing input for this producer
        nodeToUse.inputs = nodeToUse.inputs ? nodeToUse.inputs : [];
        let inputForProducer = nodeToUse.inputs.find((input) => input.producerInstanceID == producerInstanceID);
        
        if (!inputForProducer) {
          // If no existing entry, nothing to do
          return;
        }
         
        if (inputParams.includeHistory) {
          console.log("applying input params: ", inputParams)
        }

        inputForProducer = JSON.parse(JSON.stringify(inputForProducer));
        inputForProducer = {
          ...inputForProducer,
          ...inputParams,
        };

        // update this node's input with the new one
        nodeToUse.inputs = nodeToUse.inputs.map((input) => {
          if (input.producerInstanceID == producerInstanceID) {
            return inputForProducer;
          }
          return input;
        });

        // Update the version info
        onVariableChanged(nodeToUse, "inputs", nodeToUse.inputs);
        let versionInfoCopy = { ...newVersionInfoRef.current };
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "addinputeventtrigger": {
        const { producerEvent, targetTrigger, producerInstanceID } = optionalParams;
        if (!producerEvent || !targetTrigger) {
          throw new Error("addinputvariableproducer: Invalid parameters " + producerEvent + " , " + targetTrigger);
        }
        // Ensure the node is the same reference as the one in the current version info
        // since it's possible for a reference to become stale, for example, if the node
        // was just created/duplicated and now we're adding an edge right away
        const nodeToUse = newVersionInfoRef.current.stateMachineDescription.nodes.find((n) => n.instanceID == node.instanceID);
        if (nodeToUse.nodeType == "start") {
           // Not possible to add an input to this node type
           console.log("Cannot add an input to this node type");
           return;
        }

        // See if there's an existing input for this producer
        nodeToUse.inputs = nodeToUse.inputs ? nodeToUse.inputs : [];
        let inputForProducer = nodeToUse.inputs.find((input) => input.producerInstanceID == producerInstanceID);
        
        if (!inputForProducer) {
          // If no existing entry, create one based on the node's input template
          
          const nodeMetadata = getMetadataForNodeType(nodeToUse.nodeType);
          if (nullUndefinedOrEmpty(nodeMetadata.inputTemplate)) {
            throw new Error(nodeToUse.nodeType + " node does not have an event trigger template");
          }
          inputForProducer = JSON.parse(JSON.stringify(nodeMetadata.inputTemplate));
          inputForProducer.triggers = [];
          inputForProducer.producerInstanceID = producerInstanceID;

          nodeToUse.inputs.push(inputForProducer);
        } else {
          // If this node is already an input, see if this specific trigger is included
          if (inputForProducer.triggers && inputForProducer.triggers.find((trigger) => (trigger.targetTrigger == targetTrigger && trigger.producerEvent == producerEvent))) {
            console.log("Producer already has a trigger for this event");
            return;
          }
        }

        let newTrigger = {};
        newTrigger.producerEvent = producerEvent;
        newTrigger.targetTrigger = targetTrigger;
        if (!inputForProducer.triggers) {
          inputForProducer.triggers = [];
        }
        inputForProducer.triggers.push(newTrigger);

        console.log("Inserting new event input: ", inputForProducer);
        // update this node's input with the new one
        nodeToUse.inputs = nodeToUse.inputs.map((input) => {
          if (input.producerInstanceID == producerInstanceID) {
            return inputForProducer;
          }
          return input;
        });

        // Update the version info
        onVariableChanged(nodeToUse, "inputs", nodeToUse.inputs);
        let versionInfoCopy = { ...newVersionInfoRef.current };
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "addinputvariableproducer": {
        
        const { producerOutput, consumerVariable, producerInstanceID } = optionalParams;
        if (!producerOutput || !consumerVariable) {
          throw new Error("addinputvariableproducer: Invalid parameters " + producerOutput + ", " + consumerVariable);
        }
        // Ensure the node is the same reference as the one in the current version info
        // since it's possible for a reference to become stale, for example, if the node
        // was just created/duplicated and now we're adding an edge right away
        const nodeToUse = newVersionInfoRef.current.stateMachineDescription.nodes.find((n) => n.instanceID == node.instanceID);
        if (nodeToUse.nodeType == "start") {
           // Not possible to add an input to this node type
           console.log("Cannot add an input to this node type");
           return;
        }

        // See if there's an existing input for this producer
        nodeToUse.inputs = nodeToUse.inputs ? nodeToUse.inputs : [];
        let inputForProducer = nodeToUse.inputs.find((input) => input.producerInstanceID == producerInstanceID);
        
        const nodeMetadata = getMetadataForNodeType(nodeToUse.nodeType);
        if (!inputForProducer) {
          
          if (nullUndefinedOrEmpty(nodeMetadata.inputTemplate)) {
            throw new Error(nodeToUse.nodeType + " node does not have an event trigger template");
          }
          inputForProducer = JSON.parse(JSON.stringify(nodeMetadata.inputTemplate));
          inputForProducer.variables = [];
          inputForProducer.producerInstanceID = producerInstanceID;

          nodeToUse.inputs.push(inputForProducer);
        } else {
          // If this node is already an input, see if this specific variable is included
          let existingVariableIndex = inputForProducer.variables ? inputForProducer.variables.findIndex((variable) => variable.consumerVariable == consumerVariable) : -1;
          if (existingVariableIndex >= 0) {

            if (inputForProducer.variables[existingVariableIndex].producerOutput == producerOutput) {
              // This variable is already connected to this producer output
              return;
            } else  {
              const variableMetadata = nodeMetadata.AllowedVariableOverrides[consumerVariable];
              console.log("overwriting consumer, mediatype=", variableMetadata?.mediaType)
              if (variableMetadata?.mediaType != "composite") {
                // Changing which output is pointing to this input -- delete the entry so we can replace with a new one
                inputForProducer.variables.splice(existingVariableIndex, 1);        
              }      
            }
          }
        }

        let newVariableEntry = {};
        newVariableEntry.producerOutput = producerOutput;
        newVariableEntry.consumerVariable = consumerVariable;
        if (!inputForProducer.variables) {
          inputForProducer.variables = [];
        }
        inputForProducer.variables.push(newVariableEntry);

        console.log("Inserting new variable input: ", inputForProducer);
        // update this node's input with the new one
        nodeToUse.inputs = nodeToUse.inputs.map((input) => {
          if (input.producerInstanceID == producerInstanceID) {
            return inputForProducer;
          }
          return input;
        });

        // Update the version info
        onVariableChanged(nodeToUse, "inputs", nodeToUse.inputs);
        let versionInfoCopy = { ...newVersionInfoRef.current };
        updateVersionInfo(versionInfoCopy);
      }
      break;
      case "deleteinput": {
        const { producerInstanceID, inputType, source, target } = optionalParams;
        console.log("deleteinput optionalParams: ", optionalParams)
        
        const nodeToUse = newVersionInfoRef.current.stateMachineDescription.nodes.find((n) => n.instanceID == node.instanceID);

        // See if there's an existing input for this producer
        nodeToUse.inputs = nodeToUse.inputs ? nodeToUse.inputs : [];
        let inputForProducer = nodeToUse.inputs.find((input) => input.producerInstanceID == producerInstanceID);
        if (!inputForProducer) {
          console.log("No existing input, ignoring. producer: ", producerInstanceID)
          return;
        }
        if (inputType == "trigger") {
          let triggerIndex = inputForProducer.triggers.findIndex((trigger) => trigger.producerEvent == source && trigger.targetTrigger == target);
          if (triggerIndex >= 0) {
            inputForProducer.triggers.splice(triggerIndex, 1);
          }
        } else if (inputType == "variable") {
          let variableIndex = inputForProducer.variables.findIndex((variable) => variable.producerOutput == source && variable.consumerVariable == target);
          if (variableIndex >= 0) {
            inputForProducer.variables.splice(variableIndex, 1);
          }
        }
        
        const stillValid = (inputForProducer.variables && inputForProducer.variables.length > 0) || (inputForProducer.triggers && inputForProducer.triggers.length > 0);

        if (stillValid) {
          nodeToUse.inputs = nodeToUse.inputs.map((input) => {
            if (input.producerInstanceID == producerInstanceID) {
              return inputForProducer;
            }
            return input;
          });
        } else {
          nodeToUse.inputs = nodeToUse.inputs.filter((input) => input.producerInstanceID != producerInstanceID);
        }

        // Update the version info
        onVariableChanged(nodeToUse, "inputs", nodeToUse.inputs);
        let versionInfoCopy = { ...newVersionInfoRef.current };
        updateVersionInfo(versionInfoCopy);
      }
      break;
      default:
        throw new Error("Unknown node action: " + action);
    }

    return returnValue;
  }
  
    function renderWithFormatting(children) {
      return (
        <StandardContentArea>
          <InfoBubble>{children}</InfoBubble>
        </StandardContentArea>
      );
    }
  
  const handleOpenNodeSettingsMenu = (node) => setModalEditingMode({
    nodeIndex: newVersionInfoRef.current.stateMachineDescription.nodes.findIndex((n) => n.instanceID == node.instanceID),
    mode: 'nodeDetails'
  });
  const handleOpenInputSettingsMenu = (producerNode, consumerNode) => setModalEditingMode({
    nodeIndex: newVersionInfoRef.current.stateMachineDescription.nodes.findIndex((n) => n.instanceID == consumerNode.instanceID),
    producerNode: producerNode,
    mode: 'inputDetails'
  });



  const onPublishedSettingsChanged = (object, relativePath, newValue) => {

    if (relativePath === "published") {
      if (newValue) {
        if (!publishDialogOpen) {
          setPublishDialogOpen(true);
        }
      } else {
        onVariableChanged(newVersionInfoRef.current, "published", false);
      }
    } else if (relativePath === "alwaysUseBuiltInKeys") {
      if (newValue) {
        if (!publishDialogOpen) {
         setUseAppKeysDialogOpen(true);
        }
      } else {
        onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
      }
    } else {
      onVariableChanged(object, relativePath, newValue);
    }
  }


  if (!(account && gamePermissions)) {
    console.log("Account or game permissions not loaded yet: ",  account ? "account" : "gamePermissions");
    return renderWithFormatting(<h1>Loading...</h1>);
  }

  if (!gamePermissions.includes("game_viewSource") && !gamePermissions.includes("game_edit")) {
    console.log("User is not authorized to view source or edit this game");
    return renderWithFormatting(<h1>You are not authorized to edit this app.</h1>);
  }

  return (
    <Box
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        overflowY: "auto",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <StandardContentArea>
      
      <Box sx={{ 
        width: "60%",
        justifyContent: 'space-between', 
        display: 'flex',  
        flexDirection: 'row',
        marginTop: 1, 
        }}
        >
        <VersionSelector allowNewGameOption={true} firstOptionUnselectable dropdown={true} chooseMostRecent={true}  />
        
        <Box sx={{ display: "flex", flexDirection: 'column' }}>
          <Typography className={classes.gameTypography} >
            {game ? game.title : "Loading"}
          </Typography>
          <Typography className={classes.versionTypography}>
            {versionInfo ? versionInfo.versionName : ""}
          </Typography>
        </Box>
      </Box>
        {!versionName ? 
          renderWithFormatting(<h1>Select a version from the dropdown above (or hit + to add one)</h1>)
        : (!versionInfo) ? 
          renderWithFormatting(<h1>Loading...</h1>)        
        : (
          <Box sx={{width:"100%", padding: 5}}>

              {newVersionInfoRef.current?.stateMachineDescription?.nodes ? (
                  <Box>

                    <Box sx={{ display: "flex", gap: "8px", justifyContent: 'flex-end', flexDirection: 'row', width: '100%', pr:2 }}>
                        <Button
                          variant="outlined"
                          color="primary"
                          className={classes.inputfield}
                          onClick={handleDiscardChanges}
                          disabled={!dirtyEditor}
                          startIcon={<DeleteForever />}
                        >
                          Discard changes
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          className={classes.inputfield}
                          onClick={submitNewVersionInfo}
                          disabled={readOnly || !dirtyEditor}
                          startIcon={<Save />}
                        >
                          Save changes
                          {dirtyEditor ? (
                            <Tooltip title="Unsaved changes">
                              <Box marginLeft={1}>
                                <ErrorIcon color="error" />
                              </Box>
                            </Tooltip>
                          ) : isUpdated ? (
                            <Tooltip title="Changes saved">
                              <Box marginLeft={1}>
                                <CheckCircle color="action" />
                              </Box>
                            </Tooltip>
                          ) : null}
                        </Button>
                        <Button
                          variant="contained"
                          color="secondary"
                          onClick={() =>
                            router.push(
                              `/play/${game.url}?versionName=${versionInfo.versionName}`
                            )
                          }
                          startIcon={<PlayArrow />}
                        >
                          Play
                        </Button>
                    </Box>
                     <Box sx={{ padding: 2, height: `${vh-200}px`, width: "100%" }}>
                        <NodeGraphDisplay 
                              theme={gameTheme}
                              versionInfo={newVersionInfoRef.current} 
                              onNodeClicked={handleOpenNodeSettingsMenu}
                              onNodeStructureChange={onNodeStructureChange}
                              onEdgeClicked={handleOpenInputSettingsMenu}
                              onPersonaListChange={onPersonaListChange}
                              sx={{ margin: 2, height: '100%', width: "100%", backgroundColor: "green"  }}
                              readOnly={readOnly}
                        />
                    </Box>
                  
                    
                    <Menu
                      id="node-type-menu"
                      anchorEl={addNodeAnchorEl}
                      keepMounted
                      open={Boolean(addNodeAnchorEl)}
                      onClose={handleAddNodeClose}
                    >
                      {addableNodeTypes.map((addableTemplate,index) =>  <MenuItem key={`addNode${index}`} onClick={() => handleAddNode(addableTemplate.nodeType)}>{addableTemplate.label}</MenuItem>)}
                    </Menu>
                  </Box>
                ) : (

                  <TemplateChooser
                    templateChosen={(template) => templateChosen(template)}
                  />

                )}


              <SettingsMenu
                menu={globalOptions}
                rootObject={newVersionInfoRef.current}
                onChange={onPublishedSettingsChanged}
                key={"settingsEditor"}
                readOnly={readOnly}
              />



              <Box
                display="flex"
                justifyContent="center"
                marginTop={4}
                marginBottom={2}
              >
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleDeleteVersion}
                  disabled={readOnly}
                >
                  Delete version
                </Button>
              </Box>

              {dirtyEditor && settingsDiff}

            </Box>
          )}
      </StandardContentArea>
      {modalEditingMode && 
        <ModalMenu
          onCloseRequest={() => setModalEditingMode(undefined)}
          onConfirm={modalEditingMode.onConfirm}
        >
          {(modalEditingMode.mode == 'nodeDetails') &&
              <NodeSettingsMenu 
                node={newVersionInfoRef.current?.stateMachineDescription?.nodes[modalEditingMode.nodeIndex]} 
                readOnly={readOnly} 
                nodes={newVersionInfoRef.current?.stateMachineDescription?.nodes} 
                onChange={onVariableChanged} 
                onNodeStructureChange={onNodeStructureChange}
                onPersonaListChange={onPersonaListChange}
                versionInfo={newVersionInfoRef.current}
              />
          }
          {(modalEditingMode.mode == 'inputDetails') &&
              <NodeInputsEditor 
                node={newVersionInfoRef.current?.stateMachineDescription?.nodes[modalEditingMode.nodeIndex]}
                readOnly={readOnly} 
                nodes={newVersionInfoRef.current?.stateMachineDescription?.nodes} 
                onChange={onVariableChanged} 
                onNodeStructureChange={onNodeStructureChange}
                onPersonaListChange={onPersonaListChange}
                producerNodeID={modalEditingMode.producerNode.instanceID}
              />
          }
          {(modalEditingMode.mode == 'nodeInit') &&
            <NodeInitMenu
              node={initDataRef.current}
              menu={modalEditingMode.menu}
              versionInfo={newVersionInfoRef.current}
              onVariableChanged={onVariableChanged}
              onPersonaListChange={onPersonaListChange}
              gameTheme={gameTheme}
            />
          }
        </ModalMenu>
      }
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-version-dialog-title"
        aria-describedby="delete-version-dialog-description"
      >
        <DialogTitle id="delete-version-dialog-title">
          Delete Game Version
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-version-dialog-description">
            Are you sure you want to permanently delete this app version? This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>


      <Dialog
        open={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        aria-labelledby="delete-version-dialog-title"
        aria-describedby="delete-version-dialog-description"
      >
        <DialogTitle id="delete-version-dialog-title">
          Discard Changes
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-version-dialog-description">
            Are you sure you want to permanently undo all unsaved changes?.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardChangesDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={() => doDiscardChanges()} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={publishDialogOpen} onClose={() => setPublishDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Choose Publishing Mode</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please select how you want to publish this version:
          </DialogContentText>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Button
              variant="outlined"
              onClick={() => {
                onVariableChanged(newVersionInfoRef.current, "published", true);
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
                setPublishDialogOpen(false);
              }}
            >
              Require users to provide their own keys (Recommended)
            </Button>
            <Typography variant="body2">
              Users get billed for their usage. If they don't configure API keys, your app will fail for them. You won't be billed for their usage.
            </Typography>

            <Button
              variant="outlined"
              sx={{marginTop: 3}}
              onClick={() => {
                onVariableChanged(newVersionInfoRef.current, "published", true);
                setPublishDialogOpen(false);
                setUseAppKeysDialogOpen(true);
              }}
            >
               Your API keys are billed for all usage (Caution)
            </Button>
            <Typography variant="body2" color="error">
              Warning: Users will use the API keys configured in your app's settings. You'll be billed for all users' API calls. This can lead to significant costs if not managed carefully.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPublishDialogOpen(false);
            onVariableChanged(newVersionInfoRef.current, "published", false);
          }}>Cancel</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={useAppKeysDialogOpen} onClose={() => setUseAppKeysDialogOpen(false)}>
        <DialogTitle>Warning: Using App's AI Keys</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You've chosen to use the app's AI keys for all users. This means:
            
            1. All API calls will be billed to your account.
            2. Users won't need to provide their own API keys.
            3. Your costs may increase significantly based on usage.
            
            Please ensure you have appropriate access controls and usage limits in place to prevent unexpected charges.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUseAppKeysDialogOpen(false);
            onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
          }}>
            Cancel
          </Button>
          <Button onClick={() => {
            onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", true);
            setUseAppKeysDialogOpen(false);
          }} 
          color="primary">
            I Understand
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default memo(VersionEditor);
