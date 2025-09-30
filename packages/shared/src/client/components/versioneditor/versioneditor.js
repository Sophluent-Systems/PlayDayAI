'use client';
import { useRouter } from "next/router";
import React, { memo, useState, useEffect, useRef } from "react";
import { defaultAppTheme } from "@src/common/theme";
import { AlertCircle, CheckCircle2, Play, Save, Trash2 } from "lucide-react";
import { VersionSelector } from "@src/client/components/versionselector";
import { useAtom } from "jotai";
import { vhState } from "@src/client/states";
import { editorSaveRequestState, dirtyEditorState } from "@src/client/states";
import {
  callGetVersionInfoForEdit,
  callReplaceAppVersion,
  callDeleteGameVersion,
} from "@src/client/editor";
import { useConfig } from "@src/client/configprovider";
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
import { SettingsMenu } from "@src/client/components/settingsmenus/settingsmenu";
import { VersionTemplates } from "./versiontemplates";
import { NodeGraphDisplay } from "./graphdisplay/nodegraphdisplay";
import { v4 as uuidv4 } from "uuid";
import { ModalMenu } from "@src/client/components/standard/modalmenu";
import ReactMarkdown from "react-markdown";
import { replacePlaceholderSettingWithFinalValue } from "@src/client/components/settingsmenus/menudatamodel";
import { getMetadataForNodeType, getAddableNodeTypes } from "@src/common/nodeMetadata";
import { analyticsReportEvent } from "@src/client/analytics";

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

const contentAreaClassName = "flex w-full flex-1 flex-col items-center bg-slate-50 px-6 pb-10 pt-8 sm:px-8 lg:px-12";
const infoBubbleClassName = "relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-5 text-slate-900 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.25)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100";

function DialogShell({ open, onClose, title, description, children, actions, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900`}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        ) : null}
        {description ? (
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
        {children ? (
          <div className={title || description ? "mt-4" : ""}>{children}</div>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

export function TemplateChooser({ templateChosen }) {
  const handleTemplateClick = (template) => {
    if (templateChosen) {
      templateChosen(template);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {VersionTemplates.map((template, index) => (
        <button
          key={template.label || index}
          type="button"
          onClick={() => handleTemplateClick(template)}
          className="group flex h-full flex-col items-center rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
        >
          <div className="mb-3 text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200">
            {template.icon}
          </div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{template.label}</div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{template.description}</p>
        </button>
      ))}
    </div>
  );
}

function VersionEditor(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { versionName } = router.query;
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
  const [vh] = useAtom(vhState);
  const contentAreaStyle = { minHeight: `${vh || 0}px` };
  const graphAreaHeight = vh ? `${vh - 200}px` : 'auto';

  const [showAddNodeMenu, setShowAddNodeMenu] = useState(false);
  const settingsDiffTimeoutId = useRef(null);
  const versionInfoUpdateTimeoutId = useRef(null);
  const [modalEditingMode, setModalEditingMode] = useState(undefined);
  const initDataRef = useRef(null);
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [useAppKeysDialogOpen, setUseAppKeysDialogOpen] = useState(false);

  const gameTheme = game?.theme ? game.theme : defaultAppTheme;

  const buttonStyles = {
    subtle: "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700",
    primary: "inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-300",
    accent: "inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60",
    danger: "inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-400 dark:focus:ring-rose-300",
    outline: "inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-500",
  };

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
    if (readOnly) {
      setShowAddNodeMenu(false);
    }
  }, [readOnly]);

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
                  <div
                    key={`diff-${index}`}
                    style={{ color, display: "block" }}
                  >
                    <ReactMarkdown>{part.value + "\n\n"}</ReactMarkdown>
                  </div>
                );
              }
            });
          }

          setSettingsDiff(<div className="w-full">{renderDiff}</div>);
      }, 300); // delay
  }


  const handleAddNode = (templateName) => {
    if (readOnly) {
      return;
    }
    setShowAddNodeMenu(false);
    onNodeStructureChange(null, "add", { templateName });
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
  
  function renderInfoBubble(content) {
    return (
      <div className={infoBubbleClassName}>
        <div className="flex w-full items-start gap-4">{content}</div>
      </div>
    );
  }

  function renderWithFormatting(content) {
    return (
      <div
        className={contentAreaClassName}
        style={contentAreaStyle}
      >
        {renderInfoBubble(content)}
      </div>
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
    <div className="relative flex h-full w-full flex-col overflow-y-auto">
      <div
        className={contentAreaClassName}
        style={contentAreaStyle}
      >
        <div className="mx-auto mt-4 flex w-full flex-col gap-4 md:w-3/5 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:w-auto">
            <VersionSelector allowNewGameOption={true} firstOptionUnselectable dropdown={true} chooseMostRecent={true} />
          </div>

          <div className="flex flex-col items-center text-center md:items-end md:text-right">
            <p
              className="mb-0 text-xl font-semibold uppercase tracking-[0.2em]"
              style={{
                fontFamily: gameTheme?.fonts?.titleFont,
                color: gameTheme?.colors?.titleFontColor,
                textShadow: gameTheme?.palette?.textSecondary
                  ? "0px 0px 10px " + gameTheme.palette.textSecondary
                  : undefined,
              }}
            >
              {game ? game.title : "Loading"}
            </p>
            <p
              className="mb-0 text-xl tracking-[0.2em]"
              style={{
                fontFamily: gameTheme?.fonts?.titleFont,
                color: gameTheme?.colors?.titleFontColor,
              }}
            >
              {versionInfo ? versionInfo.versionName : ""}
            </p>
          </div>
        </div>

        {!versionName ? (
          renderInfoBubble(<h1>Select a version from the dropdown above (or hit + to add one)</h1>)
        ) : !versionInfo ? (
          renderInfoBubble(<h1>Loading...</h1>)
        ) : (
          <div className="w-full p-5">
            {newVersionInfoRef.current?.stateMachineDescription?.nodes ? (
              <div className="space-y-4">
                <div className="flex w-full justify-end gap-2 pr-2">
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    disabled={!dirtyEditor}
                    className={buttonStyles.subtle}
                  >
                    <Trash2 className="h-4 w-4" />
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={submitNewVersionInfo}
                    disabled={readOnly || !dirtyEditor}
                    className={buttonStyles.primary}
                  >
                    <Save className="h-4 w-4" />
                    Save changes
                    {dirtyEditor ? (
                      <span title="Unsaved changes" className="ml-2 inline-flex items-center text-red-500">
                        <AlertCircle className="h-5 w-5" />
                      </span>
                    ) : isUpdated ? (
                      <span title="Changes saved" className="ml-2 inline-flex items-center text-slate-400">
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      router.push('/play/' + game.url + '?versionName=' + versionInfo.versionName)
                    }
                    className={buttonStyles.accent}
                  >
                    <Play className="h-4 w-4" />
                    Play
                  </button>
                </div>
                <div
                  className="w-full rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  style={{ height: graphAreaHeight }}
                >
                  <NodeGraphDisplay
                    theme={gameTheme}
                    versionInfo={newVersionInfoRef.current}
                    onNodeClicked={handleOpenNodeSettingsMenu}
                    onNodeStructureChange={onNodeStructureChange}
                    onEdgeClicked={handleOpenInputSettingsMenu}
                    onPersonaListChange={onPersonaListChange}
                    readOnly={readOnly}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddNodeMenu((prev) => !prev)}
                    disabled={readOnly}
                    className={buttonStyles.subtle}
                  >
                    {showAddNodeMenu ? 'Close node menu' : 'Add node'}
                  </button>
                </div>
                {showAddNodeMenu ? (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    {addableNodeTypes.map((addableTemplate) => (
                      <button
                        key={`addNode-${addableTemplate.nodeType}`}
                        type="button"
                        onClick={() => handleAddNode(addableTemplate.nodeType)}
                        disabled={readOnly}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
                      >
                        {addableTemplate.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
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

            <div className="mt-4 mb-2 flex justify-center">
              <button
                type="button"
                onClick={handleDeleteVersion}
                disabled={readOnly}
                className={buttonStyles.danger}
              >
                Delete version
              </button>
            </div>

            {dirtyEditor && settingsDiff}
          </div>
        )}
      </div>
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
      <DialogShell
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        title="Delete Game Version"
        description="Are you sure you want to permanently delete this app version? This action cannot be undone."
        actions={
          <>
            <button
              type="button"
              onClick={handleCancelDelete}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className={buttonStyles.danger}
            >
              Delete
            </button>
          </>
        }
      />


      <DialogShell
        open={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        title="Discard Changes"
        description="Are you sure you want to permanently undo all unsaved changes?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDiscardChangesDialogOpen(false)}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => doDiscardChanges()}
              className={buttonStyles.danger}
            >
              Discard
            </button>
          </>
        }
      />
      <DialogShell
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        title="Choose Publishing Mode"
        description="Please select how you want to publish this version:"
        maxWidth="max-w-2xl"
        actions={
          <button
            type="button"
            onClick={() => {
              setPublishDialogOpen(false);
              onVariableChanged(newVersionInfoRef.current, "published", false);
            }}
            className={buttonStyles.outline}
          >
            Cancel
          </button>
        }
      >
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              onVariableChanged(newVersionInfoRef.current, "published", true);
              onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
              setPublishDialogOpen(false);
            }}
            className={buttonStyles.outline}
          >
            Require users to provide their own keys (Recommended)
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Users get billed for their usage. If they don't configure API keys, your app will fail for them. You won't be billed for their usage.
          </p>
          <button
            type="button"
            onClick={() => {
              onVariableChanged(newVersionInfoRef.current, "published", true);
              setPublishDialogOpen(false);
              setUseAppKeysDialogOpen(true);
            }}
            className={buttonStyles.outline}
          >
            Your API keys are billed for all usage (Caution)
          </button>
          <p className="text-sm text-rose-600 dark:text-rose-400">
            Warning: Users will use the API keys configured in your app's settings. You'll be billed for all users' API calls. This can lead to significant costs if not managed carefully.
          </p>
        </div>
      </DialogShell>
      <DialogShell
        open={useAppKeysDialogOpen}
        onClose={() => setUseAppKeysDialogOpen(false)}
        title="Warning: Using App's AI Keys"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setUseAppKeysDialogOpen(false);
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
              }}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", true);
                setUseAppKeysDialogOpen(false);
              }}
              className={buttonStyles.primary}
            >
              I Understand
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>You've chosen to use the app's AI keys for all users. This means:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>All API calls will be billed to your account.</li>
            <li>Users won't need to provide their own API keys.</li>
            <li>Your costs may increase significantly based on usage.</li>
          </ul>
          <p>Please ensure you have appropriate access controls and usage limits in place to prevent unexpected charges.</p>
        </div>
      </DialogShell>
      <DialogShell
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        title="Delete Game Version"
        description="Are you sure you want to permanently delete this app version? This action cannot be undone."
        actions={
          <>
            <button
              type="button"
              onClick={handleCancelDelete}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className={buttonStyles.danger}
            >
              Delete
            </button>
          </>
        }
      />


      <DialogShell
        open={discardChangesDialogOpen}
        onClose={() => setDiscardChangesDialogOpen(false)}
        title="Discard Changes"
        description="Are you sure you want to permanently undo all unsaved changes?"
        actions={
          <>
            <button
              type="button"
              onClick={() => setDiscardChangesDialogOpen(false)}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => doDiscardChanges()}
              className={buttonStyles.danger}
            >
              Discard
            </button>
          </>
        }
      />
      <DialogShell
        open={publishDialogOpen}
        onClose={() => setPublishDialogOpen(false)}
        title="Choose Publishing Mode"
        description="Please select how you want to publish this version:"
        maxWidth="max-w-2xl"
        actions={
          <button
            type="button"
            onClick={() => {
              setPublishDialogOpen(false);
              onVariableChanged(newVersionInfoRef.current, "published", false);
            }}
            className={buttonStyles.outline}
          >
            Cancel
          </button>
        }
      >
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              onVariableChanged(newVersionInfoRef.current, "published", true);
              onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
              setPublishDialogOpen(false);
            }}
            className={buttonStyles.outline}
          >
            Require users to provide their own keys (Recommended)
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Users get billed for their usage. If they don't configure API keys, your app will fail for them. You won't be billed for their usage.
          </p>
          <button
            type="button"
            onClick={() => {
              onVariableChanged(newVersionInfoRef.current, "published", true);
              setPublishDialogOpen(false);
              setUseAppKeysDialogOpen(true);
            }}
            className={buttonStyles.outline}
          >
            Your API keys are billed for all usage (Caution)
          </button>
          <p className="text-sm text-rose-600 dark:text-rose-400">
            Warning: Users will use the API keys configured in your app's settings. You'll be billed for all users' API calls. This can lead to significant costs if not managed carefully.
          </p>
        </div>
      </DialogShell>
      <DialogShell
        open={useAppKeysDialogOpen}
        onClose={() => setUseAppKeysDialogOpen(false)}
        title="Warning: Using App's AI Keys"
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setUseAppKeysDialogOpen(false);
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", false);
              }}
              className={buttonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", true);
                setUseAppKeysDialogOpen(false);
              }}
              className={buttonStyles.primary}
            >
              I Understand
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <p>You've chosen to use the app's AI keys for all users. This means:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>All API calls will be billed to your account.</li>
            <li>Users won't need to provide their own API keys.</li>
            <li>Your costs may increase significantly based on usage.</li>
          </ul>
          <p>Please ensure you have appropriate access controls and usage limits in place to prevent unexpected charges.</p>
        </div>
      </DialogShell>
    </div>
  );
}

export default memo(VersionEditor);

