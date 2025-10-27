'use client';

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Controls,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Handle, Position } from 'reactflow';
import { X, Settings2, Info, Trash2, PackagePlus, SquareStack } from 'lucide-react';
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge';
import { createPortal } from 'react-dom';

import NodeGraphNode from './graphdisplay/nodegraphnode';
import CustomSmartEdge from './graphdisplay/customedges/customsmartedge';
import SelfConnectingEdge from './graphdisplay/customedges/selfconnectingedge';
import CurvyEdge from './graphdisplay/customedges/curvyedge';
import FloatingEdge from './graphdisplay/customedges/floatingedge';
import CustomConnectionLine from './graphdisplay/customedges/customconnectionline';
import { defaultAppTheme } from '@src/common/theme';
import { NodeSettingsMenu } from './nodesettingsmenu';
import { FloatingPanel } from './floatingpanel';
import { NodeLibraryTree } from './nodelibrarytree';
import { TextDialog } from '../standard/textdialog';

const INPUT_NODE_ID = '__component_inputs__';
const OUTPUT_NODE_ID = '__component_outputs__';

const nodeTypes = {
  nodeGraphNode: NodeGraphNode,
  componentBoundary: ComponentBoundaryNode,
};

const edgeTypes = {
  customsmartedge: CustomSmartEdge,
  selfconnecting: SelfConnectingEdge,
  curvyedge: CurvyEdge,
  smartedge: SmartBezierEdge,
  floating: FloatingEdge,
};

const defaultViewport = { x: 0, y: 0, zoom: 0.75 };
const baseEdgeStyle = {
  strokeWidth: 2,
  stroke: '#38bdf8',
};
const connectionLineStyle = {
  strokeWidth: 3,
  stroke: '#38bdf8',
};

const boundaryEdgeStyle = {
  strokeWidth: 2,
  stroke: '#38bdf8',
  strokeDasharray: '6 6',
  opacity: 0.85,
};

const markerEnd = {
  type: 'arrowclosed',
  width: 14,
  height: 14,
  color: '#38bdf8',
};

const SELECTION_DRAG_THRESHOLD = 5;
const POSITION_EPSILON = 0.01;
const VIEWPORT_POSITION_EPSILON = 0.5;
const VIEWPORT_ZOOM_EPSILON = 0.001;

function positionsAreClose(a, b, epsilon = POSITION_EPSILON) {
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function viewportsAreClose(a, b) {
  if (!a || !b) {
    return false;
  }
  const xClose = Math.abs(a.x - b.x) <= VIEWPORT_POSITION_EPSILON;
  const yClose = Math.abs(a.y - b.y) <= VIEWPORT_POSITION_EPSILON;
  const zoomClose = Math.abs(a.zoom - b.zoom) <= VIEWPORT_ZOOM_EPSILON;
  return xClose && yClose && zoomClose;
}

function areIdListsEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

function getContextMenuPosition(clientX, clientY, menuWidth = 220, menuHeight = 200) {
  let x = clientX;
  let y = clientY;
  if (typeof window !== 'undefined') {
    const maxLeft = Math.max(16, window.innerWidth - menuWidth);
    const maxTop = Math.max(16, window.innerHeight - menuHeight);
    x = Math.min(Math.max(16, clientX), maxLeft);
    y = Math.min(Math.max(16, clientY), maxTop);
  }
  return { x, y };
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
  if (typeof value[Symbol.iterator] === 'function') {
    return new Set(value);
  }
  if (typeof value === 'object') {
    return new Set(Object.values(value));
  }
  return new Set();
}

function ComponentBoundaryNode({ data }) {
  const orientation = data?.orientation ?? 'input';
  const label = data?.label ?? '';
  const ghostText = data?.ghostText ?? '';
  const isInput = orientation === 'input';

  const allowedPrefixes = useMemo(
    () => (isInput ? ['trigger-', 'variable-'] : ['output-', 'event-']),
    [isInput],
  );


  const isHandleAllowed = useCallback(
    (handleId) => {
      if (typeof handleId !== 'string' || handleId.length === 0) {
        return false;
      }
      return allowedPrefixes.some((prefix) => handleId.startsWith(prefix));
    },
    [allowedPrefixes],
  );

  const isValidInputConnection = useCallback(
    (connection) => {
      if (
        !connection?.target ||
        connection.target === INPUT_NODE_ID ||
        connection.target === OUTPUT_NODE_ID
      ) {
        return false;
      }
      return isHandleAllowed(connection.targetHandle);
    },
    [isHandleAllowed],
  );

  const isValidOutputConnection = useCallback(
    (connection) => {
      if (
        !connection?.source ||
        connection.source === OUTPUT_NODE_ID ||
        connection.source === INPUT_NODE_ID
      ) {
        return false;
      }
      return isHandleAllowed(connection.sourceHandle);
    },
    [isHandleAllowed],
  );

  return (
    <div className="relative flex min-h-[280px] min-w-[220px] flex-col items-center justify-center rounded-[2.25rem] border border-white/15 bg-white/5 px-6 py-10 text-center text-slate-200 shadow-[0_40px_90px_-60px_rgba(56,189,248,0.6)]">
      <div className="rounded-full border border-white/20 px-4 py-1 text-[10px] uppercase tracking-[0.4em] text-white/60">
        {label}
      </div>
      <p className="mt-6 text-sm font-medium uppercase tracking-[0.35em] text-white/20">
        {ghostText}
      </p>
      {isInput ? (
        <Handle
          type="source"
          position={Position.Right}
          id="input-boundary"
          isConnectableEnd={false}
          isValidConnection={isValidInputConnection}
          style={{
            width: 18,
            height: 18,
            right: -9,
            top: '50%',
            transform: 'translateY(-50%)',
            borderRadius: '9999px',
            background: 'rgba(56,189,248,0.75)',
            border: '2px solid rgba(56,189,248,0.5)',
          }}
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          id="output-boundary"
          isConnectableStart={false}
          isValidConnection={isValidOutputConnection}
          style={{
            width: 18,
            height: 18,
            left: -9,
            top: '50%',
            transform: 'translateY(-50%)',
            borderRadius: '9999px',
            background: 'rgba(56,189,248,0.75)',
            border: '2px solid rgba(56,189,248,0.5)',
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
        {title}
      </h3>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function GhostPill({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-between rounded-full border px-3 py-1 text-xs font-medium transition ${
        selected
          ? 'border-sky-400 bg-sky-500/20 text-sky-100'
          : 'border-white/20 bg-white/5 text-slate-300 hover:border-sky-400/80 hover:bg-sky-500/10'
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`ml-2 inline-flex h-2 w-2 rounded-full ${
          selected ? 'bg-sky-400' : 'bg-white/30'
        }`}
      />
    </button>
  );
}

function ExposureList({ entries, selectedSet, onToggle }) {
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-slate-500">None available.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <label className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent text-sky-400"
              checked={selectedSet.has(entry.id)}
              onChange={() => onToggle(entry.id)}
            />
            <span className="flex-1">
              <span className="block font-medium">{entry.label}</span>
              <span className="block text-xs text-slate-500">
                {entry.kind === 'event' ? 'Event' : 'Variable'}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function buildNodeLayout(draftNodes, previousPositions) {
  if (!draftNodes || draftNodes.length === 0) {
    return {
      nodes: [],
      bounds: { minX: -200, maxX: 200, midY: 0 },
    };
  }

  const spacingX = 320;
  const spacingY = 220;
  const columns = Math.max(1, Math.ceil(Math.sqrt(draftNodes.length)));

  const positionedNodes = draftNodes.map((node, index) => {
    const previous = previousPositions.get(node.instanceID);
    if (previous) {
      return { node, position: previous };
    }

    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      node,
      position: {
        x: col * spacingX,
        y: row * spacingY,
      },
    };
  });

  const xs = positionedNodes.map((entry) => entry.position.x);
  const ys = positionedNodes.map((entry) => entry.position.y);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 0;
  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;

  const centeredNodes = positionedNodes.map((entry) => ({
    node: entry.node,
    position: {
      x: entry.position.x - offsetX,
      y: entry.position.y - offsetY,
    },
  }));

  const centeredXs = centeredNodes.map((entry) => entry.position.x);
  const centeredYs = centeredNodes.map((entry) => entry.position.y);
  const centeredMinX = centeredXs.length ? Math.min(...centeredXs) : -200;
  const centeredMaxX = centeredXs.length ? Math.max(...centeredXs) : 200;
  const midY =
    centeredYs.length === 0
      ? 0
      : (Math.min(...centeredYs) + Math.max(...centeredYs)) / 2;

  return {
    nodes: centeredNodes,
    bounds: { minX: centeredMinX, maxX: centeredMaxX, midY },
  };
}

function buildInternalEdges(draftNodes) {
  if (!draftNodes || draftNodes.length === 0) {
    return [];
  }
  const edges = [];
  draftNodes.forEach((node) => {
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    inputs.forEach((input) => {
      const producerID = input.producerInstanceID;
      if (!producerID) {
        return;
      }
      const triggers = Array.isArray(input.triggers) ? input.triggers : [];
      triggers.forEach((trigger) => {
        if (!trigger?.producerEvent) {
          return;
        }
        const edgeID = `component-trigger-${producerID}-${trigger.producerEvent}-${node.instanceID}-${trigger.targetTrigger || 'default'}`;
        edges.push({
          id: edgeID,
          source: producerID,
          target: node.instanceID,
          sourceHandle: `event-${trigger.producerEvent}`,
          targetHandle: `trigger-${trigger.targetTrigger || 'default'}`,
          type: 'customsmartedge',
          selectable: true,
          style: baseEdgeStyle,
          markerEnd,
          data: {
            connectionType: 'event',
            producerInstanceID: producerID,
            producerPort: trigger.producerEvent,
            targetInstanceID: node.instanceID,
            targetPort: trigger.targetTrigger || 'default',
          },
        });
      });

      const variables = Array.isArray(input.variables) ? input.variables : [];
      variables.forEach((variable) => {
        if (!variable?.producerOutput || !variable?.consumerVariable) {
          return;
        }
        const edgeID = `component-variable-${producerID}-${variable.producerOutput}-${node.instanceID}-${variable.consumerVariable}`;
        edges.push({
          id: edgeID,
          source: producerID,
          target: node.instanceID,
          sourceHandle: `output-${variable.producerOutput}`,
          targetHandle: `variable-${variable.consumerVariable}`,
          type: 'customsmartedge',
          selectable: true,
          style: baseEdgeStyle,
          markerEnd,
          data: {
            connectionType: 'variable',
            producerInstanceID: producerID,
            producerPort: variable.producerOutput,
            targetInstanceID: node.instanceID,
            targetPort: variable.consumerVariable,
          },
        });
      });
    });
  });
  return edges;
}

function buildExposureEdges(draft) {
  if (!draft) {
    return [];
  }
  const selectedInputs = toSelectionSet(draft.selectedInputs);
  const selectedOutputs = toSelectionSet(draft.selectedOutputs);
  const selectedEvents = toSelectionSet(draft.selectedEvents);
  const exposureEdges = [];

  (draft.availableInputs || []).forEach((entry) => {
    if (!selectedInputs.has(entry.id)) {
      return;
    }
    const isEvent = entry.kind === 'event';
    const suffix = isEvent ? entry.targetTrigger : entry.consumerVariable;
    const targetHandle = isEvent ? `trigger-${entry.targetTrigger}` : `variable-${entry.consumerVariable}`;
    exposureEdges.push({
      id: `component-input-${entry.id}`,
      source: INPUT_NODE_ID,
      target: entry.nodeInstanceID,
      sourceHandle: 'input-boundary',
      targetHandle,
      type: 'customsmartedge',
      selectable: true,
      style: boundaryEdgeStyle,
      markerEnd,
      data: {
        exposureType: 'input',
        entryId: entry.id,
        key: suffix,
      },
    });
  });

  (draft.availableOutputs || []).forEach((entry) => {
    if (!selectedOutputs.has(entry.id)) {
      return;
    }
    exposureEdges.push({
      id: `component-output-${entry.id}`,
      source: entry.nodeInstanceID,
      target: OUTPUT_NODE_ID,
      sourceHandle: `output-${entry.producerOutput}`,
      targetHandle: 'output-boundary',
      type: 'customsmartedge',
      selectable: true,
      style: boundaryEdgeStyle,
      markerEnd,
      data: {
        exposureType: 'output',
        entryId: entry.id,
        key: entry.producerOutput,
      },
    });
  });

  (draft.availableEvents || []).forEach((entry) => {
    if (!selectedEvents.has(entry.id)) {
      return;
    }
    exposureEdges.push({
      id: `component-event-${entry.id}`,
      source: entry.nodeInstanceID,
      target: OUTPUT_NODE_ID,
      sourceHandle: `event-${entry.producerEvent}`,
      targetHandle: 'output-boundary',
      type: 'customsmartedge',
      selectable: true,
      style: boundaryEdgeStyle,
      markerEnd,
      data: {
        exposureType: 'event',
        entryId: entry.id,
        key: entry.producerEvent,
      },
    });
  });

  return exposureEdges;
}

function buildInputLookup(draft) {
  const map = new Map();
  const selected = toSelectionSet(draft?.selectedInputs);
  (draft?.availableInputs || []).forEach((entry) => {
    let key;
    if (entry.kind === 'event') {
      key = `event::${entry.nodeInstanceID}::${entry.targetTrigger}`;
    } else {
      key = `variable::${entry.nodeInstanceID}::${entry.consumerVariable}`;
    }
    if (!map.has(key) || selected.has(entry.id)) {
      map.set(key, entry);
    }
  });
  return map;
}

function buildOutputLookup(draft) {
  const map = new Map();
  const selected = toSelectionSet(draft?.selectedOutputs);
  (draft?.availableOutputs || []).forEach((entry) => {
    const key = `variable::${entry.nodeInstanceID}::${entry.producerOutput}`;
    if (!map.has(key) || selected.has(entry.id)) {
      map.set(key, entry);
    }
  });
  return map;
}

function buildEventLookup(draft) {
  const map = new Map();
  const selected = toSelectionSet(draft?.selectedEvents);
  (draft?.availableEvents || []).forEach((entry) => {
    const key = `event::${entry.nodeInstanceID}::${entry.producerEvent}`;
    if (!map.has(key) || selected.has(entry.id)) {
      map.set(key, entry);
    }
  });
  return map;
}

function SettingsModal({
  draft,
  onClose,
  onNameChange,
  onDescriptionChange,
  onToggleInput,
  onToggleOutput,
  onToggleEvent,
  onLibraryChange,
}) {
  if (!draft) {
    return null;
  }

  const selectedInputs = toSelectionSet(draft.selectedInputs);
  const selectedOutputs = toSelectionSet(draft.selectedOutputs);
  const selectedEvents = toSelectionSet(draft.selectedEvents);

  const inputVariables = draft.availableInputs.filter(
    (entry) => entry.kind === 'variable',
  );
  const inputEvents = draft.availableInputs.filter(
    (entry) => entry.kind === 'event',
  );
  const outputVariables = draft.availableOutputs || [];
  const outputEvents = draft.availableEvents || [];

  return (
    <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-slate-950/80 px-4 py-8">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-8 shadow-[0_45px_120px_-60px_rgba(56,189,248,0.55)]">
        <button
          type="button"
          className="absolute right-6 top-6 rounded-full border border-white/20 p-2 text-slate-400 transition hover:border-white/40 hover:bg-white/10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Component Settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-100">
              Configure metadata and exposed ports
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Component Name
              </span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => onNameChange?.(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                placeholder="Custom Component"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Description
              </span>
              <textarea
                value={draft.description || ''}
                onChange={(event) => onDescriptionChange?.(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                placeholder="Describe what this component does."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Library
              </span>
              <select
                value={draft.library || 'personal'}
                onChange={(event) => onLibraryChange?.(event.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              >
                <option value="personal">Personal Library</option>
                <option value="shared">Shared Library</option>
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionHeader
              title="Ghost Preview"
              subtitle="Toggled ports appear on the final block."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
              <div className="flex flex-col gap-2">
                {inputVariables.map((entry) => (
                  <GhostPill
                    key={entry.id}
                    label={entry.label}
                    selected={selectedInputs.has(entry.id)}
                    onToggle={() => onToggleInput?.(entry.id)}
                  />
                ))}
                {inputEvents.map((entry) => (
                  <GhostPill
                    key={entry.id}
                    label={entry.label}
                    selected={selectedInputs.has(entry.id)}
                    onToggle={() => onToggleInput?.(entry.id)}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center">
                <div className="flex h-32 w-40 items-center justify-center rounded-2xl border border-white/20 bg-slate-950/80 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  {draft.name || 'Component'}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {outputVariables.map((entry) => (
                  <GhostPill
                    key={entry.id}
                    label={entry.label}
                    selected={selectedOutputs.has(entry.id)}
                    onToggle={() => onToggleOutput?.(entry.id)}
                  />
                ))}
                {outputEvents.map((entry) => (
                  <GhostPill
                    key={entry.id}
                    label={entry.label}
                    selected={selectedEvents.has(entry.id)}
                    onToggle={() => onToggleEvent?.(entry.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionHeader
              title="Expose Inputs"
              subtitle="Select the variables and triggers the block receives."
            />
            <ExposureList
              entries={draft.availableInputs}
              selectedSet={selectedInputs}
              onToggle={onToggleInput}
            />
          </div>
          <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="space-y-3">
              <SectionHeader
                title="Expose Outputs"
                subtitle="Select the data the block provides."
              />
              <ExposureList
                entries={draft.availableOutputs}
                selectedSet={selectedOutputs}
                onToggle={onToggleOutput}
              />
            </div>
            <div className="space-y-3 border-t border-white/10 pt-4">
              <SectionHeader
                title="Expose Events"
                subtitle="Select the events emitted by the block."
              />
              <ExposureList
                entries={draft.availableEvents}
                selectedSet={selectedEvents}
                onToggle={onToggleEvent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomComponentEditor({
  draft,
  onClose,
  onSave,
  onNameChange,
  onDescriptionChange,
  onToggleInput,
  onToggleOutput,
  onToggleEvent,
  onLibraryChange,
  onAddConnection,
  onRemoveConnection,
  onNodeValueChange,
  onNodeStructureChange,
  onSelectionChange,
  onGraphAction,
  onPersonaListChange,
  versionInfo,
  readOnly = false,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [graphNodes, setGraphNodes, internalOnNodesChange] = useNodesState([]);
  const [edges, setEdges, internalOnEdgesChange] = useEdgesState([]);
  const [edgeMenu, setEdgeMenu] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null);
  const [paneMenu, setPaneMenu] = useState(null);
  const edgesRef = useRef([]);
  const wrapperRef = useRef(null);
  const reactFlowInstanceRef = useRef(null);
  const boundaryPositionsRef = useRef({ input: null, output: null });
  const paneDragStartRef = useRef(null);
  const namePromptedDraftIdRef = useRef(null);
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 });
  const anchorFrameRef = useRef(null);
  const anchorGuardFrameRef = useRef(null);
  const isAnchoringRef = useRef(false);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const [selectedNodeIDs, setSelectedNodeIDs] = useState([]);
  const [inspectorState, setInspectorState] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [initialFitDone, setInitialFitDone] = useState(false);
  const theme = defaultAppTheme;

  const handleNodeClick = useCallback(
    (event, node) => {
      if (!node) {
        return;
      }
      const isModifierClick = event?.shiftKey || event?.metaKey || event?.ctrlKey;
      
      let nextSelection;
      if (isModifierClick) {
        // Multi-select: toggle the node in the selection
        if (selectedNodeIDs.includes(node.instanceID)) {
          // Remove from selection
          nextSelection = selectedNodeIDs.filter(id => id !== node.instanceID);
        } else {
          // Add to selection
          nextSelection = [...selectedNodeIDs, node.instanceID];
        }
      } else {
        // Single select: replace selection with just this node
        nextSelection = [node.instanceID];
      }
      
      setSelectedNodeIDs((current) =>
        areIdListsEqual(current, nextSelection) ? current : nextSelection,
      );
      onSelectionChange?.(nextSelection);
      
      if (nextSelection.length > 0) {
        setInspectorState({ nodeID: nextSelection[0], mode: 'nodeDetails' });
        setInspectorOpen(true);
      } else {
        setInspectorState(null);
        setInspectorOpen(false);
      }
    },
    [onSelectionChange, selectedNodeIDs],
  );

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const componentVersionInfo = useMemo(
    () => ({
      stateMachineDescription: {
        nodes: draft?.nodes || [],
      },
    }),
    [draft?.nodes],
  );

  const libraryVersionInfo = useMemo(() => {
    const base = versionInfo && typeof versionInfo === 'object' ? versionInfo : {};
    const description = base.stateMachineDescription || {};
    return {
      ...base,
      stateMachineDescription: {
        ...description,
        nodes: draft?.nodes || [],
      },
    };
  }, [versionInfo, draft?.nodes]);

  useEffect(() => {
    if (!draft) {
      setEdges([]);
      return;
    }
    const internalEdges = buildInternalEdges(draft.nodes);
    const exposureEdges = buildExposureEdges(draft);
    setEdges([...internalEdges, ...exposureEdges]);
  }, [draft, setEdges]);

  useEffect(() => {
    if (!draft) {
      setNameDialogOpen(false);
      return;
    }
    if (draft.mode !== 'createFromSelection') {
      setNameDialogOpen(false);
      return;
    }
    if (!draft.id) {
      return;
    }
    if (namePromptedDraftIdRef.current === draft.id) {
      return;
    }
    namePromptedDraftIdRef.current = draft.id;
    setNameDialogOpen(true);
  }, [draft]);

  const handleNameDialogResult = useCallback(
    (value) => {
      if (draft && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0 && trimmed !== draft.name) {
          onNameChange?.(trimmed);
        }
      }
      setNameDialogOpen(false);
    },
    [draft, onNameChange],
  );

  useEffect(() => {
    if (!draft) {
      setEdges([]);
      return;
    }
    const internalEdges = buildInternalEdges(draft.nodes);
    const exposureEdges = buildExposureEdges(draft);
    setEdges([...internalEdges, ...exposureEdges]);
  }, [draft, setEdges]);

  useEffect(() => {
    const ids = Array.isArray(draft?.selectedNodeIDs) ? draft.selectedNodeIDs : [];
    setSelectedNodeIDs((current) => (areIdListsEqual(current, ids) ? current : ids));
    if (ids.length > 0) {
      setInspectorState((previous) => {
        if (previous?.nodeID === ids[0]) {
          return previous;
        }
        return { nodeID: ids[0], mode: 'nodeDetails' };
      });
      setInspectorOpen(true);
    } else {
      setInspectorState(null);
      setInspectorOpen(false);
    }
  }, [draft?.selectedNodeIDs]);

  useEffect(() => {
    const selectedSet = new Set(selectedNodeIDs);
    setGraphNodes((nodes) => {
      let changed = false;
      const nextNodes = nodes.map((graphNode) => {
        const isSelected = selectedSet.has(graphNode.id);
        const matches =
          Boolean(graphNode.selected) === isSelected &&
          Boolean(graphNode.data?.isSelected) === isSelected;
        if (matches) {
          return graphNode;
        }
        changed = true;
        return {
          ...graphNode,
          selected: isSelected,
          data: {
            ...(graphNode.data || {}),
            isSelected,
          },
        };
      });
      return changed ? nextNodes : nodes;
    });
  }, [selectedNodeIDs, setGraphNodes]);

  useEffect(() => {
    setInitialFitDone(false);
  }, [draft?.id]);

  const anchorBoundaryNodes = useCallback(() => {
    if (!reactFlowInstanceRef.current) {
      return;
    }
    if (!wrapperSize.width || !wrapperSize.height) {
      return;
    }
    const projectedInput = reactFlowInstanceRef.current.project({
      x: 80,
      y: wrapperSize.height / 2,
    });
    const projectedOutput = reactFlowInstanceRef.current.project({
      x: Math.max(wrapperSize.width - 80, 80),
      y: wrapperSize.height / 2,
    });

    const previousPositions = boundaryPositionsRef.current || {};
    const inputChanged =
      !previousPositions.input || !positionsAreClose(previousPositions.input, projectedInput);
    const outputChanged =
      !previousPositions.output || !positionsAreClose(previousPositions.output, projectedOutput);

    if (!inputChanged && !outputChanged) {
      return;
    }

    boundaryPositionsRef.current = {
      input: { x: projectedInput.x, y: projectedInput.y },
      output: { x: projectedOutput.x, y: projectedOutput.y },
    };
    isAnchoringRef.current = true;

    setGraphNodes((nodes) => {
      let changed = false;
      const nextNodes = nodes.map((node) => {
        if (node.id === INPUT_NODE_ID) {
          const position = boundaryPositionsRef.current.input;
          if (!positionsAreClose(node.position, position)) {
            changed = true;
            return {
              ...node,
              position: { ...position },
            };
          }
          return node;
        }
        if (node.id === OUTPUT_NODE_ID) {
          const position = boundaryPositionsRef.current.output;
          if (!positionsAreClose(node.position, position)) {
            changed = true;
            return {
              ...node,
              position: { ...position },
            };
          }
          return node;
        }
        return node;
      });
      return changed ? nextNodes : nodes;
    });
    if (anchorGuardFrameRef.current !== null) {
      cancelAnimationFrame(anchorGuardFrameRef.current);
    }
    anchorGuardFrameRef.current = requestAnimationFrame(() => {
      anchorGuardFrameRef.current = null;
      isAnchoringRef.current = false;
    });
  }, [setGraphNodes, wrapperSize.height, wrapperSize.width]);

  const scheduleAnchorBoundary = useCallback(() => {
    if (anchorFrameRef.current !== null) {
      return;
    }
    anchorFrameRef.current = requestAnimationFrame(() => {
      anchorFrameRef.current = null;
      anchorBoundaryNodes();
    });
  }, [anchorBoundaryNodes]);

  useEffect(() => {
    if (!draft) {
      setGraphNodes([]);
      boundaryPositionsRef.current = { input: null, output: null };
      scheduleAnchorBoundary();
      return;
    }

    setGraphNodes((previous) => {
      const previousPositions = new Map(previous.map((node) => [node.id, node.position]));
      const layout = buildNodeLayout(draft.nodes || [], previousPositions);

      const aggregatorOffset = 360;
      const fallbackInput = {
        x: (layout.bounds.minX ?? 0) - aggregatorOffset,
        y: layout.bounds.midY ?? 0,
      };
      const fallbackOutput = {
        x: (layout.bounds.maxX ?? 0) + aggregatorOffset,
        y: layout.bounds.midY ?? 0,
      };

      if (!boundaryPositionsRef.current.input || !boundaryPositionsRef.current.output) {
        boundaryPositionsRef.current = {
          input: fallbackInput,
          output: fallbackOutput,
        };
      }

      const allowedInputHandles = new Set();
      (draft.availableInputs || []).forEach((entry) => {
        if (entry?.kind === 'event' && entry?.targetTrigger) {
          allowedInputHandles.add(`trigger-${entry.targetTrigger}`);
        } else if (entry?.kind === 'variable' && entry?.consumerVariable) {
          allowedInputHandles.add(`variable-${entry.consumerVariable}`);
        }
      });

      const allowedOutputHandles = new Set();
      (draft.availableOutputs || []).forEach((entry) => {
        if (entry?.producerOutput) {
          allowedOutputHandles.add(`output-${entry.producerOutput}`);
        }
      });
      (draft.availableEvents || []).forEach((entry) => {
        if (entry?.producerEvent) {
          allowedOutputHandles.add(`event-${entry.producerEvent}`);
        }
      });

      const flowNodes = [
        {
          id: INPUT_NODE_ID,
          type: 'componentBoundary',
          position: boundaryPositionsRef.current.input,
          selectable: false,
          draggable: false,
          focusable: false,
          connectable: true,
          data: {
            orientation: 'input',
            label: 'Inputs',
            ghostText: 'Drag to connect inputs',
            allowedHandleIds: Array.from(allowedInputHandles),
          },
        },
        ...layout.nodes.map((entry) => ({
          id: entry.node.instanceID,
          type: 'nodeGraphNode',
          position: entry.position,
          dragHandle: '.custom-drag-handle',
          connectable: true,
          data: {
            versionInfo: componentVersionInfo,
            node: entry.node,
            theme,
            readOnly,
            onClicked: (event) => handleNodeClick(event, entry.node),
          },
        })),
        {
          id: OUTPUT_NODE_ID,
          type: 'componentBoundary',
          position: boundaryPositionsRef.current.output,
          selectable: false,
          draggable: false,
          focusable: false,
          connectable: true,
          data: {
            orientation: 'output',
            label: 'Outputs',
            ghostText: 'Connect node outputs here',
            allowedHandleIds: Array.from(allowedOutputHandles),
          },
        },
      ];
      return flowNodes;
    });
    scheduleAnchorBoundary();
  }, [componentVersionInfo, draft, handleNodeClick, readOnly, scheduleAnchorBoundary, setGraphNodes, theme]);

  useEffect(
    () => () => {
      if (anchorFrameRef.current !== null) {
        cancelAnimationFrame(anchorFrameRef.current);
        anchorFrameRef.current = null;
      }
      if (anchorGuardFrameRef.current !== null) {
        cancelAnimationFrame(anchorGuardFrameRef.current);
        anchorGuardFrameRef.current = null;
      }
      isAnchoringRef.current = false;
    },
    [],
  );

  useEffect(() => {
    scheduleAnchorBoundary();
  }, [scheduleAnchorBoundary, draft?.id]);

  const handleInit = useCallback(
    (instance) => {
      reactFlowInstanceRef.current = instance;
      const initialViewport =
        typeof instance.getViewport === 'function'
          ? instance.getViewport()
          : { x: 0, y: 0, zoom: 1 };
      viewportRef.current = initialViewport;
      scheduleAnchorBoundary();
    },
    [scheduleAnchorBoundary],
  );

  const handleMove = useCallback((_, nextViewport) => {
    if (!nextViewport) {
      return;
    }
    const previous = viewportRef.current;
    if (viewportsAreClose(previous, nextViewport)) {
      return;
    }
    viewportRef.current = nextViewport;
    if (isAnchoringRef.current) {
      return;
    }
    scheduleAnchorBoundary();
  }, [scheduleAnchorBoundary]);

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) {
      return undefined;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = {
        width: rect.width,
        height: rect.height,
      };
      const sameWidth = Math.abs(nextSize.width - wrapperSize.width) <= 0.5;
      const sameHeight = Math.abs(nextSize.height - wrapperSize.height) <= 0.5;
      if (!sameWidth || !sameHeight) {
        setWrapperSize(nextSize);
        scheduleAnchorBoundary();
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(element);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    return undefined;
  }, [scheduleAnchorBoundary, wrapperSize.height, wrapperSize.width]);

  useEffect(() => {
    if (!draft) {
      setGraphNodes([]);
      boundaryPositionsRef.current = { input: null, output: null };
      scheduleAnchorBoundary();
      return;
    }

    setGraphNodes((previous) => {
      const previousPositions = new Map(previous.map((node) => [node.id, node.position]));
      const layout = buildNodeLayout(draft.nodes || [], previousPositions);

      const aggregatorOffset = 360;
      const fallbackInput = {
        x: (layout.bounds.minX ?? 0) - aggregatorOffset,
        y: layout.bounds.midY ?? 0,
      };
      const fallbackOutput = {
        x: (layout.bounds.maxX ?? 0) + aggregatorOffset,
        y: layout.bounds.midY ?? 0,
      };

      if (!boundaryPositionsRef.current.input || !boundaryPositionsRef.current.output) {
        boundaryPositionsRef.current = {
          input: fallbackInput,
          output: fallbackOutput,
        };
      }

      const allowedInputHandles = new Set();
      (draft.availableInputs || []).forEach((entry) => {
        if (entry?.kind === 'event' && entry?.targetTrigger) {
          allowedInputHandles.add(`trigger-${entry.targetTrigger}`);
        } else if (entry?.kind === 'variable' && entry?.consumerVariable) {
          allowedInputHandles.add(`variable-${entry.consumerVariable}`);
        }
      });

      const allowedOutputHandles = new Set();
      (draft.availableOutputs || []).forEach((entry) => {
        if (entry?.producerOutput) {
          allowedOutputHandles.add(`output-${entry.producerOutput}`);
        }
      });
      (draft.availableEvents || []).forEach((entry) => {
        if (entry?.producerEvent) {
          allowedOutputHandles.add(`event-${entry.producerEvent}`);
        }
      });

      const flowNodes = [
        {
          id: INPUT_NODE_ID,
          type: 'componentBoundary',
          position: boundaryPositionsRef.current.input,
          selectable: false,
          draggable: false,
          focusable: false,
          connectable: true,
          data: {
            orientation: 'input',
            label: 'Inputs',
            ghostText: 'Drag to connect inputs',
            allowedHandleIds: Array.from(allowedInputHandles),
          },
        },
        ...layout.nodes.map((entry) => ({
          id: entry.node.instanceID,
          type: 'nodeGraphNode',
          position: entry.position,
          dragHandle: '.custom-drag-handle',
          connectable: true,
          data: {
            versionInfo: componentVersionInfo,
            node: entry.node,
            theme,
            readOnly,
            onClicked: (event) => handleNodeClick(event, entry.node),
          },
        })),
        {
          id: OUTPUT_NODE_ID,
          type: 'componentBoundary',
          position: boundaryPositionsRef.current.output,
          selectable: false,
          draggable: false,
          focusable: false,
          connectable: true,
          data: {
            orientation: 'output',
            label: 'Outputs',
            ghostText: 'Connect node outputs here',
            allowedHandleIds: Array.from(allowedOutputHandles),
          },
        },
      ];
      return flowNodes;
    });
    scheduleAnchorBoundary();
  }, [
    componentVersionInfo,
    draft,
    handleNodeClick,
    readOnly,
    scheduleAnchorBoundary,
    setGraphNodes,
    theme,
  ]);

  const inputLookup = useMemo(() => buildInputLookup(draft), [draft]);
  const outputLookup = useMemo(() => buildOutputLookup(draft), [draft]);
  const eventLookup = useMemo(() => buildEventLookup(draft), [draft]);

  const handleEdgesChange = useCallback(
    (changes) => {
      if (!draft) {
        return;
      }
      const selectedInputs = toSelectionSet(draft.selectedInputs);
      const selectedOutputs = toSelectionSet(draft.selectedOutputs);
      const selectedEvents = toSelectionSet(draft.selectedEvents);

      changes.forEach((change) => {
        if (change.type !== 'remove') {
          return;
        }
        const existing = edgesRef.current.find((edge) => edge.id === change.id);
        if (!existing) {
          return;
        }
        const edgeData = existing.data || {};
        if (edgeData.exposureType === 'input' && edgeData.entryId) {
          if (selectedInputs.has(edgeData.entryId)) {
            onToggleInput?.(edgeData.entryId);
          }
          return;
        }
        if (edgeData.exposureType === 'output' && edgeData.entryId) {
          if (selectedOutputs.has(edgeData.entryId)) {
            onToggleOutput?.(edgeData.entryId);
          }
          return;
        }
        if (edgeData.exposureType === 'event' && edgeData.entryId) {
          if (selectedEvents.has(edgeData.entryId)) {
            onToggleEvent?.(edgeData.entryId);
          }
          return;
        }
        if (edgeData.connectionType === 'variable') {
          onRemoveConnection?.({
            type: 'variable',
            sourceInstanceID: edgeData.producerInstanceID || existing.source,
            targetInstanceID: edgeData.targetInstanceID || existing.target,
            sourceKey: edgeData.producerPort,
            targetKey: edgeData.targetPort,
          });
          return;
        }
        if (edgeData.connectionType === 'event') {
          onRemoveConnection?.({
            type: 'event',
            sourceInstanceID: edgeData.producerInstanceID || existing.source,
            targetInstanceID: edgeData.targetInstanceID || existing.target,
            sourceKey: edgeData.producerPort,
            targetKey: edgeData.targetPort,
          });
        }
      });

      internalOnEdgesChange(changes);
    },
    [
      draft,
      internalOnEdgesChange,
      onRemoveConnection,
      onToggleEvent,
      onToggleInput,
      onToggleOutput,
    ],
  );

  const removeEdges = useCallback(
    (edgesToRemove) => {
      if (!edgesToRemove || edgesToRemove.length === 0) {
        return;
      }
      const removalChanges = edgesToRemove.map((edge) => ({
        id: edge.id,
        type: 'remove',
      }));
      handleEdgesChange(removalChanges);
    },
    [handleEdgesChange],
  );

  const handleEdgeContextMenu = useCallback(
    (event, edge) => {
      event.preventDefault();
      if (!edge) {
        return;
      }
      setNodeMenu(null);
      setPaneMenu(null);
      paneDragStartRef.current = null;
      let x = event.clientX;
      let y = event.clientY;
      if (typeof window !== 'undefined') {
        const maxLeft = Math.max(16, window.innerWidth - 220);
        const maxTop = Math.max(16, window.innerHeight - 160);
        x = Math.min(x, maxLeft);
        y = Math.min(y, maxTop);
      }
      setEdgeMenu({
        edge,
        x,
        y,
      });
    },
    [],
  );

  const handleNodeContextMenu = useCallback(
    (event, graphNode) => {
      event.preventDefault();
      if (readOnly || !graphNode) {
        return;
      }

      setEdgeMenu(null);
      setPaneMenu(null);
      paneDragStartRef.current = null;

      const nextSelected = graphNode.selected ? [...selectedNodeIDs] : [graphNode.id];
      setSelectedNodeIDs((current) =>
        areIdListsEqual(current, nextSelected) ? current : nextSelected,
      );
      onSelectionChange?.(nextSelected);
      if (nextSelected.length > 0) {
        setInspectorState({ nodeID: nextSelected[0], mode: 'nodeDetails' });
        setInspectorOpen(true);
      }

      const selectedInstances = (draft?.nodes || []).filter((node) =>
        nextSelected.includes(node.instanceID),
      );

      if (selectedInstances.length === 0) {
        setNodeMenu(null);
        return;
      }

      const { x, y } = getContextMenuPosition(event.clientX, event.clientY, 220, 168);
      setNodeMenu({
        ids: nextSelected,
        nodes: selectedInstances,
        x,
        y,
      });
    },
    [
      draft?.nodes,
      onSelectionChange,
      readOnly,
      selectedNodeIDs,
      setEdgeMenu,
      setInspectorOpen,
      setInspectorState,
      setPaneMenu,
    ],
  );

  const handleSelectionContextMenu = useCallback(
    (event, selected = []) => {
      event.preventDefault();
      if (readOnly) {
        return;
      }

      const selectionIds = Array.isArray(selected) ? selected.map((node) => node.id) : [];
      if (selectionIds.length === 0) {
        return;
      }

      setEdgeMenu(null);
      setPaneMenu(null);
      paneDragStartRef.current = null;
      setSelectedNodeIDs((current) =>
        areIdListsEqual(current, selectionIds) ? current : selectionIds,
      );
      onSelectionChange?.(selectionIds);
      if (selectionIds.length > 0) {
        setInspectorState({ nodeID: selectionIds[0], mode: 'nodeDetails' });
        setInspectorOpen(true);
      }

      const selectedInstances = (draft?.nodes || []).filter((node) =>
        selectionIds.includes(node.instanceID),
      );
      if (selectedInstances.length === 0) {
        setNodeMenu(null);
        return;
      }

      const { x, y } = getContextMenuPosition(event.clientX, event.clientY, 220, 168);
      setNodeMenu({
        ids: selectionIds,
        nodes: selectedInstances,
        x,
        y,
      });
    },
    [
      draft?.nodes,
      onSelectionChange,
      readOnly,
      setEdgeMenu,
      setInspectorOpen,
      setInspectorState,
      setPaneMenu,
    ],
  );

  const clearSelection = useCallback(() => {
    if (readOnly) {
      paneDragStartRef.current = null;
      return;
    }
    setSelectedNodeIDs((current) => (current.length === 0 ? current : []));
    onSelectionChange?.([]);
    setGraphNodes((nodes) =>
      nodes.map((graphNode) => {
        if (!graphNode.selected && !graphNode.data?.isSelected) {
          return graphNode;
        }
        return {
          ...graphNode,
          selected: false,
          data: {
            ...(graphNode.data || {}),
            isSelected: false,
          },
        };
      }),
    );
    paneDragStartRef.current = null;
  }, [onSelectionChange, readOnly, setGraphNodes]);

  const handlePaneMouseDownCapture = useCallback(
    (event) => {
      if (readOnly || event.button !== 0) {
        paneDragStartRef.current = null;
        return;
      }
      const target = event.target;
      if (!(target instanceof Element) || !target.classList.contains('react-flow__pane')) {
        paneDragStartRef.current = null;
        return;
      }
      paneDragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    },
    [readOnly],
  );

  const handlePaneClick = useCallback(
    (event) => {
      setEdgeMenu(null);
      setNodeMenu(null);
      setPaneMenu(null);

      if (readOnly) {
        paneDragStartRef.current = null;
        return;
      }

      if (paneDragStartRef.current && event) {
        const deltaX = Math.abs(event.clientX - paneDragStartRef.current.x);
        const deltaY = Math.abs(event.clientY - paneDragStartRef.current.y);
        paneDragStartRef.current = null;
        if (deltaX > SELECTION_DRAG_THRESHOLD || deltaY > SELECTION_DRAG_THRESHOLD) {
          return;
        }
      } else {
        paneDragStartRef.current = null;
      }

      clearSelection();
    },
    [clearSelection, readOnly],
  );

  const handlePaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      if (readOnly) {
        return;
      }
      paneDragStartRef.current = null;
      setEdgeMenu(null);
      setNodeMenu(null);
      const { x, y } = getContextMenuPosition(event.clientX, event.clientY, 200, 120);
      setPaneMenu({ x, y });
    },
    [readOnly],
  );

  const handleSelectAll = useCallback(() => {
    if (readOnly) {
      return;
    }
    const selectableIds = graphNodes
      .filter(
        (node) =>
          node.id !== INPUT_NODE_ID && node.id !== OUTPUT_NODE_ID && node.selectable !== false,
      )
      .map((node) => node.id);
    setSelectedNodeIDs((current) =>
      areIdListsEqual(current, selectableIds) ? current : selectableIds,
    );
    onSelectionChange?.(selectableIds);
    if (selectableIds.length > 0) {
      setInspectorState({ nodeID: selectableIds[0], mode: 'nodeDetails' });
      setInspectorOpen(true);
    } else {
      setInspectorState(null);
    }
    paneDragStartRef.current = null;
    setNodeMenu(null);
    setPaneMenu(null);
  }, [graphNodes, onSelectionChange, readOnly]);

  const handleDeleteSelectedNodes = useCallback(() => {
    if (readOnly) {
      return;
    }
    const selectionSource =
      nodeMenu?.ids && nodeMenu.ids.length > 0 ? nodeMenu.ids : selectedNodeIDs;
    const selection = Array.isArray(selectionSource) ? selectionSource : [];
    if (selection.length === 0) {
      return;
    }
    onGraphAction?.('deleteNodes', { instanceIDs: selection });
    setNodeMenu(null);
    setEdgeMenu(null);
    setPaneMenu(null);
    paneDragStartRef.current = null;
  }, [nodeMenu, onGraphAction, readOnly, selectedNodeIDs]);

  const handleCreateNestedComponent = useCallback(() => {
    if (readOnly) {
      return;
    }
    const selectionSource =
      nodeMenu?.ids && nodeMenu.ids.length > 0 ? nodeMenu.ids : selectedNodeIDs;
    const selection = Array.isArray(selectionSource) ? selectionSource : [];
    if (selection.length === 0) {
      return;
    }
    alert('Nested custom components are not supported yet. Please finish editing the current component before creating another.');
    setNodeMenu(null);
    paneDragStartRef.current = null;
  }, [nodeMenu, readOnly, selectedNodeIDs]);

  const handleDeleteContextEdge = useCallback(() => {
    if (!edgeMenu?.edge) {
      return;
    }
    removeEdges([edgeMenu.edge]);
    setEdgeMenu(null);
    setNodeMenu(null);
    setPaneMenu(null);
    paneDragStartRef.current = null;
  }, [edgeMenu, removeEdges]);

  const handleEdgesDelete = useCallback(
    (edgesToDelete) => {
      removeEdges(edgesToDelete);
    },
    [removeEdges],
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!draft) {
        return;
      }
      const selectedInputs = toSelectionSet(draft.selectedInputs);
      const selectedOutputs = toSelectionSet(draft.selectedOutputs);
      const selectedEvents = toSelectionSet(draft.selectedEvents);
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target) {
        return;
      }

      if (source === INPUT_NODE_ID && targetHandle) {
        let key;
        if (targetHandle.startsWith('trigger-')) {
          key = `event::${target}::${targetHandle.replace('trigger-', '')}`;
          const entry = inputLookup.get(key);
          if (entry && !selectedInputs.has(entry.id)) {
            onToggleInput?.(entry.id);
          }
        } else if (targetHandle.startsWith('variable-')) {
          key = `variable::${target}::${targetHandle.replace('variable-', '')}`;
          const entry = inputLookup.get(key);
          if (entry && !selectedInputs.has(entry.id)) {
            onToggleInput?.(entry.id);
          }
        }
        return;
      }

      if (target === OUTPUT_NODE_ID && sourceHandle) {
        if (sourceHandle.startsWith('output-')) {
          const key = `variable::${source}::${sourceHandle.replace('output-', '')}`;
          let entry = outputLookup.get(key);
          if (!entry && draft?.availableOutputs) {
            const sourceKey = sourceHandle.replace('output-', '');
            entry = draft.availableOutputs.find(
              (candidate) =>
                candidate.nodeInstanceID === source &&
                candidate.producerOutput === sourceKey,
            );
          }
          if (!entry) {
            return;
          }
          if (!selectedOutputs.has(entry.id)) {
            onToggleOutput?.(entry.id);
          }
          const edgeId = `component-output-${entry.id}`;
          setEdges((current) => {
            if (current.some((edge) => edge.id === edgeId)) {
              return current;
            }
            const nextEdge = {
              id: edgeId,
              source: entry.nodeInstanceID,
              target: OUTPUT_NODE_ID,
              sourceHandle: `output-${entry.producerOutput}`,
              targetHandle: 'output-boundary',
              type: 'customsmartedge',
              style: boundaryEdgeStyle,
              markerEnd,
              data: {
                exposureType: 'output',
                entryId: entry.id,
                key: entry.producerOutput,
              },
            };
            return [...current, nextEdge];
          });
        } else if (sourceHandle.startsWith('event-')) {
          const key = `event::${source}::${sourceHandle.replace('event-', '')}`;
          let entry = eventLookup.get(key);
          if (!entry && draft?.availableEvents) {
            const sourceKey = sourceHandle.replace('event-', '');
            entry = draft.availableEvents.find(
              (candidate) =>
                candidate.nodeInstanceID === source &&
                candidate.producerEvent === sourceKey,
            );
          }
          if (!entry) {
            return;
          }
          if (!selectedEvents.has(entry.id)) {
            onToggleEvent?.(entry.id);
          }
          const edgeId = `component-event-${entry.id}`;
          setEdges((current) => {
            if (current.some((edge) => edge.id === edgeId)) {
              return current;
            }
            const nextEdge = {
              id: edgeId,
              source: entry.nodeInstanceID,
              target: OUTPUT_NODE_ID,
              sourceHandle: `event-${entry.producerEvent}`,
              targetHandle: 'output-boundary',
              type: 'customsmartedge',
              style: boundaryEdgeStyle,
              markerEnd,
              data: {
                exposureType: 'event',
                entryId: entry.id,
                key: entry.producerEvent,
              },
            };
            return [...current, nextEdge];
          });
        }
        return;
      }

      if (!sourceHandle || !targetHandle) {
        return;
      }

      const isVariableConnection =
        sourceHandle.startsWith('output-') && targetHandle.startsWith('variable-');
      const isEventConnection =
        sourceHandle.startsWith('event-') && targetHandle.startsWith('trigger-');

      if (isVariableConnection) {
        const sourceKey = sourceHandle.replace('output-', '');
        const targetKey = targetHandle.replace('variable-', '');
        const edgeId = `component-variable-${source}-${sourceKey}-${target}-${targetKey}`;
        setEdges((current) => {
          const filtered = current.filter(
            (edge) =>
              !(
                edge.target === target &&
                edge.targetHandle === targetHandle &&
                edge.data?.connectionType === 'variable'
              ),
          );
          if (filtered.some((edge) => edge.id === edgeId)) {
            return filtered;
          }
          const nextEdge = {
            id: edgeId,
            source,
            target,
            sourceHandle,
            targetHandle,
            type: 'customsmartedge',
            style: baseEdgeStyle,
            markerEnd,
            data: {
              connectionType: 'variable',
              producerInstanceID: source,
              producerPort: sourceKey,
              targetInstanceID: target,
              targetPort: targetKey,
            },
          };
          return [...filtered, nextEdge];
        });
        onAddConnection?.({
          type: 'variable',
          sourceInstanceID: source,
          targetInstanceID: target,
          sourceKey,
          targetKey,
        });
        return;
      }

      if (isEventConnection) {
        const sourceKey = sourceHandle.replace('event-', '');
        const targetKey = targetHandle.replace('trigger-', '');
        const edgeId = `component-trigger-${source}-${sourceKey}-${target}-${targetKey}`;
        setEdges((current) => {
          const filtered = current.filter(
            (edge) =>
              !(
                edge.target === target &&
                edge.targetHandle === targetHandle &&
                edge.data?.connectionType === 'event'
              ),
          );
          if (filtered.some((edge) => edge.id === edgeId)) {
            return filtered;
          }
          const nextEdge = {
            id: edgeId,
            source,
            target,
            sourceHandle,
            targetHandle,
            type: 'customsmartedge',
            style: baseEdgeStyle,
            markerEnd,
            data: {
              connectionType: 'event',
              producerInstanceID: source,
              producerPort: sourceKey,
              targetInstanceID: target,
              targetPort: targetKey,
            },
          };
          return [...filtered, nextEdge];
        });
        onAddConnection?.({
          type: 'event',
          sourceInstanceID: source,
          targetInstanceID: target,
          sourceKey,
          targetKey,
        });
      }
    },
    [
      draft,
      eventLookup,
      inputLookup,
      onToggleEvent,
      onToggleInput,
      onToggleOutput,
      onAddConnection,
      setEdges,
      outputLookup,
    ],
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected = [] } = {}) => {
      const ids = Array.isArray(selected) ? selected.map((item) => item.id) : [];
      setSelectedNodeIDs((current) => (areIdListsEqual(current, ids) ? current : ids));
      onSelectionChange?.(ids);
      if (ids.length > 0) {
        setInspectorState({ nodeID: ids[0], mode: 'nodeDetails' });
        setInspectorOpen(true);
      } else {
        setInspectorState(null);
      }
    },
    [onSelectionChange],
  );

  const renderInstructions = (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-xs text-slate-300 backdrop-blur">
      <div className="flex items-center gap-2 text-slate-200">
        <Info className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold uppercase tracking-[0.4em] text-slate-200">
          How it works
        </span>
      </div>
      <p>Connect the translucent boundary nodes to expose ports:</p>
      <ul className="list-disc space-y-2 pl-4 text-slate-400">
        <li>
          Drag from the left <span className="text-slate-200">Inputs</span> node
          onto any input handle to expose it.
        </li>
        <li>
          Drag from a node&rsquo;s output handle into the right{' '}
          <span className="text-slate-200">Outputs</span> node to expose data or
          events.
        </li>
        <li>
          Rewire nodes by connecting outputs directly to other nodes&rsquo; inputs, or select an edge and press Delete to remove it.
        </li>
        <li>
          Select a boundary edge and press delete to remove the exposure.
        </li>
      </ul>
      <p>
        Open <span className="text-slate-200">Settings</span> to edit metadata or
        toggle exposures with checkboxes.
      </p>
    </div>
  );

  const inspectorNode = useMemo(() => {
    if (!inspectorState?.nodeID) {
      return null;
    }
    return (draft?.nodes || []).find(
      (node) => node.instanceID === inspectorState.nodeID,
    ) || null;
  }, [draft?.nodes, inspectorState]);

  const inspectorContent = inspectorNode ? (
    <NodeSettingsMenu
      node={inspectorNode}
      nodes={draft?.nodes || []}
      onChange={onNodeValueChange}
      onNodeStructureChange={onNodeStructureChange}
      onPersonaListChange={onPersonaListChange}
      readOnly={readOnly}
      versionInfo={libraryVersionInfo}
    />
  ) : (
    <p className="text-sm text-slate-300">Select a node to edit its settings.</p>
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }, []);

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const rawPayload = event.dataTransfer?.getData('application/reactflow');
      if (!rawPayload) {
        return;
      }
      try {
        const payload = JSON.parse(rawPayload);
        if (payload?.action === 'add') {
          onGraphAction?.('addTemplate', { template: payload.template });
        } else if (payload?.action === 'duplicate') {
          onGraphAction?.('duplicateNode', { node: payload.node });
        } else if (payload?.action === 'addCustomComponent') {
          onGraphAction?.('addCustomComponent', { componentID: payload.componentID });
        }
      } catch (error) {
        console.warn('CustomComponentEditor: Unable to process drop payload', error);
      }
    },
    [onGraphAction],
  );

  useEffect(() => {
    if (!reactFlowInstanceRef.current) {
      return;
    }
    if (!graphNodes.length) {
      return;
    }
    if (initialFitDone) {
      return;
    }
    requestAnimationFrame(() => {
      try {
        reactFlowInstanceRef.current.fitView({ padding: 0.24, includeHiddenNodes: true });
      } catch (error) {
        console.warn('CustomComponentEditor: fitView failed', error);
      }
      setInitialFitDone(true);
    });
  }, [graphNodes, initialFitDone]);

  if (!draft) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[12000] flex flex-col bg-slate-950/95 text-slate-100">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-8 py-5">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
              Custom Component Editor
            </span>
            <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <span>{draft.name || 'Untitled Component'}</span>
              {draft.description ? (
                <span className="text-sm font-normal text-slate-500">
                  &mdash; {draft.description}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/10"
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave?.(draft)}
              className="rounded-full bg-sky-500/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_-25px_rgba(56,189,248,0.8)] transition hover:bg-sky-400/90 focus:outline-none focus:ring-2 focus:ring-sky-300/50"
            >
              Save Component
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-8 py-6">
          <div className="hidden w-72 shrink-0 lg:flex lg:flex-col lg:gap-4">
            <div className="flex-1 overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/60 p-3 shadow-[0_35px_90px_-60px_rgba(56,189,248,0.4)] backdrop-blur">
              <NodeLibraryTree versionInfo={libraryVersionInfo} readOnly={readOnly} />
            </div>
            <div className="hidden lg:block">{renderInstructions}</div>
          </div>
          <div
            ref={wrapperRef}
            className="relative flex-1 overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/70 shadow-[0_45px_120px_-80px_rgba(56,189,248,0.65)]"
          >
            <ReactFlowProvider>
              <ReactFlow
                nodes={graphNodes}
                edges={edges}
                onInit={handleInit}
                onMove={handleMove}
                onNodesChange={internalOnNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onEdgesDelete={handleEdgesDelete}
              onEdgeContextMenu={handleEdgeContextMenu}
              onNodeContextMenu={handleNodeContextMenu}
              onSelectionContextMenu={handleSelectionContextMenu}
              onMouseDownCapture={handlePaneMouseDownCapture}
              onPaneClick={handlePaneClick}
              onPaneContextMenu={handlePaneContextMenu}
              onSelectionChange={handleSelectionChange}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{
                  type: 'customsmartedge',
                  markerEnd,
                  style: baseEdgeStyle,
                }}
                connectionLineComponent={CustomConnectionLine}
                connectionLineStyle={connectionLineStyle}
                defaultViewport={defaultViewport}
                minZoom={0.2}
                maxZoom={1.8}
                className="!bg-transparent"
                panOnDrag={[2]}
                selectionOnDrag
                selectNodesOnDrag
                selectionMode="partial"
                selectionKeyCode={null}
                autoPanOnConnect
                autoPanOnNodeDrag={false}
                nodesConnectable
                nodesDraggable
                elementsSelectable
                edgesFocusable
                deleteKeyCode={['Delete', 'Backspace']}
              >
                <Controls className="!bg-slate-900/80 !text-slate-100" />
              </ReactFlow>
            </ReactFlowProvider>
            {nodeMenu
              ? createPortal(
                  <div
                    className="fixed inset-0 z-[13040]"
                    onClick={() => setNodeMenu(null)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <div
                      className="absolute min-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-1 text-sm text-slate-100 shadow-xl backdrop-blur"
                      style={{ top: nodeMenu.y, left: nodeMenu.x }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium hover:bg-white/10"
                        onClick={handleDeleteSelectedNodes}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>
                          Delete {nodeMenu.ids && nodeMenu.ids.length > 1 ? 'Nodes' : 'Node'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium hover:bg-white/10"
                        onClick={handleCreateNestedComponent}
                      >
                        <PackagePlus className="h-4 w-4" />
                        <span>Create Custom Component</span>
                      </button>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
            {paneMenu
              ? createPortal(
                  <div
                    className="fixed inset-0 z-[13035]"
                    onClick={() => setPaneMenu(null)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <div
                      className="absolute min-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-1 text-sm text-slate-100 shadow-xl backdrop-blur"
                      style={{ top: paneMenu.y, left: paneMenu.x }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium hover:bg-white/10"
                        onClick={handleSelectAll}
                      >
                        <SquareStack className="h-4 w-4" />
                        <span>Select All</span>
                      </button>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
            {edgeMenu
              ? createPortal(
                  <div
                    className="fixed inset-0 z-[13040]"
                    onClick={() => setEdgeMenu(null)}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <div
                      className="absolute min-w-[160px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-1 text-sm text-slate-100 shadow-xl backdrop-blur"
                      style={{ top: edgeMenu.y, left: edgeMenu.x }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2 text-left font-medium hover:bg-white/10"
                        onClick={handleDeleteContextEdge}
                      >
                        Delete Connection
                      </button>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
            <div className="pointer-events-none absolute inset-8 rounded-[2rem] border border-white/5" />
            <FloatingPanel
              title="Inspector"
              icon={<Info className="h-4 w-4 text-sky-300" />}
              positionClass="hidden xl:block absolute right-6 top-1/2 -translate-y-1/2"
              open={inspectorOpen && Boolean(inspectorNode)}
              onOpenChange={(open) => {
                if (!open) {
                  setInspectorOpen(false);
                } else if (inspectorNode) {
                  setInspectorOpen(true);
                }
              }}
              size="lg"
              actions={
                inspectorNode ? (
                  <button
                    type="button"
                    onClick={() => setInspectorOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 transition hover:border-white/30 hover:text-white"
                    aria-label="Close inspector"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null
              }
            >
              <div className="space-y-4">{inspectorContent}</div>
            </FloatingPanel>
          </div>
        </div>
        <div className="px-8 pb-6 lg:hidden">
          <div className="mb-4 rounded-3xl border border-white/10 bg-slate-950/70 p-3 shadow-[0_30px_80px_-60px_rgba(56,189,248,0.45)] backdrop-blur">
            <NodeLibraryTree versionInfo={libraryVersionInfo} readOnly={readOnly} />
          </div>
          {renderInstructions}
        </div>
        {inspectorOpen && inspectorNode ? (
          <div className="px-8 pb-6 xl:hidden">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_80px_-60px_rgba(56,189,248,0.55)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                  Inspector
                </span>
                <button
                  type="button"
                  onClick={() => setInspectorOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-slate-200 transition hover:border-white/30 hover:text-white"
                  aria-label="Close inspector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">{inspectorContent}</div>
            </div>
          </div>
        ) : null}
      </div>

      {settingsOpen ? (
        <SettingsModal
          draft={draft}
          onClose={() => setSettingsOpen(false)}
          onNameChange={onNameChange}
          onDescriptionChange={onDescriptionChange}
          onToggleInput={onToggleInput}
          onToggleOutput={onToggleOutput}
          onToggleEvent={onToggleEvent}
          onLibraryChange={onLibraryChange}
        />
      ) : null}

      <TextDialog
        shown={nameDialogOpen}
        label="Name Custom Component"
        currentText={draft?.name || ''}
        onNewText={handleNameDialogResult}
        layerClassName="z-[20000]"
      />
    </>
  );
}
