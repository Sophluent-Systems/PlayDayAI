'use client';
import { useRouter } from "next/router";
import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { getInputsAndOutputsForNode, getMetadataForNodeType } from "@src/common/nodeMetadata";
import { analyticsReportEvent } from "@src/client/analytics";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { NodeInputsEditor } from "./nodeinputseditor";
import { NodeInitMenu } from "./nodeinitmenu";
import { FloatingPanel } from "./floatingpanel";
import { NodeLibraryTree } from "./nodelibrarytree";
import { CustomComponentEditor } from "./customcomponenteditor";
import { EditorStackProvider, useEditorStack } from "./editorStackContext";

function slugifyHandleValue(value) {
  if (value === undefined || value === null) {
    return "slot";
  }
  return value
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || "slot";
}

function makeUniqueHandle(handleSet, prefix, raw) {
  const baseSlug = raw ? slugifyHandleValue(raw) : slugifyHandleValue(prefix);
  const prefixSlug = slugifyHandleValue(prefix);
  let candidate = baseSlug || prefixSlug || "slot";
  if (candidate.length === 0) {
    candidate = prefix ? `${prefix}_slot` : "slot";
  }
  if (handleSet.has(candidate)) {
    const prefixed = prefixSlug ? `${prefixSlug}_${candidate}` : candidate;
    candidate = prefixed;
    let counter = 1;
    while (handleSet.has(candidate)) {
      candidate = `${prefixed}_${counter++}`;
    }
  }
  handleSet.add(candidate);
  return candidate;
}

function toggleSelectionSet(currentSet, id) {
  const next = new Set(currentSet);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function toSelectionSet(value) {
  if (value instanceof Set) {
    return value;
  }
  if (!value) {
    return new Set();
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  if (typeof value[Symbol.iterator] === "function") {
    return new Set(Array.from(value));
  }
  return new Set();
}

function deriveUniqueComponentName(versionInfo, selectedNodes) {
  const baseName = selectedNodes.length === 1
    ? `${selectedNodes[0].instanceName} Component`
    : "Custom Component";
  const existingNames = new Set(
    (versionInfo?.stateMachineDescription?.customComponents || []).map((definition) => definition.name)
  );
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  let suffix = 2;
  let candidate = `${baseName} ${suffix}`;
  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }
  return candidate;
}

function ensureUniqueInstanceName(baseName, nodes) {
  if (!baseName) {
    baseName = "Custom Component";
  }
  const existing = new Set((nodes || []).map((node) => node.instanceName));
  if (!existing.has(baseName)) {
    return baseName;
  }
  let suffix = 2;
  let candidate = `${baseName} ${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }
  return candidate;
}

function rebuildComponentDraftState(draft) {
  if (!draft || !Array.isArray(draft.nodes)) {
    return draft;
  }

  const nodes = draft.nodes;
  const nodesById = new Map(nodes.map((node) => [node.instanceID, node]));
  const metadataCache = new Map();

  const selectedInputs = toSelectionSet(draft.selectedInputs);
  const selectedOutputs = toSelectionSet(draft.selectedOutputs);
  const selectedEvents = toSelectionSet(draft.selectedEvents);

  const inputHandles = new Set();
  const outputHandles = new Set();
  const eventHandles = new Set();

  const existingInputs = new Map();
  (draft.availableInputs || []).forEach((entry) => {
    if (!entry?.nodeInstanceID || !nodesById.has(entry.nodeInstanceID)) {
      return;
    }
    const kind = entry.kind === "event" ? "event" : "variable";
    const keyName =
      kind === "event"
        ? entry.targetTrigger || entry.consumerVariable || entry.handle
        : entry.consumerVariable || entry.handle;
    if (!keyName) {
      return;
    }
    const key = `${kind}::${entry.nodeInstanceID}::${keyName}`;
    existingInputs.set(key, { ...entry });
    if (entry.handle) {
      inputHandles.add(entry.handle);
    }
  });

  const existingOutputs = new Map();
  (draft.availableOutputs || []).forEach((entry) => {
    if (!entry?.nodeInstanceID || !nodesById.has(entry.nodeInstanceID)) {
      return;
    }
    const keyName = entry.producerOutput || entry.handle;
    if (!keyName) {
      return;
    }
    const key = `variable::${entry.nodeInstanceID}::${keyName}`;
    existingOutputs.set(key, { ...entry });
    if (entry.handle) {
      outputHandles.add(entry.handle);
    }
  });

  const existingEvents = new Map();
  (draft.availableEvents || []).forEach((entry) => {
    if (!entry?.nodeInstanceID || !nodesById.has(entry.nodeInstanceID)) {
      return;
    }
    const keyName = entry.producerEvent || entry.handle;
    if (!keyName) {
      return;
    }
    const key = `event::${entry.nodeInstanceID}::${keyName}`;
    existingEvents.set(key, { ...entry });
    if (entry.handle) {
      eventHandles.add(entry.handle);
    }
  });

  const nextInputs = [];
  const nextOutputs = [];
  const nextEvents = [];
  const nextSelectedInputs = new Set();
  const nextSelectedOutputs = new Set();
  const nextSelectedEvents = new Set();

  const getMetadataPair = (node) => {
    if (!node) {
      return null;
    }
    if (metadataCache.has(node.instanceID)) {
      return metadataCache.get(node.instanceID);
    }
    try {
      const metadataClass = getMetadataForNodeType(node.nodeType);
      if (!metadataClass) {
        metadataCache.set(node.instanceID, null);
        return null;
      }
      const metadataInstance = new metadataClass({ fullNodeDescription: node });
      const pair = { metadataClass, metadataInstance };
      metadataCache.set(node.instanceID, pair);
      return pair;
    } catch (error) {
      metadataCache.set(node.instanceID, null);
      return null;
    }
  };

  nodes.forEach((node) => {
    const metadataPair = getMetadataPair(node) || {};
    const metadataInstance = metadataPair.metadataInstance;
    const metadataClass = metadataPair.metadataClass;

    let variableOverrides = {};
    if (metadataInstance?.getVariableOverrides) {
      variableOverrides = metadataInstance.getVariableOverrides() || {};
    } else if (metadataClass?.AllowedVariableOverrides) {
      variableOverrides = metadataClass.AllowedVariableOverrides || {};
    }

    const io = getInputsAndOutputsForNode(node) || {};

    (io.inputs || []).forEach((metaInput, index) => {
      const consumerVariable =
        (metaInput &&
          typeof metaInput === "object" &&
          (metaInput.value ?? metaInput.key ?? metaInput.id ?? metaInput.name)) ||
        (typeof metaInput === "string" ? metaInput : `input-${index}`);
      const label = metaInput?.label || consumerVariable;
      const key = `variable::${node.instanceID}::${consumerVariable}`;
      const overrideMeta = variableOverrides?.[consumerVariable] || {};
      let entry = existingInputs.get(key);
      if (entry) {
        entry = {
          ...entry,
          nodeInstanceID: node.instanceID,
          consumerVariable,
          label: `${node.instanceName} - ${label}`,
          mediaType: overrideMeta.mediaType || entry.mediaType || "text",
        };
        nextInputs.push(entry);
        if (entry.handle) {
          inputHandles.add(entry.handle);
        }
        if (entry.id && selectedInputs.has(entry.id)) {
          nextSelectedInputs.add(entry.id);
        }
        existingInputs.delete(key);
      } else {
        const handle = makeUniqueHandle(inputHandles, "input", consumerVariable);
        const id = `variable::${node.instanceID}::${consumerVariable}`;
        entry = {
          id,
          kind: "variable",
          handle,
          label: `${node.instanceName} - ${label}`,
          nodeInstanceID: node.instanceID,
          consumerVariable,
          mediaType: overrideMeta.mediaType || "text",
        };
        nextInputs.push(entry);
      }
    });

    const triggers = Array.isArray(metadataClass?.triggers)
      ? metadataClass.triggers
      : [];

    triggers.forEach((triggerName, index) => {
      const triggerKey =
        typeof triggerName === "string"
          ? triggerName
          : (triggerName &&
              (triggerName.value ?? triggerName.key ?? triggerName.id ?? triggerName.name)) ||
            `trigger-${index}`;
      const label =
        (triggerName && typeof triggerName === "object" && triggerName.label) || triggerKey;
      const key = `event::${node.instanceID}::${triggerKey}`;
      let entry = existingInputs.get(key);
      if (entry) {
        entry = {
          ...entry,
          nodeInstanceID: node.instanceID,
          targetTrigger: entry.targetTrigger || triggerKey,
          label: entry.label || `${node.instanceName} - ${label}`,
          kind: "event",
        };
        if (!entry.handle) {
          entry.handle = makeUniqueHandle(inputHandles, "trigger", triggerKey);
        } else {
          inputHandles.add(entry.handle);
        }
        nextInputs.push(entry);
        if (entry.id && selectedInputs.has(entry.id)) {
          nextSelectedInputs.add(entry.id);
        }
        existingInputs.delete(key);
      } else {
        const handle = makeUniqueHandle(inputHandles, "trigger", triggerKey);
        const id = `event::${node.instanceID}::${triggerKey}`;
        entry = {
          id,
          kind: "event",
          handle,
          label: `${node.instanceName} - ${label}`,
          nodeInstanceID: node.instanceID,
          targetTrigger: triggerKey,
        };
        nextInputs.push(entry);
      }
    });

    (io.outputs || []).forEach((metaOutput, index) => {
      let producerOutput;
      let outputLabel;
      let outputMediaType;
      if (metaOutput && typeof metaOutput === "object") {
        producerOutput =
          metaOutput.value ??
          metaOutput.key ??
          metaOutput.id ??
          metaOutput.name ??
          `output-${index}`;
        outputLabel = metaOutput.label ?? producerOutput;
        outputMediaType = metaOutput.mediaType;
      } else if (typeof metaOutput === "string") {
        producerOutput = metaOutput;
        outputLabel = metaOutput;
        outputMediaType = undefined;
      } else {
        producerOutput = `output-${index}`;
        outputLabel = producerOutput;
        outputMediaType = undefined;
      }
      const key = `variable::${node.instanceID}::${producerOutput}`;
      let entry = existingOutputs.get(key);
      if (entry) {
        entry = {
          ...entry,
          nodeInstanceID: node.instanceID,
          producerOutput,
          label: `${node.instanceName} - ${outputLabel}`,
          mediaType: outputMediaType || entry.mediaType,
        };
        if (!entry.handle) {
          entry.handle = makeUniqueHandle(outputHandles, "output", producerOutput);
        } else {
          outputHandles.add(entry.handle);
        }
        nextOutputs.push(entry);
        if (entry.id && selectedOutputs.has(entry.id)) {
          nextSelectedOutputs.add(entry.id);
        }
        existingOutputs.delete(key);
      } else {
        const handle = makeUniqueHandle(outputHandles, "output", producerOutput);
        const id = `variable::${node.instanceID}::${producerOutput}`;
        entry = {
          id,
          kind: "variable",
          handle,
          label: `${node.instanceName} - ${outputLabel}`,
          nodeInstanceID: node.instanceID,
          producerOutput,
          mediaType: outputMediaType,
          targets: [],
        };
        nextOutputs.push(entry);
      }
    });

    const eventEntries =
      (metadataInstance && metadataInstance.getEvents?.()) ||
      metadataClass?.events ||
      [];

    eventEntries.forEach((eventEntry, index) => {
      const producerEvent =
        (eventEntry &&
          typeof eventEntry === "object" &&
          (eventEntry.value ?? eventEntry.key ?? eventEntry.id ?? eventEntry.name)) ||
        (typeof eventEntry === "string" ? eventEntry : `event-${index}`);
      const eventLabel =
        (eventEntry && typeof eventEntry === "object" && eventEntry.label) || producerEvent;
      const key = `event::${node.instanceID}::${producerEvent}`;
      let entry = existingEvents.get(key);
      if (entry) {
        entry = {
          ...entry,
          nodeInstanceID: node.instanceID,
          producerEvent,
          label: `${node.instanceName} - ${eventLabel}`,
        };
        if (!entry.handle) {
          entry.handle = makeUniqueHandle(eventHandles, "event", producerEvent);
        } else {
          eventHandles.add(entry.handle);
        }
        nextEvents.push(entry);
        if (entry.id && selectedEvents.has(entry.id)) {
          nextSelectedEvents.add(entry.id);
        }
        existingEvents.delete(key);
      } else {
        const handle = makeUniqueHandle(eventHandles, "event", producerEvent);
        const id = `event::${node.instanceID}::${producerEvent}`;
        entry = {
          id,
          kind: "event",
          handle,
          label: `${node.instanceName} - ${eventLabel}`,
          nodeInstanceID: node.instanceID,
          producerEvent,
          targets: [],
        };
        nextEvents.push(entry);
      }
    });
  });

  existingInputs.forEach((entry) => {
    nextInputs.push(entry);
    if (entry.handle) {
      inputHandles.add(entry.handle);
    }
    if (entry.id && selectedInputs.has(entry.id)) {
      nextSelectedInputs.add(entry.id);
    }
  });

  existingOutputs.forEach((entry) => {
    nextOutputs.push(entry);
    if (entry.handle) {
      outputHandles.add(entry.handle);
    }
    if (entry.id && selectedOutputs.has(entry.id)) {
      nextSelectedOutputs.add(entry.id);
    }
  });

  existingEvents.forEach((entry) => {
    nextEvents.push(entry);
    if (entry.handle) {
      eventHandles.add(entry.handle);
    }
    if (entry.id && selectedEvents.has(entry.id)) {
      nextSelectedEvents.add(entry.id);
    }
  });

  nextInputs.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  nextOutputs.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  nextEvents.sort((a, b) => (a.label || "").localeCompare(b.label || ""));

  const validInputIDs = new Set(nextInputs.map((entry) => entry.id));
  const validOutputIDs = new Set(nextOutputs.map((entry) => entry.id));
  const validEventIDs = new Set(nextEvents.map((entry) => entry.id));

  const cleanedSelectedInputs = new Set(
    [...selectedInputs, ...nextSelectedInputs].filter((id) => validInputIDs.has(id))
  );
  const cleanedSelectedOutputs = new Set(
    [...selectedOutputs, ...nextSelectedOutputs].filter((id) => validOutputIDs.has(id))
  );
  const cleanedSelectedEvents = new Set(
    [...selectedEvents, ...nextSelectedEvents].filter((id) => validEventIDs.has(id))
  );

  return {
    ...draft,
    availableInputs: nextInputs,
    availableOutputs: nextOutputs,
    availableEvents: nextEvents,
    selectedInputs: cleanedSelectedInputs,
    selectedOutputs: cleanedSelectedOutputs,
    selectedEvents: cleanedSelectedEvents,
  };
}

function resolvePortDirection(port, fallback = "input") {
  const annotations = port?.annotations || {};
  const annotatedDirection = annotations.direction;
  if (annotatedDirection === "input" || annotatedDirection === "output") {
    return annotatedDirection;
  }
  if (
    annotations.producerInstanceID ||
    annotations.producerOutput ||
    annotations.producerEvent
  ) {
    return "input";
  }
  if (Array.isArray(annotations.targets) && annotations.targets.length > 0) {
    return "output";
  }
  return fallback;
}

const isInputVariablePort = (port) => resolvePortDirection(port, "input") === "input";
const isOutputVariablePort = (port) => resolvePortDirection(port, "output") === "output";
const isInputEventPort = (port) => resolvePortDirection(port, "output") === "input";
const isOutputEventPort = (port) => resolvePortDirection(port, "output") === "output";

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

function toSelectionSetLike(value) {
  if (value instanceof Set) {
    return new Set(value);
  }
  if (!value) {
    return new Set();
  }
  if (Array.isArray(value)) {
    return new Set(value);
  }
  if (typeof value === "object") {
    return new Set(Object.values(value));
  }
  return new Set();
}

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

function VersionEditorComponent(props) {
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

  const {
    activeFrame: activeEditorFrame,
    pushFrame: pushEditorFrame,
    popFrame: popEditorFrame,
    updateFrame: updateEditorFrame,
  } = useEditorStack();

  const activeCustomFrame =
    activeEditorFrame && activeEditorFrame.kind === 'customComponent'
      ? activeEditorFrame
      : null;

  const componentEditorState = activeCustomFrame?.draft || null;

  const updateComponentEditorDraft = useCallback(
    (updater) => {
      if (!activeCustomFrame) {
        return;
      }
      updateEditorFrame(activeCustomFrame.id, (frame) => {
        const previousDraft = frame.draft;
        const nextDraft =
          typeof updater === 'function' ? updater(previousDraft) : updater;
        if (nextDraft === undefined || nextDraft === previousDraft) {
          return null;
        }
        return { draft: nextDraft };
      });
    },
    [activeCustomFrame, updateEditorFrame],
  );

  const closeActiveComponentEditor = useCallback(() => {
    if (activeCustomFrame) {
      popEditorFrame(activeCustomFrame.id);
    }
  }, [activeCustomFrame, popEditorFrame]);

  const openComponentEditor = useCallback(
    (draft, metadata = {}) => {
      if (!draft) {
        return;
      }
      pushEditorFrame({
        kind: 'customComponent',
        draft,
        metadata,
        parentId: activeEditorFrame ? activeEditorFrame.id : null,
      });
    },
    [activeEditorFrame, pushEditorFrame],
  );

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

  const buildComponentDraft = useCallback((instanceIDs) => {
    const versionInfoCurrent = newVersionInfoRef.current;
    if (!versionInfoCurrent) {
      return null;
    }
    const graphNodes = versionInfoCurrent?.stateMachineDescription?.nodes ?? [];
    if (!Array.isArray(instanceIDs) || instanceIDs.length === 0 || graphNodes.length === 0) {
      return null;
    }
    const nodeMap = new Map(graphNodes.map((nodeDesc) => [nodeDesc.instanceID, nodeDesc]));
    const selectedSet = new Set(instanceIDs.filter((id) => nodeMap.has(id)));
    if (selectedSet.size === 0) {
      return null;
    }
    const selectedNodes = graphNodes.filter((nodeDesc) => selectedSet.has(nodeDesc.instanceID));
    const handleSet = new Set();
    const availableInputs = [];
    const availableOutputs = [];
    const availableEvents = [];
    const defaultSelectedInputs = new Set();
    const defaultSelectedOutputs = new Set();
    const defaultSelectedEvents = new Set();
    const metadataCache = new Map();

    const safeGetOverrides = (nodeDesc) => {
      if (!nodeDesc) {
        return {};
      }
      if (metadataCache.has(nodeDesc.instanceID)) {
        return metadataCache.get(nodeDesc.instanceID);
      }
      try {
        const metadataClass = getMetadataForNodeType(nodeDesc.nodeType);
        if (!metadataClass) {
          metadataCache.set(nodeDesc.instanceID, {});
          return {};
        }
        const metadataInstance = new metadataClass({ fullNodeDescription: nodeDesc });
        const overrides = metadataInstance.getVariableOverrides
          ? metadataInstance.getVariableOverrides()
          : metadataClass.AllowedVariableOverrides || {};
        metadataCache.set(nodeDesc.instanceID, overrides || {});
        return overrides || {};
      } catch (error) {
        console.warn("Failed to resolve metadata for node", nodeDesc.instanceID, error);
        metadataCache.set(nodeDesc.instanceID, {});
        return {};
      }
    };

    const safeGetIO = (nodeDesc) => {
      try {
        return getInputsAndOutputsForNode(nodeDesc);
      } catch (error) {
        console.warn("Failed to compute IO for node", nodeDesc.instanceID, error);
        return { inputs: [], outputs: [], events: [] };
      }
    };

    selectedNodes.forEach((nodeDesc) => {
      const inputList = Array.isArray(nodeDesc.inputs) ? nodeDesc.inputs : [];
      const variableOverrides = safeGetOverrides(nodeDesc);
      inputList.forEach((input) => {
        if (selectedSet.has(input.producerInstanceID)) {
          return;
        }
        (input.variables || []).forEach((variable) => {
          const key = `${nodeDesc.instanceID}::${variable.consumerVariable}::${input.producerInstanceID}`;
          const handle = makeUniqueHandle(handleSet, "input", variable.consumerVariable);
          const entry = {
            id: key,
            kind: "variable",
            handle,
            label: `${nodeDesc.instanceName} - ${variable.consumerVariable}`,
            nodeInstanceID: nodeDesc.instanceID,
            producerInstanceID: input.producerInstanceID,
            consumerVariable: variable.consumerVariable,
            producerOutput: variable.producerOutput,
            mediaType: variableOverrides?.[variable.consumerVariable]?.mediaType || "text",
          };
          availableInputs.push(entry);
          defaultSelectedInputs.add(entry.id);
        });
        (input.triggers || []).forEach((trigger) => {
          const key = `${nodeDesc.instanceID}::${trigger.targetTrigger}::${input.producerInstanceID}`;
          const handle = makeUniqueHandle(handleSet, "trigger", trigger.targetTrigger);
          const entry = {
            id: key,
            kind: "event",
            handle,
            label: `${nodeDesc.instanceName} - ${trigger.targetTrigger}`,
            nodeInstanceID: nodeDesc.instanceID,
            producerInstanceID: input.producerInstanceID,
            targetTrigger: trigger.targetTrigger,
            producerEvent: trigger.producerEvent,
          };
          availableInputs.push(entry);
          defaultSelectedInputs.add(entry.id);
        });
      });
    });

    graphNodes.forEach((nodeDesc) => {
      if (selectedSet.has(nodeDesc.instanceID)) {
        return;
      }
      const inputList = Array.isArray(nodeDesc.inputs) ? nodeDesc.inputs : [];
      inputList.forEach((input) => {
        if (!selectedSet.has(input.producerInstanceID)) {
          return;
        }
        const producerNode = nodeMap.get(input.producerInstanceID);
        if (!producerNode) {
          return;
        }
        const io = safeGetIO(producerNode);
        (input.variables || []).forEach((variable) => {
          const key = `${input.producerInstanceID}::${variable.producerOutput}`;
          let entry = availableOutputs.find((item) => item.id === key);
          if (!entry) {
            const outputMeta = (io.outputs || []).find((item) => item.value === variable.producerOutput);
            entry = {
              id: key,
              kind: "variable",
              handle: makeUniqueHandle(handleSet, "output", variable.producerOutput),
              label: `${producerNode.instanceName} - ${(outputMeta?.label || variable.producerOutput)}`,
              nodeInstanceID: input.producerInstanceID,
              producerOutput: variable.producerOutput,
              mediaType: outputMeta?.mediaType || "text",
              targets: [],
            };
            availableOutputs.push(entry);
            defaultSelectedOutputs.add(entry.id);
          }
          defaultSelectedOutputs.add(entry.id);
          entry.targets.push({
            nodeInstanceID: nodeDesc.instanceID,
            consumerVariable: variable.consumerVariable,
          });
        });
        (input.triggers || []).forEach((trigger) => {
          const key = `${input.producerInstanceID}::${trigger.producerEvent}`;
          let entry = availableEvents.find((item) => item.id === key);
          if (!entry) {
            const eventMeta = (io.events || []).find((item) => item.value === trigger.producerEvent);
            entry = {
              id: key,
              kind: "event",
              handle: makeUniqueHandle(handleSet, "event", trigger.producerEvent),
              label: `${producerNode.instanceName} - ${(eventMeta?.label || trigger.producerEvent)}`,
              nodeInstanceID: input.producerInstanceID,
              producerEvent: trigger.producerEvent,
              targets: [],
            };
            availableEvents.push(entry);
            defaultSelectedEvents.add(entry.id);
          }
          defaultSelectedEvents.add(entry.id);
          entry.targets.push({
            nodeInstanceID: nodeDesc.instanceID,
            targetTrigger: trigger.targetTrigger,
          });
        });
    });
  });

    selectedNodes.forEach((nodeDesc) => {
      const io = getInputsAndOutputsForNode(nodeDesc) || {};
      const variableOverrides = safeGetOverrides(nodeDesc);

      (io.inputs || []).forEach((metaInput, index) => {
        const consumerVariable = metaInput.value || `input-${index}`;
        const existing = availableInputs.find(
          (entry) =>
            entry.nodeInstanceID === nodeDesc.instanceID &&
            entry.consumerVariable === consumerVariable
        );
        if (existing) {
          return;
        }
        const handle = makeUniqueHandle(handleSet, "input", consumerVariable);
        const overrideMeta = variableOverrides?.[consumerVariable] || {};
        availableInputs.push({
          id: handle,
          kind: "variable",
          handle,
          label: `${nodeDesc.instanceName} - ${(metaInput.label || consumerVariable)}`,
          nodeInstanceID: nodeDesc.instanceID,
          consumerVariable,
          mediaType: overrideMeta.mediaType || "text",
        });
      });

      (io.outputs || []).forEach((metaOutput, index) => {
        let producerOutput;
        let outputLabel;
        let outputMediaType;
        if (metaOutput && typeof metaOutput === "object") {
          producerOutput =
            metaOutput.value ??
            metaOutput.key ??
            metaOutput.id ??
            metaOutput.name ??
            `output-${index}`;
          outputLabel = metaOutput.label ?? producerOutput;
          outputMediaType = metaOutput.mediaType;
        } else if (typeof metaOutput === "string") {
          producerOutput = metaOutput;
          outputLabel = metaOutput;
          outputMediaType = undefined;
        } else {
          producerOutput = `output-${index}`;
          outputLabel = producerOutput;
          outputMediaType = undefined;
        }
        const existing = availableOutputs.find(
          (entry) =>
            entry.nodeInstanceID === nodeDesc.instanceID &&
            entry.producerOutput === producerOutput
        );
        if (existing) {
          return;
        }
        const handle = makeUniqueHandle(handleSet, "output", producerOutput);
        availableOutputs.push({
          id: handle,
          kind: "variable",
          handle,
          label: `${nodeDesc.instanceName} - ${(outputLabel || producerOutput)}`,
          nodeInstanceID: nodeDesc.instanceID,
          producerOutput,
          mediaType: outputMediaType || "text",
          targets: [],
        });
      });

      (io.events || []).forEach((metaEvent, index) => {
        let producerEvent;
        let eventLabel;
        if (metaEvent && typeof metaEvent === "object") {
          producerEvent =
            metaEvent.value ??
            metaEvent.key ??
            metaEvent.id ??
            metaEvent.name ??
            `event-${index}`;
          eventLabel = metaEvent.label ?? producerEvent;
        } else if (typeof metaEvent === "string") {
          producerEvent = metaEvent;
          eventLabel = metaEvent;
        } else {
          producerEvent = `event-${index}`;
          eventLabel = producerEvent;
        }
        const existing = availableEvents.find(
          (entry) =>
            entry.nodeInstanceID === nodeDesc.instanceID &&
            entry.producerEvent === producerEvent
        );
        if (existing) {
          return;
        }
        const handle = makeUniqueHandle(handleSet, "event", producerEvent);
        availableEvents.push({
          id: handle,
          kind: "event",
          handle,
          label: `${nodeDesc.instanceName} - ${(eventLabel || producerEvent)}`,
          nodeInstanceID: nodeDesc.instanceID,
          producerEvent,
          targets: [],
        });
      });
    });

    const initialSelectionIDs = Array.from(selectedSet);
    const draft = {
      id: uuidv4(),
      name: deriveUniqueComponentName(versionInfoCurrent, selectedNodes),
      description: "",
      selectedNodeIDs: [...initialSelectionIDs],
      nodes: selectedNodes.map((nodeDesc) => JSON.parse(JSON.stringify(nodeDesc))),
      availableInputs,
      availableOutputs,
      availableEvents,
      selectedInputs:
        defaultSelectedInputs.size > 0
          ? new Set(defaultSelectedInputs)
          : new Set(availableInputs.map((entry) => entry.id)),
      selectedOutputs:
        defaultSelectedOutputs.size > 0
          ? new Set(defaultSelectedOutputs)
          : new Set(),
      selectedEvents:
        defaultSelectedEvents.size > 0
          ? new Set(defaultSelectedEvents)
          : new Set(),
      library: "personal",
      metadata: {
        originalNodeInstanceIDs: [...initialSelectionIDs],
      },
      mode: "createFromSelection",
    };
    return draft;
  }, []);

  const buildComponentDraftFromDefinition = useCallback((definition) => {
    if (!definition) {
      return null;
    }
    const definitionNodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    const nodes = definitionNodes.map((node) => JSON.parse(JSON.stringify(node)));
    const selectedNodeIDs = nodes.map((node) => node.instanceID);
    const selectedSet = new Set(selectedNodeIDs);
    const handleSet = new Set();
    const availableInputs = [];
    const availableOutputs = [];
    const availableEvents = [];

    const exposedInputs = Array.isArray(definition.exposedInputs) ? definition.exposedInputs : [];
    const exposedOutputs = Array.isArray(definition.exposedOutputs) ? definition.exposedOutputs : [];
    const exposedEvents = Array.isArray(definition.exposedEvents) ? definition.exposedEvents : [];

    const addHandle = (handle) => {
      if (handle) {
        handleSet.add(handle);
      }
    };

    exposedInputs.forEach((port) => addHandle(port.handle));
    exposedOutputs.forEach((port) => addHandle(port.handle));
    exposedEvents.forEach((port) => addHandle(port.handle));

    const metadataCache = new Map();

    const safeGetOverrides = (nodeDesc) => {
      if (!nodeDesc) {
        return {};
      }
      if (metadataCache.has(nodeDesc.instanceID)) {
        return metadataCache.get(nodeDesc.instanceID);
      }
      try {
        const metadataClass = getMetadataForNodeType(nodeDesc.nodeType);
        if (!metadataClass) {
          metadataCache.set(nodeDesc.instanceID, {});
          return {};
        }
        const metadataInstance = new metadataClass({ fullNodeDescription: nodeDesc });
        const overrides = metadataInstance.getVariableOverrides
          ? metadataInstance.getVariableOverrides()
          : metadataClass.AllowedVariableOverrides || {};
        metadataCache.set(nodeDesc.instanceID, overrides || {});
        return overrides || {};
      } catch (error) {
        console.warn("Failed to resolve metadata for node", nodeDesc.instanceID, error);
        metadataCache.set(nodeDesc.instanceID, {});
        return {};
      }
    };

    const safeGetIO = (nodeDesc) => {
      try {
        return getInputsAndOutputsForNode(nodeDesc);
      } catch (error) {
        console.warn("Failed to compute IO for node", nodeDesc.instanceID, error);
        return { inputs: [], outputs: [], events: [] };
      }
    };

    nodes.forEach((nodeDesc) => {
      const variableOverrides = safeGetOverrides(nodeDesc);
      const inputList = Array.isArray(nodeDesc.inputs) ? nodeDesc.inputs : [];
      inputList.forEach((input) => {
        if (selectedSet.has(input.producerInstanceID)) {
          return;
        }
        (input.variables || []).forEach((variable) => {
          const key = `${nodeDesc.instanceID}::${variable.consumerVariable}::${input.producerInstanceID ?? "null"}::${variable.producerOutput ?? "null"}`;
          const existingPort = exposedInputs.find(
            (port) =>
              port.nodeInstanceID === nodeDesc.instanceID &&
              port.portName === variable.consumerVariable &&
              port.annotations?.producerInstanceID === input.producerInstanceID &&
              port.annotations?.producerOutput === variable.producerOutput
          );
          const handle = existingPort?.handle || makeUniqueHandle(handleSet, "input", variable.consumerVariable);
          availableInputs.push({
            id: key,
            kind: "variable",
            handle,
            label: `${nodeDesc.instanceName} - ${variable.consumerVariable}`,
            nodeInstanceID: nodeDesc.instanceID,
            producerInstanceID: input.producerInstanceID,
            consumerVariable: variable.consumerVariable,
            producerOutput: variable.producerOutput,
            mediaType: variableOverrides?.[variable.consumerVariable]?.mediaType || "text",
          });
        });
        (input.triggers || []).forEach((trigger) => {
          const key = `${nodeDesc.instanceID}::${trigger.targetTrigger}::${input.producerInstanceID ?? "null"}::${trigger.producerEvent ?? "null"}`;
          const existingPort = exposedEvents.find(
            (port) =>
              port.nodeInstanceID === nodeDesc.instanceID &&
              port.portName === trigger.targetTrigger &&
              isInputEventPort(port) &&
              port.annotations?.producerInstanceID === input.producerInstanceID &&
              port.annotations?.producerEvent === trigger.producerEvent
          );
          const handle = existingPort?.handle || makeUniqueHandle(handleSet, "trigger", trigger.targetTrigger);
          availableInputs.push({
            id: key,
            kind: "event",
            handle,
            label: `${nodeDesc.instanceName} - ${trigger.targetTrigger}`,
            nodeInstanceID: nodeDesc.instanceID,
            producerInstanceID: input.producerInstanceID,
            targetTrigger: trigger.targetTrigger,
            producerEvent: trigger.producerEvent,
          });
        });
      });
    });

    nodes.forEach((nodeDesc) => {
      const io = safeGetIO(nodeDesc) || {};
      const variableOverrides = safeGetOverrides(nodeDesc);

      (io.inputs || []).forEach((metaInput, index) => {
        const consumerVariable = metaInput.value || `input-${index}`;
        const alreadyPresent = availableInputs.some(
          (entry) =>
            entry.nodeInstanceID === nodeDesc.instanceID &&
            entry.consumerVariable === consumerVariable
        );
        if (alreadyPresent) {
          return;
        }
        const existingPort = exposedInputs.find(
          (port) =>
            port.nodeInstanceID === nodeDesc.instanceID &&
            port.portName === consumerVariable
        );
        const handle = existingPort?.handle || makeUniqueHandle(handleSet, "input", consumerVariable);
        availableInputs.push({
          id: `${nodeDesc.instanceID}::${consumerVariable}`,
          kind: "variable",
          handle,
          label: `${nodeDesc.instanceName} - ${(metaInput.label || consumerVariable)}`,
          nodeInstanceID: nodeDesc.instanceID,
          consumerVariable,
          mediaType: variableOverrides?.[consumerVariable]?.mediaType || "text",
        });
      });

      (io.outputs || []).forEach((metaOutput, index) => {
        let producerOutput;
        let outputLabel;
        let outputMediaType;
        if (metaOutput && typeof metaOutput === "object") {
          producerOutput =
            metaOutput.value ??
            metaOutput.key ??
            metaOutput.id ??
            metaOutput.name ??
            `output-${index}`;
          outputLabel = metaOutput.label ?? producerOutput;
          outputMediaType = metaOutput.mediaType;
        } else if (typeof metaOutput === "string") {
          producerOutput = metaOutput;
          outputLabel = metaOutput;
          outputMediaType = undefined;
        } else {
          producerOutput = `output-${index}`;
          outputLabel = producerOutput;
          outputMediaType = undefined;
        }
        const id = `${nodeDesc.instanceID}::${producerOutput}`;
        const existingPort = exposedOutputs.find(
          (port) =>
            port.nodeInstanceID === nodeDesc.instanceID &&
            port.portName === producerOutput
        );
        const handle = existingPort?.handle || makeUniqueHandle(handleSet, "output", producerOutput);
        availableOutputs.push({
          id,
          kind: "variable",
          handle,
          label: `${nodeDesc.instanceName} - ${(outputLabel || producerOutput)}`,
          nodeInstanceID: nodeDesc.instanceID,
          producerOutput,
          mediaType: outputMediaType || "text",
          targets: existingPort?.annotations?.targets
            ? JSON.parse(JSON.stringify(existingPort.annotations.targets))
            : [],
        });
      });

      (io.events || []).forEach((metaEvent, index) => {
        let producerEvent;
        let eventLabel;
        if (metaEvent && typeof metaEvent === "object") {
          producerEvent =
            metaEvent.value ??
            metaEvent.key ??
            metaEvent.id ??
            metaEvent.name ??
            `event-${index}`;
          eventLabel = metaEvent.label ?? producerEvent;
        } else if (typeof metaEvent === "string") {
          producerEvent = metaEvent;
          eventLabel = metaEvent;
        } else {
          producerEvent = `event-${index}`;
          eventLabel = producerEvent;
        }
        const id = `${nodeDesc.instanceID}::${producerEvent}`;
        const existingPort = exposedEvents.find(
          (port) =>
            port.nodeInstanceID === nodeDesc.instanceID &&
            port.portName === producerEvent &&
            isOutputEventPort(port)
        );
        const handle = existingPort?.handle || makeUniqueHandle(handleSet, "event", producerEvent);
        availableEvents.push({
          id,
          kind: "event",
          handle,
          label: `${nodeDesc.instanceName} - ${(eventLabel || producerEvent)}`,
          nodeInstanceID: nodeDesc.instanceID,
          producerEvent,
          targets: existingPort?.annotations?.targets
            ? JSON.parse(JSON.stringify(existingPort.annotations.targets))
            : [],
        });
      });
    });

    const selectedInputs = new Set();
    exposedInputs.forEach((port) => {
      if (!isInputVariablePort(port)) {
        return;
      }
      const match = availableInputs.find((entry) => {
        if (entry.nodeInstanceID !== port.nodeInstanceID) {
          return false;
        }
        if (entry.kind === "variable") {
          return entry.consumerVariable === port.portName;
        }
        if (entry.kind === "event") {
          return entry.targetTrigger === port.portName;
        }
        return false;
      });
      if (match) {
        match.handle = port.handle;
        if (match.kind === "variable") {
          match.producerInstanceID =
            port.annotations?.producerInstanceID ?? match.producerInstanceID;
          match.producerOutput =
            port.annotations?.producerOutput ?? match.producerOutput;
        } else {
          match.producerInstanceID =
            port.annotations?.producerInstanceID ?? match.producerInstanceID;
          match.producerEvent = port.annotations?.producerEvent ?? match.producerEvent;
        }
        selectedInputs.add(match.id);
      } else {
        const id = `${port.nodeInstanceID}::${port.portName}::${port.handle}`;
        const entry = {
          id,
          kind: port.portType === "event" ? "event" : "variable",
          handle: port.handle,
          label: `${port.nodeInstanceID} - ${port.portName}`,
          nodeInstanceID: port.nodeInstanceID,
        };
        if (entry.kind === "variable") {
          entry.consumerVariable = port.portName;
          entry.mediaType = port.mediaType || "text";
          entry.producerInstanceID = port.annotations?.producerInstanceID || null;
          entry.producerOutput = port.annotations?.producerOutput || null;
        } else {
          entry.targetTrigger = port.portName;
          entry.producerInstanceID = port.annotations?.producerInstanceID || null;
          entry.producerEvent = port.annotations?.producerEvent || null;
        }
        availableInputs.push(entry);
        selectedInputs.add(entry.id);
      }
    });

    const selectedOutputs = new Set();
    exposedOutputs.forEach((port) => {
      if (!isOutputVariablePort(port)) {
        return;
      }
      const match = availableOutputs.find(
        (entry) =>
          entry.nodeInstanceID === port.nodeInstanceID &&
          entry.producerOutput === port.portName
      );
      if (match) {
        match.handle = port.handle;
        match.targets = JSON.parse(JSON.stringify(port.annotations?.targets || match.targets || []));
        match.mediaType = port.mediaType || match.mediaType;
        selectedOutputs.add(match.id);
      } else {
        const id = `${port.nodeInstanceID}::${port.portName}::${port.handle}`;
        const entry = {
          id,
          kind: "variable",
          handle: port.handle,
          label: `${port.nodeInstanceID} - ${port.portName}`,
          nodeInstanceID: port.nodeInstanceID,
          producerOutput: port.portName,
          mediaType: port.mediaType || "text",
          targets: JSON.parse(JSON.stringify(port.annotations?.targets || [])),
        };
        availableOutputs.push(entry);
        selectedOutputs.add(entry.id);
      }
    });

    const selectedEvents = new Set();
    exposedEvents.forEach((port) => {
      if (!isOutputEventPort(port)) {
        return;
      }
      const match = availableEvents.find(
        (entry) =>
          entry.nodeInstanceID === port.nodeInstanceID &&
          entry.producerEvent === port.portName
      );
      if (match) {
        match.handle = port.handle;
        match.targets = JSON.parse(JSON.stringify(port.annotations?.targets || match.targets || []));
        selectedEvents.add(match.id);
      } else {
        const id = `${port.nodeInstanceID}::${port.portName}::${port.handle}`;
        const entry = {
          id,
          kind: "event",
          handle: port.handle,
          label: `${port.nodeInstanceID} - ${port.portName}`,
          nodeInstanceID: port.nodeInstanceID,
          producerEvent: port.portName,
          targets: JSON.parse(JSON.stringify(port.annotations?.targets || [])),
        };
        availableEvents.push(entry);
        selectedEvents.add(entry.id);
      }
    });

    return {
      id: definition.componentID || uuidv4(),
      name: definition.name || "Custom Component",
      description: definition.description || "",
      selectedNodeIDs: selectedNodeIDs.length > 0 ? selectedNodeIDs : [...(definition.metadata?.selectedNodeInstanceIDs || [])],
      nodes,
      availableInputs,
      availableOutputs,
      availableEvents,
      selectedInputs,
      selectedOutputs,
      selectedEvents,
      library: definition.library || "personal",
      componentID: definition.componentID,
      version: definition.version || { major: 0, minor: 1, patch: 0 },
      metadata: definition.metadata || {},
      mode: "editExisting",
    };
  }, []);

  const startComponentEditor = useCallback(
    (instanceIDs, metadata = {}) => {
      const draft = buildComponentDraft(instanceIDs);
      if (draft) {
        openComponentEditor(draft, metadata);
        setInspectorPanelOpen(false);
      }
    },
    [buildComponentDraft, openComponentEditor],
  );

  const handleCancelComponentEditor = useCallback(() => {
    closeActiveComponentEditor();
  }, [closeActiveComponentEditor]);

  const handleComponentNameChange = useCallback(
    (value) => {
      updateComponentEditorDraft((previous) => {
        if (!previous || previous.name === value) {
          return previous;
        }
        return { ...previous, name: value };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleComponentDescriptionChange = useCallback(
    (value) => {
      updateComponentEditorDraft((previous) => {
        if (!previous || previous.description === value) {
          return previous;
        }
        return { ...previous, description: value };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleComponentLibraryChange = useCallback(
    (value) => {
      updateComponentEditorDraft((previous) => {
        if (!previous || previous.library === value) {
          return previous;
        }
        return { ...previous, library: value };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleToggleInputExposure = useCallback(
    (id) => {
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          selectedInputs: toggleSelectionSet(previous.selectedInputs, id),
        };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleToggleOutputExposure = useCallback(
    (id) => {
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          selectedOutputs: toggleSelectionSet(previous.selectedOutputs, id),
        };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleToggleEventExposure = useCallback(
    (id) => {
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          selectedEvents: toggleSelectionSet(previous.selectedEvents, id),
        };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleComponentAddConnection = useCallback((detail) => {
    if (!detail) {
      return;
    }
    updateComponentEditorDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nodes = Array.isArray(previous.nodes) ? previous.nodes : [];
      const targetIndex = nodes.findIndex(
        (node) => node.instanceID === detail.targetInstanceID,
      );
      if (targetIndex === -1) {
        return previous;
      }

      const nextNode = JSON.parse(JSON.stringify(nodes[targetIndex] || {}));
      nextNode.inputs = Array.isArray(nextNode.inputs) ? nextNode.inputs : [];
      let changed = false;

      nextNode.inputs.forEach((input) => {
        input.variables = Array.isArray(input.variables) ? input.variables : [];
        input.triggers = Array.isArray(input.triggers) ? input.triggers : [];
      });

      if (detail.type === "variable") {
        nextNode.inputs.forEach((input) => {
          const originalLength = input.variables.length;
          input.variables = input.variables.filter(
            (variable) => variable.consumerVariable !== detail.targetKey,
          );
          if (input.variables.length !== originalLength) {
            changed = true;
          }
        });

        let producerEntry = nextNode.inputs.find(
          (input) => input.producerInstanceID === detail.sourceInstanceID,
        );
        if (!producerEntry) {
          producerEntry = {
            producerInstanceID: detail.sourceInstanceID,
            variables: [],
            triggers: [],
          };
          nextNode.inputs.push(producerEntry);
          changed = true;
        }
        producerEntry.variables = Array.isArray(producerEntry.variables)
          ? producerEntry.variables
          : [];
        const existing = producerEntry.variables.find(
          (variable) => variable.consumerVariable === detail.targetKey,
        );
        if (existing) {
          if (existing.producerOutput !== detail.sourceKey) {
            existing.producerOutput = detail.sourceKey;
            changed = true;
          }
        } else {
          producerEntry.variables.push({
            producerOutput: detail.sourceKey,
            consumerVariable: detail.targetKey,
          });
          changed = true;
        }
      } else if (detail.type === "event") {
        nextNode.inputs.forEach((input) => {
          const originalLength = input.triggers.length;
          input.triggers = input.triggers.filter(
            (trigger) => trigger.targetTrigger !== detail.targetKey,
          );
          if (input.triggers.length !== originalLength) {
            changed = true;
          }
        });

        let producerEntry = nextNode.inputs.find(
          (input) => input.producerInstanceID === detail.sourceInstanceID,
        );
        if (!producerEntry) {
          producerEntry = {
            producerInstanceID: detail.sourceInstanceID,
            variables: [],
            triggers: [],
          };
          nextNode.inputs.push(producerEntry);
          changed = true;
        }
        producerEntry.triggers = Array.isArray(producerEntry.triggers)
          ? producerEntry.triggers
          : [];
        const existing = producerEntry.triggers.find(
          (trigger) =>
            trigger.targetTrigger === detail.targetKey &&
            trigger.producerEvent === detail.sourceKey,
        );
        if (!existing) {
          producerEntry.triggers.push({
            producerEvent: detail.sourceKey,
            targetTrigger: detail.targetKey,
          });
          changed = true;
        }
      }

      nextNode.inputs = nextNode.inputs.filter((input) => {
        const hasVariables =
          Array.isArray(input.variables) && input.variables.length > 0;
        const hasTriggers =
          Array.isArray(input.triggers) && input.triggers.length > 0;
        return hasVariables || hasTriggers;
      });

      if (!changed) {
        return previous;
      }

      const nextNodes = nodes.map((node, index) =>
        index === targetIndex ? nextNode : node,
      );
      return rebuildComponentDraftState({
        ...previous,
        nodes: nextNodes,
      });
    });
  }, [updateComponentEditorDraft]);

  const handleComponentRemoveConnection = useCallback((detail) => {
    if (!detail) {
      return;
    }
    updateComponentEditorDraft((previous) => {
      if (!previous) {
        return previous;
      }
      const nodes = Array.isArray(previous.nodes) ? previous.nodes : [];
      const targetIndex = nodes.findIndex(
        (node) => node.instanceID === detail.targetInstanceID,
      );
      if (targetIndex === -1) {
        return previous;
      }

      const nextNode = JSON.parse(JSON.stringify(nodes[targetIndex] || {}));
      nextNode.inputs = Array.isArray(nextNode.inputs) ? nextNode.inputs : [];

      const producerIndex = nextNode.inputs.findIndex(
        (input) => input.producerInstanceID === detail.sourceInstanceID,
      );
      if (producerIndex === -1) {
        return previous;
      }

      const producerEntry = nextNode.inputs[producerIndex];
      let changed = false;

      if (detail.type === "variable") {
        const before = Array.isArray(producerEntry.variables)
          ? producerEntry.variables.length
          : 0;
        producerEntry.variables = Array.isArray(producerEntry.variables)
          ? producerEntry.variables.filter(
              (variable) =>
                !(
                  variable.producerOutput === detail.sourceKey &&
                  variable.consumerVariable === detail.targetKey
                ),
            )
          : [];
        if (producerEntry.variables.length !== before) {
          changed = true;
        }
      } else if (detail.type === "event") {
        const before = Array.isArray(producerEntry.triggers)
          ? producerEntry.triggers.length
          : 0;
        producerEntry.triggers = Array.isArray(producerEntry.triggers)
          ? producerEntry.triggers.filter(
              (trigger) =>
                !(
                  trigger.producerEvent === detail.sourceKey &&
                  trigger.targetTrigger === detail.targetKey
                ),
            )
          : [];
        if (producerEntry.triggers.length !== before) {
          changed = true;
        }
      }

      if (
        (!producerEntry.variables || producerEntry.variables.length === 0) &&
        (!producerEntry.triggers || producerEntry.triggers.length === 0)
      ) {
        nextNode.inputs.splice(producerIndex, 1);
        changed = true;
      }

      if (!changed) {
        return previous;
      }

      const nextNodes = nodes.map((node, index) =>
        index === targetIndex ? nextNode : node,
      );
      return rebuildComponentDraftState({
        ...previous,
        nodes: nextNodes,
      });
    });
  }, []);

  const handleComponentNodeChange = useCallback(
    (node, relativePath, newValue) => {
      if (!node) {
        return;
      }
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        const nodes = Array.isArray(previous.nodes)
          ? previous.nodes.map((entry) => {
              if (entry.instanceID !== node.instanceID) {
                return entry;
              }
              const updated = JSON.parse(JSON.stringify(node));
              if (relativePath) {
                setNestedObjectProperty(updated, relativePath, newValue);
              }
              return updated;
            })
          : [];
        return rebuildComponentDraftState({
          ...previous,
          nodes,
        });
      });
    },
    [updateComponentEditorDraft],
  );

  const handleComponentNodeStructureChange = useCallback(
    (node, action, optionalParams = {}) => {
      if (
        action === "editCustomComponent" ||
        action === "startCustomComponent" ||
        action === "commitCustomComponent" ||
        action === "cancelCustomComponent" ||
        action === "addCustomComponentInstance"
      ) {
        onNodeStructureChange?.(node, action, optionalParams);
        return;
      }

      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        const nodes = Array.isArray(previous.nodes)
          ? previous.nodes.map((entry) => JSON.parse(JSON.stringify(entry)))
          : [];
        const targetIndex = node
          ? nodes.findIndex((entry) => entry.instanceID === node.instanceID)
          : -1;
        let mutated = false;
        let createdNodeID = null;
        let nextSelected = Array.isArray(previous.selectedNodeIDs)
          ? previous.selectedNodeIDs.filter((id) =>
              nodes.some((entry) => entry.instanceID === id),
            )
          : [];

        switch (action) {
          case "duplicate": {
            if (targetIndex === -1) {
              return previous;
            }
            const sourceNode = nodes[targetIndex];
            const clone = JSON.parse(JSON.stringify(sourceNode));
            clone.instanceID = uuidv4();
            clone.instanceName = ensureUniqueInstanceName(clone.instanceName, nodes);
            nodes.splice(targetIndex + 1, 0, clone);
            createdNodeID = clone.instanceID;
            mutated = true;
            break;
          }
          case "delete": {
            if (targetIndex === -1) {
              return previous;
            }
            const removed = nodes.splice(targetIndex, 1)[0];
            nextSelected = nextSelected.filter((id) => id !== removed.instanceID);
            nodes.forEach((entry) => {
              if (!Array.isArray(entry.inputs)) {
                return;
              }
              entry.inputs = entry.inputs
                .map((input) => {
                  if (input.producerInstanceID === removed.instanceID) {
                    return null;
                  }
                  const variables = Array.isArray(input.variables)
                    ? input.variables.filter(Boolean)
                    : [];
                  const triggers = Array.isArray(input.triggers)
                    ? input.triggers.filter(Boolean)
                    : [];
                  if (variables.length === 0 && triggers.length === 0) {
                    return null;
                  }
                  return {
                    ...input,
                    variables,
                    triggers,
                  };
                })
                .filter(Boolean);
            });
            mutated = true;
            break;
          }
          case "copyParamsToSameType": {
            if (targetIndex === -1) {
              return previous;
            }
            const sourceNode = nodes[targetIndex];
            const metadata = getMetadataForNodeType(sourceNode.nodeType);
            const paramsToCopy = metadata?.parametersToCopy;
            if (!Array.isArray(paramsToCopy) || paramsToCopy.length === 0) {
              return previous;
            }
            nodes.forEach((entry) => {
              if (entry.nodeType !== sourceNode.nodeType || entry.instanceID === sourceNode.instanceID) {
                return;
              }
              paramsToCopy.forEach((path) => {
                const value = getNestedObjectProperty(sourceNode.params, path);
                setNestedObjectProperty(entry.params || (entry.params = {}), path, value);
              });
            });
            mutated = true;
            break;
          }
          case "visualUpdateNeeded":
          case "input": {
            mutated = true;
            break;
          }
          default: {
            return previous;
          }
        }

        if (!mutated) {
          return previous;
        }

        const nextDraft = rebuildComponentDraftState({
          ...previous,
          nodes,
          selectedNodeIDs: nextSelected,
        });
        if (createdNodeID) {
          nextDraft.selectedNodeIDs = [createdNodeID];
        }
        return nextDraft;
      });
    },
    [updateComponentEditorDraft, onNodeStructureChange],
  );

  const handleComponentSelectionChange = useCallback(
    (selectedIDs) => {
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        const nextSelected = Array.isArray(selectedIDs) ? [...selectedIDs] : [];
        const prior = Array.isArray(previous.selectedNodeIDs)
          ? previous.selectedNodeIDs
          : [];
        const sameLength = prior.length === nextSelected.length;
        const sameContent =
          sameLength &&
          prior.every((value, index) => value === nextSelected[index]);
        if (sameContent) {
          return previous;
        }
        return {
          ...previous,
          selectedNodeIDs: nextSelected,
        };
      });
    },
    [updateComponentEditorDraft],
  );

  const handleComponentGraphAction = useCallback(
    (action, detail = {}) => {
      updateComponentEditorDraft((previous) => {
        if (!previous) {
          return previous;
        }
        const nodes = Array.isArray(previous.nodes)
          ? previous.nodes.map((entry) => JSON.parse(JSON.stringify(entry)))
          : [];
        let createdNode = null;

        switch (action) {
          case "addTemplate": {
            const templateName = detail?.template;
            if (!templateName) {
              return previous;
            }
            const metadata = getMetadataForNodeType(templateName);
            if (!metadata?.newNodeTemplate) {
              return previous;
            }
            const newNode = JSON.parse(JSON.stringify(metadata.newNodeTemplate));
            newNode.instanceID = uuidv4();
            if (!newNode.instanceName) {
              newNode.instanceName = templateName;
            }
            newNode.instanceName = ensureUniqueInstanceName(newNode.instanceName, nodes);
            newNode.inputs = Array.isArray(newNode.inputs) ? newNode.inputs : [];
            replaceAllNodePlaceholderSettings(newNode);
            nodes.push(newNode);
            createdNode = newNode;
            break;
          }
          case "duplicateNode": {
            const sourceNode = detail?.node;
            if (!sourceNode) {
              return previous;
            }
            const clone = JSON.parse(JSON.stringify(sourceNode));
            clone.instanceID = uuidv4();
            clone.instanceName = ensureUniqueInstanceName(clone.instanceName, nodes);
            nodes.push(clone);
            createdNode = clone;
            break;
          }
          case "addCustomComponent": {
            const componentID = detail?.componentID;
            if (!componentID) {
              return previous;
            }
            const versionInfoCurrent = newVersionInfoRef.current;
            const definitions = Array.isArray(
              versionInfoCurrent?.stateMachineDescription?.customComponents,
            )
              ? versionInfoCurrent.stateMachineDescription.customComponents
              : [];
            const definition = definitions.find(
              (entry) => entry.componentID === componentID,
            );
            if (!definition) {
              return previous;
            }
            const metadata = getMetadataForNodeType("customComponent");
            const template = JSON.parse(JSON.stringify(metadata?.newNodeTemplate || {}));
            const componentNode = {
              ...template,
              instanceID: uuidv4(),
              nodeType: "customComponent",
              instanceName: ensureUniqueInstanceName(
                definition.name || template.instanceName || "Custom Component",
                nodes,
              ),
              params: {
                ...(template.params || {}),
                componentID: definition.componentID,
                version: definition.version || template.params?.version || { major: 0, minor: 1, patch: 0 },
                metadata: {
                  ...(template.params?.metadata || {}),
                  componentName: definition.name,
                },
                inputBindings: {},
                outputBindings: {},
                eventBindings: {},
              },
              inputs: Array.isArray(template.inputs) ? template.inputs : [],
            };
            nodes.push(componentNode);
            createdNode = componentNode;
            break;
          }
          case "deleteNodes": {
            const instanceIDs = Array.isArray(detail?.instanceIDs)
              ? detail.instanceIDs.filter(Boolean)
              : [];
            if (instanceIDs.length === 0) {
              return previous;
            }
            const removalSet = new Set(instanceIDs);
            const remainingNodes = nodes.filter((node) => !removalSet.has(node.instanceID));
            if (remainingNodes.length === nodes.length) {
              return previous;
            }
            remainingNodes.forEach((node) => {
              if (!Array.isArray(node.inputs)) {
                return;
              }
              node.inputs = node.inputs
                .filter((input) => input && !removalSet.has(input.producerInstanceID))
                .map((input) => ({
                  ...input,
                  variables: Array.isArray(input.variables)
                    ? input.variables.filter(
                        (variable) =>
                          variable &&
                          variable.consumerVariable &&
                          variable.producerOutput,
                      )
                    : [],
                  triggers: Array.isArray(input.triggers)
                    ? input.triggers.filter(
                        (trigger) =>
                          trigger &&
                          trigger.producerEvent &&
                          trigger.targetTrigger,
                      )
                    : [],
                }));
            });
            const nextDraftBase = {
              ...previous,
              nodes: remainingNodes,
              selectedNodeIDs: [],
              selectedInputs: [],
              selectedOutputs: [],
              selectedEvents: [],
            };
            const rebuilt = rebuildComponentDraftState(nextDraftBase);
            rebuilt.selectedNodeIDs = [];
            return rebuilt;
          }
          default:
            return previous;
        }

        const nextDraftBase = {
          ...previous,
          nodes,
        };
        const rebuilt = rebuildComponentDraftState(nextDraftBase);
        if (createdNode) {
          rebuilt.selectedNodeIDs = [createdNode.instanceID];
        } else if (Array.isArray(previous.selectedNodeIDs)) {
          rebuilt.selectedNodeIDs = previous.selectedNodeIDs.filter((id) =>
            nodes.some((entry) => entry.instanceID === id),
          );
        }
        return rebuilt;
      });
    },
    [updateComponentEditorDraft, newVersionInfoRef, replaceAllNodePlaceholderSettings],
  );

  const buildComponentDefinitionFromDraft = useCallback((draft, componentID) => {
    if (!draft) {
      return null;
    }

    const selectedInputsSet = toSelectionSetLike(draft.selectedInputs);
    const selectedOutputsSet = toSelectionSetLike(draft.selectedOutputs);
    const selectedEventsSet = toSelectionSetLike(draft.selectedEvents);

    const resolvedSelectedInputs =
      selectedInputsSet.size > 0
        ? selectedInputsSet
        : draft.mode === "editExisting"
          ? new Set()
          : new Set((draft.availableInputs || []).map((entry) => entry.id));
    const resolvedSelectedOutputs = new Set(selectedOutputsSet);
    const resolvedSelectedEvents = new Set(selectedEventsSet);

    const resolvedOriginalSelection = Array.from(
      new Set(
        [
          ...(Array.isArray(draft.metadata?.originalNodeInstanceIDs)
            ? draft.metadata.originalNodeInstanceIDs
            : []),
          ...(Array.isArray(draft.metadata?.selectedNodeInstanceIDs)
            ? draft.metadata.selectedNodeInstanceIDs
            : []),
          ...(Array.isArray(draft.selectedNodeIDs) ? draft.selectedNodeIDs : []),
          ...(Array.isArray(draft.nodes)
            ? draft.nodes.map((node) => node?.instanceID).filter(Boolean)
            : []),
        ].filter(Boolean),
      ),
    );

    const definition = {
      componentID,
      name: draft.name,
      description: draft.description || "",
      nodes: JSON.parse(JSON.stringify(draft.nodes)),
      exposedInputs: [],
      exposedOutputs: [],
      exposedEvents: [],
      metadata: {
        createdAt: new Date().toISOString(),
        selectedNodeInstanceIDs: [...(draft.selectedNodeIDs || [])],
        originalNodeInstanceIDs: resolvedOriginalSelection,
      },
      allowNesting: true,
      library: draft.library,
      version: { major: 0, minor: 1, patch: 0 },
    };

    draft.availableInputs.forEach((entry) => {
      if (!resolvedSelectedInputs.has(entry.id)) {
        return;
      }
      if (entry.kind === "variable") {
        definition.exposedInputs.push({
          handle: entry.handle,
          label: entry.label,
          nodeInstanceID: entry.nodeInstanceID,
          mediaType: entry.mediaType,
          portType: "variable",
          portName: entry.consumerVariable,
          annotations: {
            direction: "input",
            producerInstanceID: entry.producerInstanceID,
            producerOutput: entry.producerOutput,
          },
        });
      } else if (entry.kind === "event") {
        definition.exposedInputs.push({
          handle: entry.handle,
          label: entry.label,
          nodeInstanceID: entry.nodeInstanceID,
          mediaType: "event",
          portType: "event",
          portName: entry.targetTrigger,
          annotations: {
            direction: "input",
            producerInstanceID: entry.producerInstanceID,
            producerEvent: entry.producerEvent,
          },
        });
      }
    });

    draft.availableOutputs.forEach((entry) => {
      if (!resolvedSelectedOutputs.has(entry.id)) {
        return;
      }
      definition.exposedOutputs.push({
        handle: entry.handle,
        label: entry.label,
        nodeInstanceID: entry.nodeInstanceID,
        mediaType: entry.mediaType,
        portType: "variable",
        portName: entry.producerOutput,
        annotations: {
          direction: "output",
          targets: entry.targets,
        },
      });
    });

    draft.availableEvents.forEach((entry) => {
      if (!resolvedSelectedEvents.has(entry.id)) {
        return;
      }
      definition.exposedEvents.push({
        handle: entry.handle,
        label: entry.label,
        nodeInstanceID: entry.nodeInstanceID,
        mediaType: "event",
        portType: "event",
        portName: entry.producerEvent,
        annotations: {
          direction: "output",
          targets: entry.targets,
        },
      });
    });

    return definition;
  }, []);

  const sanitizeNodeInputs = useCallback((nodes, validNodeIDs) => {
    nodes.forEach((node) => {
      const inputs = Array.isArray(node.inputs) ? node.inputs : [];
      const nextInputs = [];
      inputs.forEach((input) => {
        if (!input || !validNodeIDs.has(input.producerInstanceID)) {
          return;
        }
        const nextInput = {
          producerInstanceID: input.producerInstanceID,
          includeHistory: Boolean(input.includeHistory),
          historyParams: input.historyParams ? { ...input.historyParams } : {},
          variables: Array.isArray(input.variables)
            ? input.variables.filter(
                (variable) =>
                  variable &&
                  variable.consumerVariable &&
                  variable.producerOutput
              )
            : [],
          triggers: Array.isArray(input.triggers)
            ? input.triggers.filter(
                (trigger) =>
                  trigger && trigger.producerEvent && trigger.targetTrigger
              )
            : [],
        };
        if (nextInput.variables.length || nextInput.triggers.length) {
          nextInputs.push(nextInput);
        }
      });
      node.inputs = nextInputs;
    });
  }, []);

  const commitComponentDraft = useCallback((draft) => {
    if (!draft) {
      return;
    }

    if (draft.mode === "editExisting" && draft.componentID) {
      const versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current || {}));
      if (!versionInfoCopy.stateMachineDescription) {
        versionInfoCopy.stateMachineDescription = {};
      }
      const graph = versionInfoCopy.stateMachineDescription;
      graph.customComponents = Array.isArray(graph.customComponents)
        ? JSON.parse(JSON.stringify(graph.customComponents))
        : [];

      const resolveComponentIndex = () => {
        if (typeof draft.componentIndex === "number") {
          return draft.componentIndex;
        }
        return graph.customComponents.findIndex(
          (entry) => entry.componentID === draft.componentID
        );
      };

      const componentIndex = resolveComponentIndex();
      const existingDefinition =
        componentIndex >= 0 ? graph.customComponents[componentIndex] : null;

      const definition = buildComponentDefinitionFromDraft(draft, draft.componentID);
      if (!definition) {
        return;
      }

      const incrementVersion = (previous) => {
        const safePrev = previous || draft.version || { major: 0, minor: 1, patch: 0 };
        const major = Number.isFinite(safePrev.major) ? safePrev.major : 0;
        const minor = Number.isFinite(safePrev.minor) ? safePrev.minor : 1;
        const patch = Number.isFinite(safePrev.patch) ? safePrev.patch + 1 : 0;
        return { major, minor, patch };
      };

      definition.version = incrementVersion(existingDefinition?.version);
      definition.name = draft.name;
      definition.description = draft.description || "";
      definition.library = draft.library || existingDefinition?.library || definition.library;
      definition.metadata = {
        ...(existingDefinition?.metadata || {}),
        ...(definition.metadata || {}),
        updatedAt: new Date().toISOString(),
      };

      if (componentIndex >= 0) {
        graph.customComponents[componentIndex] = definition;
      } else {
        graph.customComponents.push(definition);
      }

      graph.nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const componentNodes = graph.nodes.filter(
        (nodeDesc) =>
          nodeDesc.nodeType === "customComponent" &&
          nodeDesc.params?.componentID === draft.componentID
      );

      if (componentNodes.length > 0) {
        const validInputHandles = new Set();
        definition.exposedInputs
          .filter((port) => isInputVariablePort(port))
          .forEach((port) => validInputHandles.add(port.handle));
        definition.exposedEvents
          .filter((port) => isInputEventPort(port))
          .forEach((port) => validInputHandles.add(port.handle));

        const validOutputHandles = new Set(
          definition.exposedOutputs
            .filter((port) => isOutputVariablePort(port))
            .map((port) => port.handle)
        );
        const validEventOutputHandles = new Set(
          definition.exposedEvents
            .filter((port) => isOutputEventPort(port))
            .map((port) => port.handle)
        );

        componentNodes.forEach((componentNode) => {
          componentNode.params = componentNode.params || {};
          componentNode.params.version = definition.version;
          componentNode.params.metadata = {
            ...(componentNode.params.metadata || {}),
            componentName: draft.name,
          };

          componentNode.params.inputBindings = componentNode.params.inputBindings || {};
          Object.keys(componentNode.params.inputBindings).forEach((handle) => {
            if (!validInputHandles.has(handle)) {
              delete componentNode.params.inputBindings[handle];
            }
          });
          definition.exposedInputs
            .filter((port) => isInputVariablePort(port))
            .forEach((port) => {
              componentNode.params.inputBindings[port.handle] = {
                nodeInstanceID: port.nodeInstanceID,
                portName: port.portName,
              };
            });
          definition.exposedEvents
            .filter((port) => isInputEventPort(port))
            .forEach((port) => {
              componentNode.params.inputBindings[port.handle] = {
                nodeInstanceID: port.nodeInstanceID,
                portName: port.portName,
              };
            });

          componentNode.params.outputBindings = componentNode.params.outputBindings || {};
          Object.keys(componentNode.params.outputBindings).forEach((handle) => {
            if (!validOutputHandles.has(handle)) {
              delete componentNode.params.outputBindings[handle];
            }
          });
          definition.exposedOutputs
            .filter((port) => isOutputVariablePort(port))
            .forEach((port) => {
              componentNode.params.outputBindings[port.handle] = {
                nodeInstanceID: port.nodeInstanceID,
                portName: port.portName,
              };
            });

          componentNode.params.eventBindings = componentNode.params.eventBindings || {};
          Object.keys(componentNode.params.eventBindings).forEach((handle) => {
            if (!validEventOutputHandles.has(handle)) {
              delete componentNode.params.eventBindings[handle];
            }
          });
          definition.exposedEvents
            .filter((port) => isOutputEventPort(port))
            .forEach((port) => {
              componentNode.params.eventBindings[port.handle] = {
                nodeInstanceID: port.nodeInstanceID,
                portName: port.portName,
              };
            });

          componentNode.inputs = Array.isArray(componentNode.inputs) ? componentNode.inputs : [];
          componentNode.inputs = componentNode.inputs
            .map((entry) => {
              const variables = Array.isArray(entry.variables)
                ? entry.variables.filter((variable) => validInputHandles.has(variable.consumerVariable))
                : [];
              const triggers = Array.isArray(entry.triggers)
                ? entry.triggers.filter((trigger) => validInputHandles.has(trigger.targetTrigger))
                : [];
              if (variables.length === 0 && triggers.length === 0) {
                return null;
              }
              return {
                ...entry,
                variables,
                triggers,
              };
            })
            .filter(Boolean);
        });

        const componentInstanceIDs = new Set(componentNodes.map((nodeDesc) => nodeDesc.instanceID));
        graph.nodes = graph.nodes.map((graphNode) => {
          if (componentInstanceIDs.has(graphNode.instanceID)) {
            return graphNode;
          }
          const inputList = Array.isArray(graphNode.inputs) ? graphNode.inputs : [];
          const nextInputs = inputList
            .map((entry) => {
              if (!componentInstanceIDs.has(entry.producerInstanceID)) {
                return entry;
              }
              const variables = Array.isArray(entry.variables)
                ? entry.variables.filter((variable) => validOutputHandles.has(variable.producerOutput))
                : [];
              const triggers = Array.isArray(entry.triggers)
                ? entry.triggers.filter((trigger) => validEventOutputHandles.has(trigger.producerEvent))
                : [];
              if (variables.length === 0 && triggers.length === 0) {
                return null;
              }
              return {
                ...entry,
                variables,
                triggers,
              };
            })
            .filter(Boolean);
          return {
            ...graphNode,
            inputs: nextInputs,
          };
        });

        updateVersionInfo(versionInfoCopy);
        closeActiveComponentEditor();
        setInspectorPanelOpen(false);
        return;
      }

    }

    const selectedIDSet = new Set();
    const addIDsFrom = (value) => {
      toSelectionSetLike(value).forEach((id) => {
        if (id) {
          selectedIDSet.add(id);
        }
      });
    };
    addIDsFrom(draft.selectedNodeIDs);
    addIDsFrom(draft.metadata?.selectedNodeInstanceIDs);
    addIDsFrom(draft.metadata?.originalNodeInstanceIDs);
    if (Array.isArray(draft.nodes)) {
      draft.nodes.forEach((node) => {
        if (node?.instanceID) {
          selectedIDSet.add(node.instanceID);
        }
      });
    }
    const selectedIDs = selectedIDSet;
    if (selectedIDs.size === 0) {
      closeActiveComponentEditor();
      setInspectorPanelOpen(false);
      return;
    }

    const definitionID = uuidv4();
    const definition = buildComponentDefinitionFromDraft(draft, definitionID);
    if (!definition) {
      return;
    }

    const versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current || {}));
    if (!versionInfoCopy.stateMachineDescription) {
      versionInfoCopy.stateMachineDescription = {};
    }
    const graph = versionInfoCopy.stateMachineDescription;
    graph.customComponents = Array.isArray(graph.customComponents) ? [...graph.customComponents] : [];
    const originalNodes = Array.isArray(graph.nodes) ? graph.nodes : [];

    const externalConsumersSnapshot = originalNodes
      .filter((graphNode) => !selectedIDs.has(graphNode.instanceID))
      .map((graphNode) => {
        const originalInputs = Array.isArray(graphNode.inputs) ? graphNode.inputs : [];
        const referencesSelected = originalInputs.some(
          (inputEntry) => selectedIDs.has(inputEntry?.producerInstanceID)
        );
        if (!referencesSelected) {
          return null;
        }
        return {
          nodeInstanceID: graphNode.instanceID,
          inputs: JSON.parse(JSON.stringify(originalInputs)),
        };
      })
      .filter(Boolean);

    const remainingNodes = originalNodes.filter((node) => !selectedIDs.has(node.instanceID));
    const nodesById = new Map(remainingNodes.map((node) => [node.instanceID, node]));

    const metadata = getMetadataForNodeType("customComponent");
    const template = JSON.parse(JSON.stringify(metadata.newNodeTemplate || {}));
    const componentInstanceID = uuidv4();
    const componentInstanceName = ensureUniqueInstanceName(draft.name, remainingNodes);

    const newNodeParamsBase = template.params ? { ...template.params } : {};
    const newNode = {
      ...template,
      instanceID: componentInstanceID,
      instanceName: componentInstanceName,
      nodeType: "customComponent",
      params: {
        ...newNodeParamsBase,
        componentID: definition.componentID,
        version: definition.version,
        inputBindings: {},
        outputBindings: {},
        eventBindings: {},
        metadata: {
          ...(newNodeParamsBase.metadata || {}),
          componentName: draft.name,
        },
      },
      inputs: [],
    };

    const inputsByProducer = new Map();

    definition.exposedInputs.forEach((port) => {
      const isEventInput = port.portType === "event" || port.mediaType === "event";
      const producerInstanceID = port.annotations?.producerInstanceID;
      newNode.params.inputBindings[port.handle] = {
        nodeInstanceID: port.nodeInstanceID,
        portName: port.portName,
      };
      if (!producerInstanceID) {
        return;
      }
      if (!inputsByProducer.has(producerInstanceID)) {
        inputsByProducer.set(producerInstanceID, {
          producerInstanceID,
          includeHistory: false,
          historyParams: {},
          variables: [],
          triggers: [],
        });
      }
      const entry = inputsByProducer.get(producerInstanceID);
      if (isEventInput) {
        entry.triggers = entry.triggers || [];
        entry.triggers.push({
          producerEvent: port.annotations?.producerEvent || port.portName,
          targetTrigger: port.handle,
        });
      } else {
        entry.variables = entry.variables || [];
        entry.variables.push({
          producerOutput: port.annotations?.producerOutput || port.portName,
          consumerVariable: port.handle,
        });
      }
    });

    newNode.inputs = Array.from(inputsByProducer.values());
    nodesById.set(newNode.instanceID, newNode);

    const removeEmptyInputEntry = (node, index) => {
      const entry = node.inputs[index];
      const hasVariables = Array.isArray(entry?.variables) && entry.variables.length > 0;
      const hasTriggers = Array.isArray(entry?.triggers) && entry.triggers.length > 0;
      if (!hasVariables && !hasTriggers) {
        node.inputs.splice(index, 1);
      }
    };

    const ensureComponentInputEntry = (node) => {
      node.inputs = Array.isArray(node.inputs) ? node.inputs : [];
      let entry = node.inputs.find((input) => input.producerInstanceID === newNode.instanceID);
      if (!entry) {
        entry = {
          producerInstanceID: newNode.instanceID,
          includeHistory: false,
          historyParams: {},
          variables: [],
          triggers: [],
        };
        node.inputs.push(entry);
      }
      entry.variables = entry.variables || [];
      entry.triggers = entry.triggers || [];
      return entry;
    };

    definition.exposedOutputs.forEach((port) => {
      const originalProducerID = port.nodeInstanceID;
      const handle = port.handle;
      const targets = Array.isArray(port.annotations?.targets) ? port.annotations.targets : [];
      newNode.params.outputBindings[handle] = {
        nodeInstanceID: port.nodeInstanceID,
        portName: port.portName,
      };
      targets.forEach((target) => {
        const targetNode = nodesById.get(target.nodeInstanceID);
        if (!targetNode) {
          return;
        }
        targetNode.inputs = Array.isArray(targetNode.inputs) ? targetNode.inputs : [];
        const existingIndex = targetNode.inputs.findIndex(
          (input) => input.producerInstanceID === originalProducerID
        );
        const previousEntry =
          existingIndex >= 0 ? JSON.parse(JSON.stringify(targetNode.inputs[existingIndex])) : null;
        if (existingIndex >= 0) {
          const existing = targetNode.inputs[existingIndex];
          if (Array.isArray(existing.variables)) {
            existing.variables = existing.variables.filter(
              (variable) =>
                !(
                  variable.consumerVariable === target.consumerVariable &&
                  variable.producerOutput === port.portName
                )
            );
          }
          if (!Array.isArray(existing.variables) || existing.variables.length === 0) {
            removeEmptyInputEntry(targetNode, existingIndex);
          } else {
            targetNode.inputs[existingIndex] = existing;
          }
        }
          const componentEntry = ensureComponentInputEntry(targetNode);
        if (previousEntry) {
          if (previousEntry.includeHistory) {
            componentEntry.includeHistory = previousEntry.includeHistory;
          }
          if (previousEntry.historyParams && Object.keys(previousEntry.historyParams).length > 0) {
            componentEntry.historyParams = {
              ...(componentEntry.historyParams || {}),
              ...previousEntry.historyParams,
            };
          }
        }
        const existingVariable = componentEntry.variables.find(
          (variable) => variable.consumerVariable === target.consumerVariable
        );
        if (existingVariable) {
          existingVariable.producerOutput = handle;
        } else {
          componentEntry.variables.push({
            producerOutput: handle,
            consumerVariable: target.consumerVariable,
          });
        }
      });
    });

    definition.exposedEvents
      .filter((port) => isOutputEventPort(port))
      .forEach((port) => {
        const originalProducerID = port.nodeInstanceID;
        const handle = port.handle;
        const targets = Array.isArray(port.annotations?.targets) ? port.annotations.targets : [];
        newNode.params.eventBindings[handle] = {
          nodeInstanceID: port.nodeInstanceID,
          portName: port.portName,
        };
        targets.forEach((target) => {
          const targetNode = nodesById.get(target.nodeInstanceID);
          if (!targetNode) {
            return;
          }
          targetNode.inputs = Array.isArray(targetNode.inputs) ? targetNode.inputs : [];
          const existingIndex = targetNode.inputs.findIndex(
            (input) => input.producerInstanceID === originalProducerID
          );
          const previousEntry =
            existingIndex >= 0 ? JSON.parse(JSON.stringify(targetNode.inputs[existingIndex])) : null;
          if (existingIndex >= 0) {
            const existing = targetNode.inputs[existingIndex];
            if (Array.isArray(existing.triggers)) {
              existing.triggers = existing.triggers.filter(
                (trigger) =>
                  !(
                    trigger.targetTrigger === target.targetTrigger &&
                    trigger.producerEvent === port.portName
                  )
              );
            }
            if (
              (!Array.isArray(existing.triggers) || existing.triggers.length === 0) &&
              (!Array.isArray(existing.variables) || existing.variables.length === 0)
            ) {
              removeEmptyInputEntry(targetNode, existingIndex);
            } else {
              targetNode.inputs[existingIndex] = existing;
            }
          }
          const componentEntry = ensureComponentInputEntry(targetNode);
          if (previousEntry) {
            if (previousEntry.includeHistory) {
              componentEntry.includeHistory = previousEntry.includeHistory;
            }
            if (previousEntry.historyParams && Object.keys(previousEntry.historyParams).length > 0) {
              componentEntry.historyParams = {
                ...(componentEntry.historyParams || {}),
                ...previousEntry.historyParams,
              };
            }
          }
          const existingTrigger = componentEntry.triggers.find(
            (trigger) => trigger.targetTrigger === target.targetTrigger
          );
          if (existingTrigger) {
            existingTrigger.producerEvent = handle;
          } else {
            componentEntry.triggers.push({
              producerEvent: handle,
              targetTrigger: target.targetTrigger,
            });
          }
        });
      });

    const selectedIndexes = originalNodes
      .map((node, index) => (selectedIDs.has(node.instanceID) ? index : null))
      .filter((index) => index !== null);
    const insertIndex =
      selectedIndexes.length > 0 ? Math.min(...selectedIndexes) : remainingNodes.length;
    remainingNodes.splice(insertIndex, 0, newNode);

    const validNodeIDs = new Set(remainingNodes.map((node) => node.instanceID));
    sanitizeNodeInputs(remainingNodes, validNodeIDs);

    definition.metadata = {
      ...definition.metadata,
      componentIndex: insertIndex,
      externalConsumers: externalConsumersSnapshot,
    };
    graph.nodes = remainingNodes;
    definition.metadata = {
      ...definition.metadata,
      componentInstanceID,
      createdFromVersionID: versionInfoCopy.versionID || null,
    };
    graph.customComponents.push(definition);

    updateVersionInfo(versionInfoCopy);
    closeActiveComponentEditor();
    setInspectorPanelOpen(false);
  }, [
    buildComponentDefinitionFromDraft,
    newVersionInfoRef,
    sanitizeNodeInputs,
    closeActiveComponentEditor,
    setInspectorPanelOpen,
    updateVersionInfo,
  ]);

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
      case "startCustomComponent": {
        const instanceIDs = optionalParams?.instanceIDs || (node ? [node.instanceID] : []);
        startComponentEditor(instanceIDs);
      }
      break;
      case "editCustomComponent": {
        if (!node || node.nodeType !== "customComponent") {
          return;
        }
        const componentID = node?.params?.componentID;
        if (!componentID) {
          return;
        }
        const versionInfoCurrent = newVersionInfoRef.current;
        const definitions = Array.isArray(versionInfoCurrent?.stateMachineDescription?.customComponents)
          ? versionInfoCurrent.stateMachineDescription.customComponents
          : [];
        const componentIndex = definitions.findIndex((entry) => entry.componentID === componentID);
        if (componentIndex === -1) {
          return;
        }
        const definition = definitions[componentIndex];
        const draft = buildComponentDraftFromDefinition(definition);
        if (!draft) {
          return;
        }
        const graphNodes = versionInfoCurrent?.stateMachineDescription?.nodes ?? [];
        draft.componentIndex = componentIndex;
        draft.componentInstanceIDs = graphNodes
      .filter(
        (nodeDesc) =>
          nodeDesc.nodeType === "customComponent" &&
          nodeDesc.params?.componentID === componentID
      )
      .map((nodeDesc) => nodeDesc.instanceID);
      openComponentEditor(draft, { componentID, mode: "editExisting" });
      setInspectorPanelOpen(false);
    }
    break;
      case "cancelCustomComponent": {
        handleCancelComponentEditor();
      }
      break;
      case "commitCustomComponent": {
        const draft = optionalParams?.draft || componentEditorState;
        commitComponentDraft(draft);
      }
      break;
      case "unbundleCustomComponent": {
        if (!node || node.nodeType !== "customComponent") {
          return;
        }
        const componentID = node?.params?.componentID;
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        if (!versionInfoCopy.stateMachineDescription) {
          return;
        }
        const graph = versionInfoCopy.stateMachineDescription;
        graph.nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
        const componentIndex = graph.nodes.findIndex(
          (entry) => entry.instanceID === node.instanceID
        );
        const definition = (graph.customComponents || []).find(
          (entry) => entry.componentID === componentID
        );
        if (componentIndex === -1 || !definition) {
          return;
        }

        graph.nodes.splice(componentIndex, 1);

        const definitionNodes = JSON.parse(JSON.stringify(definition.nodes || []));
        const definitionIDs = new Set(definitionNodes.map((entry) => entry.instanceID));
        graph.nodes = graph.nodes.filter((entry) => !definitionIDs.has(entry.instanceID));

        const insertionIndex = Math.min(
          definition.metadata?.componentIndex ?? componentIndex,
          graph.nodes.length
        );
        graph.nodes.splice(insertionIndex, 0, ...definitionNodes);
        const validNodeIDs = new Set(graph.nodes.map((entry) => entry.instanceID));
        sanitizeNodeInputs(graph.nodes, validNodeIDs);

        const externalConsumers = Array.isArray(definition.metadata?.externalConsumers)
          ? definition.metadata.externalConsumers
          : [];
        externalConsumers.forEach((snapshot) => {
          const targetNode = graph.nodes.find(
            (entry) => entry.instanceID === snapshot.nodeInstanceID
          );
          if (targetNode) {
            targetNode.inputs = JSON.parse(JSON.stringify(snapshot.inputs || []));
          }
        });

        updateVersionInfo(versionInfoCopy);
        closeActiveComponentEditor();
        setInspectorPanelOpen(false);
      }
      break;
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
      case "addCustomComponentInstance": {
        const { componentID } = optionalParams;
        if (!componentID) {
          break;
        }
        let versionInfoCopy = JSON.parse(JSON.stringify(newVersionInfoRef.current));
        if (!versionInfoCopy.stateMachineDescription) {
          versionInfoCopy.stateMachineDescription = {};
        }
        const graph = versionInfoCopy.stateMachineDescription;
        graph.customComponents = Array.isArray(graph.customComponents) ? graph.customComponents : [];
        graph.nodes = Array.isArray(graph.nodes) ? graph.nodes : [];

        const definition = graph.customComponents.find((entry) => entry.componentID === componentID);
        if (!definition) {
          break;
        }

        const metadata = getMetadataForNodeType("customComponent");
        const template = JSON.parse(JSON.stringify(metadata.newNodeTemplate || {}));
        const instanceID = uuidv4();
        const instanceName = ensureUniqueInstanceName(definition.name, graph.nodes);

        const newNode = {
          ...template,
          instanceID,
          instanceName,
          nodeType: "customComponent",
          params: {
            ...(template.params || {}),
            componentID: definition.componentID,
            version: definition.version,
            inputBindings: {},
            outputBindings: {},
            eventBindings: {},
            metadata: {
              ...(template.params?.metadata || {}),
              componentName: definition.name,
            },
          },
          inputs: [],
        };

        graph.nodes.push(newNode);
        updateVersionInfo(versionInfoCopy);
        returnValue = newNode;
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
        if (nodeToUse.nodeType === "customComponent") {
          const conflictingBinding = nodeToUse.inputs.some((input) => {
            if (!input || input.producerInstanceID === producerInstanceID) {
              return false;
            }
            return Array.isArray(input.triggers) && input.triggers.some((trigger) => trigger.targetTrigger === targetTrigger);
          });
          if (conflictingBinding) {
            console.warn(`Custom component handle "${targetTrigger}" already has an event binding. Remove the existing connection before adding a new one.`);
            return;
          }
        }
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
        if (nodeToUse.nodeType === "customComponent") {
          const conflictingBinding = nodeToUse.inputs.some((input) => {
            if (!input || input.producerInstanceID === producerInstanceID) {
              return false;
            }
            return Array.isArray(input.variables) && input.variables.some((variable) => variable.consumerVariable === consumerVariable);
          });
          if (conflictingBinding) {
            console.warn(`Custom component handle "${consumerVariable}" already has a variable binding. Remove the existing connection before adding a new one.`);
            return;
          }
        }
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
            readOnly={readOnly || Boolean(componentEditorState)}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0" style={overlayStyle} />
      </div>

      {componentEditorState ? (
        <CustomComponentEditor
          draft={componentEditorState}
          frameId={activeCustomFrame?.id}
          onClose={handleCancelComponentEditor}
          onSave={commitComponentDraft}
          onNameChange={handleComponentNameChange}
          onDescriptionChange={handleComponentDescriptionChange}
          onToggleInput={handleToggleInputExposure}
          onToggleOutput={handleToggleOutputExposure}
          onToggleEvent={handleToggleEventExposure}
          onLibraryChange={handleComponentLibraryChange}
          onAddConnection={handleComponentAddConnection}
          onRemoveConnection={handleComponentRemoveConnection}
          onNodeValueChange={handleComponentNodeChange}
          onNodeStructureChange={handleComponentNodeStructureChange}
          onSelectionChange={handleComponentSelectionChange}
          onGraphAction={handleComponentGraphAction}
          onPersonaListChange={onPersonaListChange}
          versionInfo={newVersionInfoRef.current}
          readOnly={readOnly}
        />
      ) : null}

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

function VersionEditorWithStack(props) {
  const initialFrame = useMemo(
    () => ({
      id: 'version-root',
      kind: 'version',
      metadata: { source: 'versionEditor' },
    }),
    [],
  );

  return (
    <EditorStackProvider initialFrame={initialFrame}>
      <VersionEditorComponent {...props} />
    </EditorStackProvider>
  );
}

export default memo(VersionEditorWithStack);
