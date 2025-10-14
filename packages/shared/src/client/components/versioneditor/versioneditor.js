'use client';
import { useRouter } from "next/router";
import React, { memo, useState, useEffect, useRef } from "react";
import { defaultAppTheme } from "@src/common/theme";
import { AlertCircle, CheckCircle2, GaugeCircle, Layers, Play, Save, Settings2, Trash2, Workflow, X } from "lucide-react";
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
import ReactMarkdown from "react-markdown";
import { replacePlaceholderSettingWithFinalValue } from "@src/client/components/settingsmenus/menudatamodel";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { analyticsReportEvent } from "@src/client/analytics";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { NodeInputsEditor } from "./nodeinputseditor";
import { NodeInitMenu } from "./nodeinitmenu";
import { FloatingPanel } from "./floatingpanel";
import { NodeLibraryTree } from "./nodelibrarytree";

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

function parseRgbFromString(color) {
  if (!color || typeof color !== 'string') {
    return null;
  }
  if (color.startsWith('#')) {
    let normalized = color.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized.split('').map((char) => char + char).join('');
    }
    if (normalized.length !== 6) {
      return null;
    }
    const intValue = parseInt(normalized, 16);
    return {
      r: (intValue >> 16) & 255,
      g: (intValue >> 8) & 255,
      b: intValue & 255,
    };
  }
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }
  const parts = match[1].split(',').map((component) => parseFloat(component.trim()));
  if (parts.length < 3) {
    return null;
  }
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function colorWithAlpha(color, alpha, fallback = '#38bdf8') {
  const rgb = parseRgbFromString(color) || parseRgbFromString(fallback);
  if (!rgb) {
    return `rgba(56, 189, 248, ${alpha})`;
  }
  const resolvedAlpha = Math.min(Math.max(alpha, 0), 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${resolvedAlpha})`;
}

function getLuminance(color) {
  const rgb = parseRgbFromString(color);
  if (!rgb) {
    return 0;
  }
  const transform = (channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const r = transform(rgb.r);
  const g = transform(rgb.g);
  const b = transform(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractTimestamp(dateLike) {
  if (!dateLike) {
    return 0;
  }
  if (dateLike instanceof Date) {
    return dateLike.getTime();
  }
  if (typeof dateLike === 'object') {
    if (Object.prototype.hasOwnProperty.call(dateLike, '$date')) {
      return extractTimestamp(dateLike.$date);
    }
    if (Object.prototype.hasOwnProperty.call(dateLike, '$numberLong')) {
      return extractTimestamp(Number(dateLike.$numberLong));
    }
  }
  const parsed = new Date(dateLike).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function DialogShell({ open, onClose, title, description, children, actions, maxWidth = "max-w-lg", tone = "light" }) {
  if (!open) {
    return null;
  }
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

  const isDarkTone = tone === "dark";
  const containerClasses = `relative w-full ${maxWidth} rounded-2xl border p-6 shadow-xl ${isDarkTone ? 'bg-slate-950/95 text-slate-100 border-white/10' : 'bg-white text-slate-900 border-slate-200'}`;
  const descriptionClasses = isDarkTone ? 'mt-3 text-sm leading-6 text-slate-300' : 'mt-3 text-sm leading-6 text-slate-600';
  const bodyClasses = `${title || description ? 'mt-4' : ''} ${isDarkTone ? 'text-slate-200' : 'text-slate-700'}`;

  return (
    <div
      className="fixed inset-0 z-[15000] flex items-center justify-center bg-slate-950/60 px-4"
      onClick={onClose}
    >
      <div
        className={containerClasses}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <h2 className={isDarkTone ? 'text-lg font-semibold text-slate-100' : 'text-lg font-semibold text-slate-900'}>{title}</h2>
        ) : null}
        {description ? (
          <p className={descriptionClasses}>{description}</p>
        ) : null}
        {children ? (
          <div className={bodyClasses}>{children}</div>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

function TemplateChooser({ templateChosen }) {
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
  const { versionName: versionNameParam } = router.query;
  const versionName = Array.isArray(versionNameParam) ? versionNameParam[0] : versionNameParam;
  const {
    loading,
    account,
    game,
    version,
    versionList,
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

  const settingsDiffTimeoutId = useRef(null);
  const versionInfoUpdateTimeoutId = useRef(null);
  const [inspectorState, setInspectorState] = useState(undefined);
  const initDataRef = useRef(null);
  const [discardChangesDialogOpen, setDiscardChangesDialogOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [useAppKeysDialogOpen, setUseAppKeysDialogOpen] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [actionsPanelOpen, setActionsPanelOpen] = useState(true);
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(true);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(false);

  const gameTheme = game?.theme ? game.theme : defaultAppTheme;
  const baseBackgroundColor = gameTheme?.colors?.titleBackgroundColor || '#0f172a';
  const accentColor = gameTheme?.palette?.textSecondary || gameTheme?.colors?.primaryButtonColor || '#38bdf8';
  const isDarkTheme = getLuminance(baseBackgroundColor) < 0.6;

  const workspaceStyle = {
    minHeight: `${vh || 0}px`,
    background: `linear-gradient(160deg, ${colorWithAlpha(baseBackgroundColor, isDarkTheme ? 0.95 : 0.9)} 0%, ${colorWithAlpha(baseBackgroundColor, isDarkTheme ? 0.65 : 0.45)} 45%, ${colorWithAlpha('#0f172a', isDarkTheme ? 0.85 : 0.2)} 100%)`,
    color: isDarkTheme ? '#f8fafc' : '#0f172a',
  };
  const overlayStyle = {
    background: `radial-gradient(circle at top, ${colorWithAlpha(accentColor, isDarkTheme ? 0.22 : 0.12)}, transparent 60%)`,
  };
  const infoBubbleClassName = isDarkTheme
    ? 'relative w-full max-w-4xl rounded-3xl border border-white/15 bg-white/10 px-6 py-6 text-slate-100 shadow-[0_45px_120px_-60px_rgba(56,189,248,0.55)] backdrop-blur'
    : 'relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white px-6 py-6 text-slate-900 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.18)]';
  const heroTextClass = isDarkTheme ? 'flex flex-col gap-1 text-slate-100' : 'flex flex-col gap-1 text-slate-900';
  const heroSubtitleClass = isDarkTheme
    ? 'text-xs font-medium uppercase tracking-[0.35em] text-slate-300'
    : 'text-xs font-medium uppercase tracking-[0.35em] text-slate-500';
  const heroVersionClass = isDarkTheme
    ? 'text-sm uppercase tracking-[0.3em] text-slate-300'
    : 'text-sm uppercase tracking-[0.3em] text-slate-500';
  const unsavedBadgeClass = isDarkTheme
    ? 'ml-2 inline-flex items-center text-rose-200'
    : 'ml-2 inline-flex items-center text-rose-500';
  const savedBadgeClass = isDarkTheme
    ? 'ml-2 inline-flex items-center text-slate-200'
    : 'ml-2 inline-flex items-center text-slate-500';
  const lightButtonStyles = {
    subtle: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60',
    primary: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(56,189,248,0.6)] transition hover:from-sky-400 hover:to-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60',
    accent: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(16,185,129,0.55)] transition hover:from-emerald-400 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60',
    danger: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(244,63,94,0.55)] transition hover:from-rose-400 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60',
    outline: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60',
  };

  const darkButtonStyles = {
    subtle: 'inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/40 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60',
    primary: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 via-sky-400 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(56,189,248,0.9)] transition hover:from-sky-400 hover:to-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60',
    accent: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(16,185,129,0.9)] transition hover:from-emerald-400 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60',
    danger: 'inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(244,63,94,0.9)] transition hover:from-rose-400 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60',
    outline: 'inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/40 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60',
  };

  const buttonStyles = isDarkTheme ? darkButtonStyles : lightButtonStyles;
  const dialogButtonStyles = lightButtonStyles;

  async function submitNewVersionInfo() {
    try {
      await callReplaceAppVersion(newVersionInfoRef.current);
      setNewVersionInfo({ ...newVersionInfoRef.current });
      dirtyEditorRef.current = false;
      setDirtyEditor(false);
      setIsUpdated(true);
      updateSettingsDiff(versionInfo, newVersionInfoRef.current);
      await updateVersion(true);
    } catch (error) {
      alert('Error saving updates: ' + error);
    }
  }




  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (dirtyEditor) {
        submitNewVersionInfo();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    analyticsReportEvent('edit_version', {
      event_category: 'Editor',
      event_label: 'Edit version',
      gameID: game?.gameID,
      versionID: version?.versionID,
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (version && gamePermissions && readOnly !== shouldBeReadOnly()) {
      refreshVersionInfo();
    }
  }, [gamePermissions]);

  useEffect(() => {
    if (version) {
      refreshVersionInfo();
    }
  }, [version]);

  useEffect(() => {
    if (!Array.isArray(versionList) || versionList.length === 0) {
      return;
    }

    const selectedVersionExists = versionName
      ? versionList.some((item) => item?.versionName === versionName)
      : false;

    if (selectedVersionExists) {
      return;
    }

    const bestVersion = [...versionList]
      .filter(Boolean)
      .sort((a, b) => {
        const aTimestamp = extractTimestamp(a?.lastUpdatedDate) || extractTimestamp(a?.creationDate);
        const bTimestamp = extractTimestamp(b?.lastUpdatedDate) || extractTimestamp(b?.creationDate);
        return bTimestamp - aTimestamp;
      })[0];

    if (bestVersion?.versionName) {
      switchVersionByName(bestVersion.versionName);
    }
  }, [versionList, versionName, switchVersionByName]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (dirtyEditor) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtyEditor]);

  useEffect(() => {
    if (versionInfo && newVersionInfo) {
      updateSettingsDiff(versionInfo, newVersionInfoRef.current);
    }
  }, [versionInfo, newVersionInfo]);

  function shouldBeReadOnly() {
    const hasEditPermissions = gamePermissions?.includes('game_edit');
    return !hasEditPermissions;
  }

  useEffect(() => {
    if (!version || !Array.isArray(gamePermissions)) {
      return;
    }
    const nextReadOnly = shouldBeReadOnly();
    if (nextReadOnly !== readOnly) {
      setreadOnly(nextReadOnly);
    }
  }, [version, gamePermissions]);

  useEffect(() => {
    async function doSave() {
      if (editorSaveRequest === 'save') {
        if (dirtyEditor) {
          await submitNewVersionInfo();
        }
        setEditorSaveRequest('saved');
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

    const handleDiscardChanges = () => {
    setDiscardChangesDialogOpen(true);
  };

  const doDiscardChanges = () => {
    newVersionInfoRef.current = JSON.parse(JSON.stringify(versionInfo));
    setNewVersionInfo(newVersionInfoRef.current);
    dirtyEditorRef.current = false;
    setDirtyEditor(false);
    setDiscardChangesDialogOpen(false);
    setIsUpdated(false);
  };

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
          setInspectorState({
            menu: initMenu,
            mode: 'nodeInit',
            onConfirm: (result) => {
              if (result) {
                onNodeStructureChange(node, "finishadd", { templateName });
              } else {
                initDataRef.current = null;
              }
            },
          });
          setInspectorPanelOpen(true);
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
  
  const renderStatusOverlay = (content) => (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div className={`pointer-events-auto ${infoBubbleClassName}`}>
        <div className="flex w-full items-start gap-4">{content}</div>
      </div>
    </div>
  );

  const inspectorNodes = newVersionInfoRef.current?.stateMachineDescription?.nodes ?? [];
  const inspectorNode =
    inspectorState && inspectorNodes.length > inspectorState.nodeIndex
      ? inspectorNodes[inspectorState.nodeIndex]
      : null;

  const renderInspectorContent = () => {
    if (!inspectorState) {
      return (
        <p className="text-sm text-slate-300">
          Select a node to inspect its configuration.
        </p>
      );
    }

    if (inspectorState.mode === 'nodeDetails') {
      return (
        <NodeSettingsMenu
          node={inspectorNode}
          readOnly={readOnly}
          nodes={inspectorNodes}
          onChange={onVariableChanged}
          onNodeStructureChange={onNodeStructureChange}
          onPersonaListChange={onPersonaListChange}
          versionInfo={newVersionInfoRef.current}
        />
      );
    }

    if (inspectorState.mode === 'inputDetails') {
      return (
        <NodeInputsEditor
          node={inspectorNode}
          readOnly={readOnly}
          nodes={inspectorNodes}
          onChange={onVariableChanged}
          onNodeStructureChange={onNodeStructureChange}
          onPersonaListChange={onPersonaListChange}
          producerNodeID={inspectorState.producerNode?.instanceID}
        />
      );
    }

    if (inspectorState.mode === 'nodeInit') {
      return (
        <NodeInitMenu
          node={initDataRef.current}
          menu={inspectorState.menu}
          versionInfo={newVersionInfoRef.current}
          onVariableChanged={onVariableChanged}
          onPersonaListChange={onPersonaListChange}
          gameTheme={gameTheme}
        />
      );
    }

    return null;
  };

  const inspectorHasActions = Boolean(inspectorState?.onConfirm);

  const renderEmptyWorkspace = (content) => (
    <div className="relative h-full w-full overflow-hidden" style={workspaceStyle}>
      <div className="absolute inset-0" style={overlayStyle} />
      {renderStatusOverlay(content)}
    </div>
  );

  const hasVersionSelected = Boolean(versionName);
  const versionLoaded = Boolean(versionInfo && newVersionInfoRef.current);
  const showGraph = hasVersionSelected && versionLoaded;
  const hasNodes = inspectorNodes.length > 0;
  const shouldShowTemplateChooser = showGraph && !hasNodes;
  const showSelectVersionMessage = !hasVersionSelected;
  const showLoadingMessage = hasVersionSelected && !versionLoaded;
  const editorStatusLabel = readOnly
    ? "Viewing as read-only"
    : dirtyEditor
      ? "Unsaved changes"
      : isUpdated
        ? "All changes saved"
        : "No changes yet";

  const closeInspectorPanel = (shouldCancel = false) => {
    if (shouldCancel && inspectorState?.onConfirm) {
      inspectorState.onConfirm(false);
    }
    setInspectorState(undefined);
    setInspectorPanelOpen(false);
  };

  const handleInspectorConfirm = () => {
    inspectorState?.onConfirm?.(true);
    setInspectorState(undefined);
    setInspectorPanelOpen(false);
  };

  const handleInspectorCancel = () => {
    inspectorState?.onConfirm?.(false);
    setInspectorState(undefined);
    setInspectorPanelOpen(false);
  };

  const handleOpenNodeSettingsMenu = (node) => {
    const nodeIndex = newVersionInfoRef.current.stateMachineDescription.nodes.findIndex((n) => n.instanceID == node.instanceID);
    setInspectorState({
      nodeIndex,
      mode: 'nodeDetails',
    });
    setInspectorPanelOpen(true);
  };

  const handleOpenInputSettingsMenu = (producerNode, consumerNode) => {
    const nodeIndex = newVersionInfoRef.current.stateMachineDescription.nodes.findIndex((n) => n.instanceID == consumerNode.instanceID);
    setInspectorState({
      nodeIndex,
      producerNode,
      mode: 'inputDetails',
    });
    setInspectorPanelOpen(true);
  };

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
    return renderEmptyWorkspace(<h1>Loading...</h1>);
  }

  if (!gamePermissions.includes("game_viewSource") && !gamePermissions.includes("game_edit")) {
    console.log("User is not authorized to view source or edit this game");
    return renderEmptyWorkspace(<h1>You are not authorized to edit this app.</h1>);
  }

  return (
    <div className="relative h-full w-full overflow-hidden" style={workspaceStyle}>
      <div className="absolute inset-0">
        {showGraph ? (
          <NodeGraphDisplay
            theme={gameTheme}
            versionInfo={newVersionInfoRef.current}
            onNodeClicked={handleOpenNodeSettingsMenu}
            onNodeStructureChange={onNodeStructureChange}
            onEdgeClicked={handleOpenInputSettingsMenu}
            onPersonaListChange={onPersonaListChange}
            readOnly={readOnly}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0" style={overlayStyle} />
      </div>

      {showSelectVersionMessage
        ? renderStatusOverlay(
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold">Select a version to begin</h1>
              <p className="text-sm text-slate-300">
                Use the Version menu to choose an existing version or create a new one.
              </p>
            </div>
          )
        : null}

      {showLoadingMessage ? renderStatusOverlay(<h1 className="text-2xl font-semibold">Loading...</h1>) : null}

      {showGraph ? (
        <div className="pointer-events-none absolute inset-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <FloatingPanel
            title="Version"
            icon={<GaugeCircle className="h-4 w-4 text-sky-300" />}
            positionClass="absolute top-6 left-6"
            open={infoPanelOpen}
            onOpenChange={setInfoPanelOpen}
            size="lg"
          >
            <div className="space-y-5">
              <div className={heroTextClass}>
                <p
                  className={heroSubtitleClass}
                  style={{ fontFamily: gameTheme?.fonts?.titleFont }}
                >
                  {game ? "PlayDay Game" : "Loading"}
                </p>
                <h1
                  className="text-3xl font-semibold uppercase tracking-[0.2em]"
                  style={{
                    fontFamily: gameTheme?.fonts?.titleFont,
                    color: gameTheme?.colors?.titleFontColor,
                    textShadow: gameTheme?.palette?.textSecondary
                      ? `0px 0px 15px ${gameTheme.palette.textSecondary}`
                      : "0px 0px 25px rgba(56,189,248,0.45)",
                  }}
                >
                  {game ? game.title : "Loading"}
                </h1>
                <p
                  className={heroVersionClass}
                  style={{ fontFamily: gameTheme?.fonts?.titleFont }}
                >
                  {versionInfo ? versionInfo.versionName : ""}
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Active Version
                </span>
                <VersionSelector
                  allowNewGameOption={true}
                  firstOptionUnselectable
                  dropdown={true}
                  chooseMostRecent={true}
                  showCreateButton={!readOnly}
                />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-200/80">
                {editorStatusLabel}
              </div>
            </div>
          </FloatingPanel>

          <FloatingPanel
            title="Actions"
            icon={<Workflow className="h-4 w-4 text-sky-300" />}
            positionClass="absolute top-6 right-6"
            open={actionsPanelOpen}
            onOpenChange={setActionsPanelOpen}
            size="md"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
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
                    <span title="Unsaved changes" className={unsavedBadgeClass}>
                      <AlertCircle className="h-5 w-5" />
                    </span>
                  ) : isUpdated ? (
                    <span title="Changes saved" className={savedBadgeClass}>
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/play/${game.url}?versionName=${versionInfo.versionName}`)}
                  className={buttonStyles.accent}
                >
                  <Play className="h-4 w-4" />
                  Play
                </button>
              </div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                {editorStatusLabel}
              </div>
              {dirtyEditor && settingsDiff ? (
                <div className="max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-100">
                  {settingsDiff}
                </div>
              ) : null}
            </div>
          </FloatingPanel>

          <FloatingPanel
            title="Node Library"
            icon={<Layers className="h-4 w-4 text-sky-300" />}
            positionClass="absolute bottom-6 left-6"
            open={libraryPanelOpen}
            onOpenChange={setLibraryPanelOpen}
            size="lg"
          >
            <NodeLibraryTree versionInfo={newVersionInfoRef.current} readOnly={readOnly} />
          </FloatingPanel>

          <FloatingPanel
            title="Version Settings"
            icon={<Settings2 className="h-4 w-4 text-sky-300" />}
            positionClass="absolute bottom-6 right-6"
            open={settingsPanelOpen}
            onOpenChange={setSettingsPanelOpen}
            size="md"
          >
            <div className="space-y-5">
              <SettingsMenu
                menu={globalOptions}
                rootObject={newVersionInfoRef.current}
                onChange={onPublishedSettingsChanged}
                key="settingsEditor"
                readOnly={readOnly}
              />
              <button
                type="button"
                onClick={handleDeleteVersion}
                disabled={readOnly}
                className={buttonStyles.danger}
              >
                Delete version
              </button>
            </div>
          </FloatingPanel>

          <FloatingPanel
            title={inspectorState?.mode === 'nodeInit' ? 'Initialize Node' : 'Inspector'}
            icon={<GaugeCircle className="h-4 w-4 text-sky-300" />}
            positionClass="absolute right-6 top-1/2 -translate-y-1/2"
            open={inspectorPanelOpen && Boolean(inspectorState)}
            onOpenChange={(open) => {
              if (!open) {
                closeInspectorPanel(true);
              } else {
                setInspectorPanelOpen(true);
              }
            }}
            size="lg"
            actions={
              inspectorState ? (
                <button
                  type="button"
                  onClick={() => closeInspectorPanel(true)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 transition hover:border-white/30 hover:text-white"
                  aria-label="Close inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
          >
            <div className="space-y-4">
              {renderInspectorContent()}
              {inspectorHasActions ? (
                <div className="flex justify-end gap-3">
                  <button type="button" className={buttonStyles.outline} onClick={handleInspectorCancel}>
                    Cancel
                  </button>
                  <button type="button" className={buttonStyles.primary} onClick={handleInspectorConfirm}>
                    Done
                  </button>
                </div>
              ) : null}
            </div>
          </FloatingPanel>
        </div>
      ) : null}

      {shouldShowTemplateChooser ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
          <div className="pointer-events-auto w-full max-w-5xl rounded-3xl border border-white/15 bg-slate-950/80 p-6 shadow-[0_45px_120px_-60px_rgba(56,189,248,0.65)] backdrop-blur">
            <TemplateChooser templateChosen={(template) => templateChosen(template)} />
          </div>
        </div>
      ) : null}
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
              className={dialogButtonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className={dialogButtonStyles.danger}
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
              className={dialogButtonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => doDiscardChanges()}
              className={dialogButtonStyles.danger}
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
            className={dialogButtonStyles.outline}
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
            className={dialogButtonStyles.outline}
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
            className={dialogButtonStyles.outline}
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
              className={dialogButtonStyles.outline}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onVariableChanged(newVersionInfoRef.current, "alwaysUseBuiltInKeys", true);
                setUseAppKeysDialogOpen(false);
              }}
              className={dialogButtonStyles.primary}
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
