'use client';
import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import ReactFlow, { 
    useNodesState, 
    useEdgesState, 
    MarkerType,
    ReactFlowProvider,
    Controls,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodeGraphNode from "./nodegraphnode";
import SelfConnectingEdge from './customedges/selfconnectingedge';
import CustomSmartEdge from './customedges/customsmartedge';
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge'
import CurvyEdge from './customedges/curvyedge';
import { createPortal } from 'react-dom';
import { Copy, Trash2, ClipboardPaste, SquareStack, PackagePlus, SplitSquareHorizontal } from 'lucide-react';
import FloatingEdge from './customedges/floatingedge';
import CustomConnectionLine from './customedges/customconnectionline';
import { copyDataToClipboard, pasteDataFromClipboard } from "@src/client/clipboard";
import { callGetBlob, callUploadBlob } from "@src/client/blobclient";
import { stateManager } from "@src/client/statemanager";
import { nullUndefinedOrEmpty } from "@src/common/objects";

const nodeTypes = {
    nodeGraphNode: NodeGraphNode,
  };

const edgeTypes = {
    customsmartedge: CustomSmartEdge,
    selfconnecting: SelfConnectingEdge,
    curvyedge: CurvyEdge,
    smartedge: SmartBezierEdge,
    floating: FloatingEdge,
  };

const defaultViewport = { x: 0, y: 0, zoom: 0.75 };
const edgeStyle = {
    strokeWidth: 2,
    stroke: '#38bdf8' 
}; // Bright pink color

const makerEndStyle = {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: '#38bdf8',
}

const connectionLineStyle = {
  strokeWidth: 3,
  stroke: '#38bdf8',
};


const defaultEdgeOptions = {
    style: connectionLineStyle,
    type: 'customsmartedge',
    markerEnd: makerEndStyle,
  };


const INLINE_PAYLOAD_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB
const BASE64_DELIMITER = 'base64,';

function dataUrlToBase64(dataUrl) {
  if (typeof dataUrl !== 'string') {
    return null;
  }
  const markerIndex = dataUrl.indexOf(BASE64_DELIMITER);
  if (markerIndex === -1) {
    return null;
  }
  return dataUrl.substring(markerIndex + BASE64_DELIMITER.length);
}

function base64ByteLength(base64) {
  if (typeof base64 !== 'string') {
    return 0;
  }
  const length = base64.length;
  if (length === 0) {
    return 0;
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((length * 3) / 4) - padding;
}

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let index = -1;
  let value = bytes;
  do {
    value /= 1024;
    index += 1;
  } while (value >= 1024 && index < units.length - 1);
  return `${value.toFixed(1)} ${units[index]}`;
}

function base64ToFile(base64, fileName, mimeType) {
  if (typeof atob !== 'function' || typeof Uint8Array === 'undefined' || typeof File === 'undefined') {
    throw new Error('Binary conversion APIs are unavailable in this environment.');
  }

  const binaryString = atob(base64);
  const byteArray = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    byteArray[i] = binaryString.charCodeAt(i);
  }

  return new File([byteArray], fileName, { type: mimeType });
}



const ContextMenu = ({ open, position, onClose, children }) => {
  if (!open || !position || typeof window === 'undefined') {
    return null;
  }

  const maxLeft = Math.max(16, window.innerWidth - 220);
  const maxTop = Math.max(16, window.innerHeight - 200);
  const left = Math.min(position.left, maxLeft);
  const top = Math.min(position.top, maxTop);

  return createPortal(
    <div
      className="fixed inset-0 z-[90]"
      onClick={() => onClose?.()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        className="absolute z-[95]"
        style={{ top, left }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-[180px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-1 shadow-xl backdrop-blur">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child, { onClose })
              : child
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const ContextMenuItem = ({ icon, children, onSelect, onClose }) => (
  <button
    type="button"
    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-100 transition hover:bg-white/10"
    onClick={(event) => {
      event.stopPropagation();
      onSelect?.(event);
      onClose?.();
    }}
  >
    {icon && <span className="flex h-4 w-4 items-center justify-center text-slate-300">{icon}</span>}
    <span className="flex-1">{children}</span>
  </button>
);

export function NodeGraphDisplay(params) {
    const { theme, versionInfo, onNodeClicked, onEdgeClicked, onNodeStructureChange, onPersonaListChange, readOnly } = params;
    const nodes = versionInfo?.stateMachineDescription?.nodes ?? [];
    const [graphNodes, setGraphNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);  
    const [nodeMenu, setNodeMenu] = useState(null);
    const [edgeMenu, setEdgeMenu] = useState(null);
    const [paneMenu, setPaneMenu] = useState(null);
    const ref = useRef(null);
    const [doneInitialFitView, setDoneInitialFitView] = useState(false);
    const { session } = useContext(stateManager);
    const activeSessionID = session?.sessionID ?? null;

    // Prevent the browser's context menu from appearing
    useEffect(() => {
        const handleContextMenu = (event) => {
          event.preventDefault();
        };
      
        document.addEventListener('contextmenu', handleContextMenu);
      
        return () => {
          document.removeEventListener('contextmenu', handleContextMenu);
        };
      }, []);
      
    useEffect(() => {
        if (reactFlowInstance && graphNodes && graphNodes.length > 0 && !doneInitialFitView) {
            reactFlowInstance.fitView({ padding: 0.2 });
            setDoneInitialFitView(true);
        }
    }, [graphNodes, edges, reactFlowInstance]); // Depend on nodes, edges, and the instance
  
    // Function to handle the React Flow onLoad event
    const onInit = (reactFlowInstance) => {
        setReactFlowInstance(reactFlowInstance);
    };

    function findGraphNode(graphList, nodeInstanceID) {
        return graphList.find((node) => node.id === nodeInstanceID);
    }

    function findGraphEdge(edgeList, id) {
        return edgeList.find((edge) => edge.id === id);
    
    }

    const handleNodeClicked = (node) => {
        onNodeClicked?.(node);
    }

    const handleEdgeClicked = (edge) => {
        const producerNode = nodes.find((node) => node.instanceID === edge.source);
        const consumerNode = nodes.find((node) => node.instanceID === edge.target);
        onEdgeClicked?.(producerNode, consumerNode);
    }

    useEffect(() => {
        const nodes = versionInfo?.stateMachineDescription?.nodes;
        if (!nodes) {
            setGraphNodes([]);
            setEdges([]);
            return;
        }

        const stateMachineNodes = nodes;
        if (stateMachineNodes.length === 0) {
            // set graph and edges to empty
            setGraphNodes([]);
            setEdges([]);
            return;
        }
        
        if (stateMachineNodes[0].nodeType !== "start") {
            throw new Error('NodeGraphDisplay: stateMachineNodes does not start with a start node!');
        }

            // Generate a hash table of all nodes consuming a given instanceID
            let consumerNodesMap = {};
            let stateMachineNodesMap = {};
            stateMachineNodes.forEach(node => {
                stateMachineNodesMap[node.instanceID] = node;
                if (node.inputs && node.inputs.length > 0) {
                    node.inputs.forEach(input => {
                        if (!consumerNodesMap[input.producerInstanceID]) {
                            consumerNodesMap[input.producerInstanceID] = [];
                        }
                        consumerNodesMap[input.producerInstanceID].push(node);
                    });
                }
            });


            function exploreSubgraph(node, visited, subgraph) {
                let stack = [node];
                while (stack.length > 0) {
                    let current = stack.pop();
                    if (!visited.has(current.instanceID)) {
                        visited.add(current.instanceID);
                        subgraph.nodes.push(current);
                        // Add all consumer nodes to the stack
                        (consumerNodesMap[current.instanceID] || []).forEach(consumer => {
                            if (!visited.has(consumer.instanceID)) {
                                stack.push(consumer);
                            }
                        });
                        // add all input nodes to the stack
                        (current.inputs || []).forEach(input => {
                            if (stateMachineNodesMap[input.producerInstanceID] && !visited.has(input.producerInstanceID)) {
                                stack.push(stateMachineNodesMap[input.producerInstanceID]);
                            }
                        });
                    }
                }
            }
                        
            let visited = new Set();
            let subgraphs = [];
            
            // Explore from each node that hasn't been positioned yet
            stateMachineNodes.forEach(node => {
                if (!visited.has(node.instanceID)) {
                    let subgraph = {};
                    subgraph.nodes = [];
                    exploreSubgraph(node, visited, subgraph);
                    subgraphs.push(subgraph);
                }
            });

            function findLongestPath(subgraph) {
                // We will work back from the ends. First check to see if there are any "end" nodes without any consumers
                let endNodes = subgraph.nodes.filter(node => node.nodeType === "end" && (!consumerNodesMap[node.instanceID] || consumerNodesMap[node.instanceID].length == 0));
                if (endNodes.length == 0) {
                    // If there are no "end" nodes without consumers, then add all the nodes to the list
                    endNodes = subgraph.nodes;
                }

                function findLongestPathFromNode(pathSoFar, node) {
                    let newPath = [node, ...pathSoFar];
                    let longestPath = newPath;
                    // add all input nodes to the stack, working backwards
                    (node.inputs || []).forEach(input => {
                        if (stateMachineNodesMap[input.producerInstanceID] && !pathSoFar.find(node => node.instanceID === input.producerInstanceID)) {
                            let path = findLongestPathFromNode(newPath, stateMachineNodesMap[input.producerInstanceID]);
                            if (path.length > longestPath.length) {
                                longestPath = path;
                            }
                        }
                    });
                    return longestPath;
                }

                let longestPath = [];
                endNodes.forEach(node => {
                    let path = findLongestPathFromNode([], node);
                    if (path.length > longestPath.length) {
                        longestPath = path;
                    }    
                });
                return longestPath;
            }

            function calculateLayersForSubgraph(subgraph) {
                
                subgraph.layers = [];
                subgraph.positioned = {};

                // First, find the longest path through the subgraph
                let longestPath = findLongestPath(subgraph);

                // Now, create layers based on the longest path
                for (let i=0; i<longestPath.length; i++) {
                    let node = longestPath[i];
                    subgraph.layers.push([node]);
                    subgraph.positioned[node.instanceID] = true;
                }

                //
                // Now place the remaining nodes
                //
                let changed = false;
                do {
                    changed = false;
                    let currentLayerIndex = 0;
                    while (currentLayerIndex < subgraph.layers.length) {
                        let currentLayer = subgraph.layers[currentLayerIndex];

                        for (let j=0; j < currentLayer.length; j++) {
                            const node = currentLayer[j];
                            // first, process consumers of this node
                            const consumers = consumerNodesMap[node.instanceID] || [];
                            for (let k=0; k<consumers.length; k++) {
                                const consumer = consumers[k];
                                if (!subgraph.positioned[consumer.instanceID]) {
                                    let targetLayer = currentLayerIndex+1;
                                    if (!subgraph.layers[targetLayer]) {
                                        subgraph.layers[targetLayer] = [];
                                    }
                                    subgraph.layers[targetLayer].push(consumer);
                                    subgraph.positioned[consumer.instanceID] = true;
                                    changed = true;
                                }
                            }
                            // Now process inputs
                            if (node.inputs && node.inputs.length > 0) {
                                for (let k=0; k<node.inputs.length; k++) {
                                    const input = node.inputs[k];
                                    const inputNode = stateMachineNodesMap[input.producerInstanceID];
                                    if (!inputNode) {
                                        console.warn("calculateLayersForSubgraph: missing producer node", input.producerInstanceID);
                                        continue;
                                    }

                                    if (!subgraph.positioned[inputNode.instanceID]) {
                                        let targetLayer = currentLayerIndex-1;
                                        if (targetLayer == 0 && subgraph.layers[0].find(node => node.nodeType === "start")) {
                                            // special case - if the 0th layer contains the special 'start' node, then insert a new 1st layer before this one
                                            targetLayer = 1;
                                            subgraph.layers.splice(targetLayer, 0, []);
                                            currentLayerIndex++;
                                        } else if (targetLayer < 0) {
                                            // special case - if we're trying to insert a layer before the 0th layer, then insert a new 0th layer before this one
                                            targetLayer = 0;
                                            subgraph.layers.splice(targetLayer, 0, []);
                                            currentLayerIndex++;
                                        } 
                                        subgraph.layers[targetLayer].push(inputNode);
                                        subgraph.positioned[inputNode.instanceID] = true;
                                        console.log("Found unpositioned input node: ", inputNode.instanceName, " currentLayerIndex=", currentLayerIndex, " targetLayer=", targetLayer);
                                        changed = true;
                                    }
                                }
                            }
                        }
                        currentLayerIndex++;
                    }
                } while (changed);
            }

            //
            // ACTUALLY CALCULATE LAYERS
            //

            subgraphs.forEach(subgraph => calculateLayersForSubgraph(subgraph));
            
            // Constants for layout
            const heightPerNode = 180;
            const widthPerNode = 380;
            const center = 140;
            let verticalOffset = heightPerNode + 20;  // Adjust based on desired spacing
            let positions = {};  // Object to store positions for each node

            // Find the length of the longest layer within any subgraph
            const maxLayersInAnySubgraph = Math.max(...subgraphs.map(subgraph => subgraph.layers.length));
            const longestLayerWidth = maxLayersInAnySubgraph * widthPerNode;


            // find the subgraph index containing the special "start" node
            let startSubgraphIndex = subgraphs.findIndex(subgraph => subgraph.nodes.find(node => node.nodeType === "start"));

            // Start Y offset initialization
            let subgraphStartYOffset = 0;

            subgraphs.forEach((subgraph, subgraphIndex) => {
                let rowStartY = center + subgraphStartYOffset;  // Starting Y position for each subgraph
                let maxLayerHeight = Math.max(...subgraph.layers.map(layer => layer.length));
                const totalSubgraphHeight = maxLayerHeight * heightPerNode;
                let subgraphWidth = subgraph.layers.length * widthPerNode;

                // Calculate nodeXStart differently based on if this is the start subgraph
                let nodeXStart;
                if (subgraphIndex === startSubgraphIndex) {
                    // Place the start node's subgraph on the far left
                    nodeXStart = center - longestLayerWidth;
                } else {
                    // Right-align non-start subgraphs
                    nodeXStart = center - subgraphWidth;
                }

                for (let k = 0; k < subgraph.layers.length; k++) {
                    const layer = subgraph.layers[k];
                    let nodeX = nodeXStart + (k * widthPerNode);  // Start position for each layer

                    for (let i = 0; i < layer.length; i++) {
                        const node = layer[i];
                        positions[node.instanceID] = { x: nodeX, y: rowStartY + (i * heightPerNode) };  // Vertically stack nodes in the same layer
                    }
                }

                // Calculate the total vertical space used by this subgraph
                subgraphStartYOffset += totalSubgraphHeight + 160;  // Increment yOffset for the next subgraph dynamically
            });

            setGraphNodes((nds) =>
                stateMachineNodes.map((node) => {
                    const existingNode = findGraphNode(nds, node.instanceID);
                    const baseNode = {
                        id: node.instanceID,
                        type: 'nodeGraphNode',
                        dragHandle: '.custom-drag-handle',
                    };
                    const nextData = {
                        ...(existingNode?.data ?? {}),
                        versionInfo,
                        node,
                        theme,
                        readOnly,
                        onClicked: () => handleNodeClicked(node),
                        label: node.instanceName,
                    };

                    return {
                        ...(existingNode ?? baseNode),
                        ...baseNode,
                        position: positions[node.instanceID],
                        data: nextData,
                    };
                })
            );
            
            setEdges((eds) => {
                let newEdges = [];
                for (let j=0; j<stateMachineNodes.length; j++) {
                    const node = stateMachineNodes[j];
                    if (node.inputs && node.inputs.length > 0) {
                        for (let i=0; i<node.inputs.length; i++) {
                            const input = node.inputs[i];
                            /*
                              inputs: [
                                {
                                  producerInstanceID: "instanceID",
                                  triggers: [
                                      producerEvent: 'completed',
                                      targetTrigger: 'default',
                                      // default parameters
                                      includeHistory: false,
                                      historyParams: {
                                        //...
                                      }
                                    ],
                                   variables: [
                                    producerOutput: <producerOutputVariableName>,
                                    consumerVariable: <consumerVariableName>,
                                   ],
                                }
                              ]
                      
                      
                            */
                            if (input.triggers) {
                                for (let k=0; k<input.triggers.length; k++) {
                                    const trigger = input.triggers[k];
                                    const edgeID = `e-trigger-${input.producerInstanceID}-${trigger.producerEvent}-${trigger.targetTrigger}-${node.instanceID}`;
                                    let edge = findGraphEdge(eds, edgeID);
                                    if (!edge) {
                                        edge = {
                                            id: edgeID,
                                            source: input.producerInstanceID, 
                                            target: node.instanceID,
                                            sourceHandle: `event-${trigger.producerEvent}`,
                                            targetHandle: `trigger-${trigger.targetTrigger}`,
                                            type: 'customsmartedge',
                                            style: edgeStyle,
                                            markerEnd: makerEndStyle,
                                        };
                                    }
                                    newEdges.push(edge);
                                }
                            }
                            if (input.variables) {
                                for (let k=0; k<input.variables.length; k++) {
                                    const variable = input.variables[k];
                                    const edgeID = `e-variable-${input.producerInstanceID}-${variable.producerOutput}-${variable.consumerVariable}-${node.instanceID}`;
                                    let edge = findGraphEdge(eds, edgeID);
                                    if (!edge) {
                                        edge = {
                                            id: edgeID,
                                            source: input.producerInstanceID, 
                                            target: node.instanceID,
                                            sourceHandle: `output-${variable.producerOutput}`,
                                            targetHandle: `variable-${variable.consumerVariable}`,
                                            type: 'customsmartedge',
                                            style: edgeStyle,
                                            markerEnd: makerEndStyle,
                                        };
                                    }
                                    newEdges.push(edge);
                                }
                            }
                        }
                    }
                }
                return newEdges;
            });
    }, [versionInfo, theme, readOnly]);


    useEffect(() => {
        if (!selectedNodes) {
            return;
        }

        const selectedSet = new Set(selectedNodes);
        setGraphNodes((nds) =>
            nds.map((graphNode) => {
                const nextSelected = selectedSet.has(graphNode.id);
                if (graphNode.data?.isSelected === nextSelected) {
                    return graphNode;
                }

                return {
                    ...graphNode,
                    data: {
                        ...graphNode.data,
                        isSelected: nextSelected,
                    },
                };
            })
        );
    }, [selectedNodes]);
    
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      if (readOnly) {
        return;
      }

      const eventData = event.dataTransfer.getData('application/reactflow');

      if (!eventData) {
        return;
      }

      try {
        const dropAction = JSON.parse(eventData);

        if (dropAction.action === "add") {
          onNodeStructureChange?.(null, "add", { templateName: dropAction.template });
        } else if (dropAction.action === "duplicate") {
          onNodeStructureChange?.(dropAction.node, "duplicate", {});
        } else if (dropAction.action === "addCustomComponent" && dropAction.componentID) {
          onNodeStructureChange?.(null, "addCustomComponentInstance", { componentID: dropAction.componentID });
        }
      } catch (e) {
        return;
      }
    },
    [readOnly, onNodeStructureChange],
  );

      const onNodeContextMenu = useCallback(
        (event, node) => {
          // Prevent native context menu from showing
          event.preventDefault();
          if (readOnly) { return };
            
          if (!node.selected) {
            setSelectedNodes([node.id]);
            setGraphNodes((nds) => nds.map((graphNode) => {
                if (graphNode.id === node.id) {
                    graphNode = {
                        ...graphNode,
                        selected: true,
                    }
                } else {
                    graphNode = {
                        ...graphNode,
                        selected: false,
                    }
                }
                return graphNode;
            }));
          }

          // Calculate position of the context menu. We want to make sure it
          // doesn't get positioned off-screen.
          const pane = ref.current.getBoundingClientRect();
          const nodeInstance = nodes.find((n) => n.instanceID === node.id);
          let newNodeMenu = nodeInstance
            ? { nodes: [nodeInstance], top: event.clientY, left: event.clientX }
            : null;
          setNodeMenu(newNodeMenu);
        },
        [setNodeMenu, nodes, readOnly],
      );
      
    const hydrateFilePayloadForClipboard = useCallback(async (nodeCopies) => {
        const summary = {
            attempted: 0,
            succeeded: 0,
            totalBytes: 0,
            errors: [],
            skippedSession: false,
            skippedSizeLimit: false,
        };

        if (!Array.isArray(nodeCopies) || nodeCopies.length === 0) {
            return summary;
        }

        const storageReferences = [];
        nodeCopies.forEach((node, nodeIndex) => {
            const files = node?.params?.files;
            if (!Array.isArray(files) || files.length === 0) {
                return;
            }
            files.forEach((entry, fileIndex) => {
                const fileDescriptor = entry?.file;
                if (fileDescriptor?.source === 'storage' && fileDescriptor?.data) {
                    storageReferences.push({
                        nodeIndex,
                        fileIndex,
                        blobID: fileDescriptor.data,
                        fileName: entry?.fileName ?? `file-${fileIndex + 1}`,
                    });
                }
            });
        });

        summary.attempted = storageReferences.length;

        if (storageReferences.length === 0) {
            return summary;
        }

        if (!activeSessionID) {
            summary.skippedSession = true;
            return summary;
        }

        const uniqueBlobIDs = Array.from(new Set(storageReferences.map((ref) => ref.blobID)));
        const blobCache = new Map();
        const failedBlobIDs = new Map();

        await Promise.all(
            uniqueBlobIDs.map(async (blobID) => {
                try {
                    const response = await callGetBlob(activeSessionID, blobID);
                    const base64 = dataUrlToBase64(response?.url);
                    if (!base64) {
                        failedBlobIDs.set(blobID, 'No data returned');
                        return;
                    }
                    blobCache.set(blobID, {
                        base64,
                        mimeType: response?.mimeType ?? 'application/octet-stream',
                        byteLength: base64ByteLength(base64),
                    });
                } catch (error) {
                    const reason = error instanceof Error ? error.message : String(error);
                    failedBlobIDs.set(blobID, reason);
                }
            })
        );

        const mutatedEntries = [];

        storageReferences.forEach(({ nodeIndex, fileIndex, blobID, fileName }) => {
            const targetFile = nodeCopies[nodeIndex]?.params?.files?.[fileIndex]?.file;
            if (!targetFile) {
                return;
            }

            if (failedBlobIDs.has(blobID)) {
                const reason = failedBlobIDs.get(blobID);
                summary.errors.push(`${fileName}: ${reason}`);
                return;
            }

            const cacheEntry = blobCache.get(blobID);
            if (!cacheEntry) {
                summary.errors.push(`${fileName}: Unknown error`);
                return;
            }

            targetFile.inlineData = {
                base64: cacheEntry.base64,
                mimeType: cacheEntry.mimeType,
                byteLength: cacheEntry.byteLength,
                originalBlobID: blobID,
            };
            mutatedEntries.push({ nodeIndex, fileIndex });
            summary.succeeded += 1;
            summary.totalBytes += cacheEntry.byteLength;
        });

        if (summary.totalBytes > INLINE_PAYLOAD_LIMIT_BYTES) {
            mutatedEntries.forEach(({ nodeIndex, fileIndex }) => {
                const targetFile = nodeCopies[nodeIndex]?.params?.files?.[fileIndex]?.file;
                if (targetFile?.inlineData) {
                    delete targetFile.inlineData;
                }
            });
            summary.skippedSizeLimit = true;
            summary.succeeded = 0;
            summary.totalBytes = 0;
        }

        return summary;
    }, [activeSessionID]);

    const uploadInlineFilesForNodes = useCallback(async (nodesPayload) => {
        const summary = {
            total: 0,
            uploaded: 0,
            errors: [],
        };

        if (!Array.isArray(nodesPayload) || nodesPayload.length === 0) {
            return summary;
        }

        const entries = [];
        nodesPayload.forEach((node, nodeIndex) => {
            const files = node?.params?.files;
            if (!Array.isArray(files) || files.length === 0) {
                return;
            }

            files.forEach((entry, fileIndex) => {
                const inlineData = entry?.file?.inlineData;
                if (inlineData?.base64 && inlineData?.mimeType) {
                    entries.push({
                        nodeIndex,
                        fileIndex,
                        inlineData,
                        fileName: entry?.fileName ?? `file-${fileIndex + 1}`,
                    });
                }
            });
        });

        summary.total = entries.length;

        for (let i = 0; i < entries.length; i += 1) {
            const { nodeIndex, fileIndex, inlineData, fileName } = entries[i];
            const targetFile = nodesPayload[nodeIndex]?.params?.files?.[fileIndex]?.file;
            if (!targetFile) {
                continue;
            }

            try {
                const fileObject = base64ToFile(inlineData.base64, fileName, inlineData.mimeType);
                const uploadResult = await callUploadBlob(fileObject, fileName);
                if (!uploadResult?.blobID) {
                    throw new Error('Upload did not return a blob identifier.');
                }

                targetFile.data = uploadResult.blobID;
                targetFile.mimeType = uploadResult.mimeType ?? inlineData.mimeType;
                targetFile.source = 'storage';
                delete targetFile.inlineData;
                summary.uploaded += 1;
            } catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                summary.errors.push(`${fileName}: ${reason}`);
            }
        }

        // Ensure no inline data remains, even if upload was skipped
        nodesPayload.forEach((node) => {
            const files = node?.params?.files;
            if (!Array.isArray(files)) {
                return;
            }
            files.forEach((entry) => {
                if (entry?.file?.inlineData) {
                    delete entry.file.inlineData;
                }
            });
        });

        return summary;
    }, []);

    const handleDeleteNodes = (event) => {
        event.preventDefault();
        if (readOnly) { return };

        if (!selectedNodes || selectedNodes.length == 0) {
            return;
        }
        handleDeleteNodesByID(event, selectedNodes);
    }

    const handleDeleteNodesByID = (event, nodeIDs) => {
        event.preventDefault();
        if (readOnly) { return };

        for (let i=0; i<nodeIDs.length; i++) {
            const node = nodes.find((n) => n.instanceID === nodeIDs[i]);
            // delete so long as it's not the start node
            if (node && node.nodeType !== "start") {
                onNodeStructureChange?.(node, "delete", {});
            }
        }
        setNodeMenu(null);
    }




    const onConnect = (params) => {
        console.log("onConnect: ", params)
        const { source, target, sourceHandle, targetHandle } = params;
        // parse sourceHandle into <sourceType>-<sourceName>
        const [sourceType, sourceName] = sourceHandle.split('-');
        // parse targetHandle into <targetType>-<targetName>
        const [targetType, targetName] = targetHandle.split('-');
        // if any of the variables above is null throw an error
        if (!source || !target || !sourceType || !sourceName || !targetType || !targetName) {
            throw new Error('onConnect: source, target, sourceType, sourceName, targetType, targetName cannot be null ' + source + ' ' + target + ' ' + sourceType + ' ' + sourceName + ' ' + targetType + ' ' + targetName);
        }
        console.log("onConnect: source=", source, " target=", target, " sourceType=", sourceType, " sourceName=", sourceName, " targetType=", targetType, " targetName=", targetName);
        // If there's a source / target type mismatch, ignore
        const valid = (sourceType === "event" && targetType === "trigger") ||
                        (sourceType === "output" && targetType === "variable");
        if (!valid) {
            console.log("Attempted to connect a ", sourceType, " to a ", targetType, " ignoring");
            return;
        }
        let sourceNode = nodes.find((node) => node.instanceID === source);
        let targetNode = nodes.find((node) => node.instanceID === target);
        if (sourceNode && targetNode) {
            if (targetNode.nodeType === "customComponent") {
                const targetInputs = Array.isArray(targetNode.inputs) ? targetNode.inputs : [];
                const handleAlreadyBound = targetInputs.some(input => {
                    if (!input || input.producerInstanceID === source) {
                        return false;
                    }
                    if (targetType === "variable") {
                        return Array.isArray(input.variables) && input.variables.some(variable => variable.consumerVariable === targetName);
                    }
                    if (targetType === "trigger") {
                        return Array.isArray(input.triggers) && input.triggers.some(trigger => trigger.targetTrigger === targetName);
                    }
                    return false;
                });
                if (handleAlreadyBound) {
                    console.warn(`Custom component handle "${targetName}" is already connected. Remove the existing connection before adding a new one.`);
                    return;
                }
            }
            
            // If they're already connected, onNodeStructureChange will find and ignore it. So just submit it.

            if (sourceType === "event") {

                onNodeStructureChange?.(targetNode, "addinputeventtrigger", {producerEvent: sourceName, targetTrigger: targetName, producerInstanceID: source});

            } else if (sourceType === "output") {

                onNodeStructureChange?.(targetNode, "addinputvariableproducer", {producerOutput: sourceName, consumerVariable: targetName, producerInstanceID: source});

            } else {
                throw new Error('onConnect: input type not recognized ' + sourceType);
            }            

            const edgeId =
                sourceType === "event"
                    ? `e-trigger-${source}-${sourceName}-${targetName}-${target}`
                    : `e-variable-${source}-${sourceName}-${targetName}-${target}`;
            setEdges((eds) => {
                if (eds.some((edge) => edge.id === edgeId)) {
                    return eds;
                }
                const newEdge = {
                    id: edgeId,
                    source,
                    target,
                    sourceHandle,
                    targetHandle,
                    type: 'customsmartedge',
                    style: edgeStyle,
                    markerEnd: makerEndStyle,
                };
                return [...eds, newEdge];
            });

        } else {
            throw new Error('onConnect: source or target node not found' + source + ' ' + target);
        }
    }
    
    const handleSelectionChange = useCallback(({ nodes }) => {
        setSelectedNodes((currentSelection) => {
            const nextSelection = nodes.map((node) => node.id);
            if (
                nextSelection.length === currentSelection.length &&
                nextSelection.every((id) => currentSelection.includes(id))
            ) {
                return currentSelection;
            }
            return nextSelection;
        });
    }, []);

    const handleSelectionContextMenu = useCallback(
      (event, graphNodes) => {
        // Prevent native context menu from showing
        event.preventDefault();
        if (readOnly) { return };
  
        // Calculate position of the context menu. We want to make sure it
        // doesn't get positioned off-screen.
        const pane = ref.current.getBoundingClientRect();
        let nodeInstances = [];
        for (let i=0; i<graphNodes.length; i++) {
            const graphNode = graphNodes[i];
            const node = nodes.find((n) => n.instanceID === graphNode.id);
            if (node) {
                nodeInstances.push(node);
            }
        }
        let newNodeMenu = nodeInstances ? {nodes: nodeInstances, top: event.clientY, left: event.clientX} : null;
        setNodeMenu(newNodeMenu);
      },
      [setNodeMenu, nodes, readOnly],
    );

    const handleEdgeContextMenu = useCallback(
        (event, edge) => {
          // Prevent native context menu from showing
          event.preventDefault();
          if (readOnly) { return };

          // Calculate position of the context menu. We want to make sure it
          // doesn't get positioned off-screen.
          const pane = ref.current.getBoundingClientRect();
          const node = nodes.find((n) => edge.target == n.instanceID);
          setEdgeMenu({
            node: node,
            edge: edge,
            top: event.clientY,
            left: event.clientX,
          });
        },
        [setEdgeMenu, nodes, readOnly],
      );

    const handleDeleteEdge = (event, node, edge) => {
        event.preventDefault();
        if (readOnly) { return };

        console.log("handleDeleteEdge: ", node, edge)

        const { source, target, sourceHandle, targetHandle } = edge;
        // parse sourceHandle into <sourceType>-<sourceName>
        const [sourceType, sourceName] = sourceHandle.split('-');
        // parse targetHandle into <targetType>-<targetName>
        const [targetType, targetName] = targetHandle.split('-');
        // if any of the variables above is null throw an error
        if (!source || !target || !sourceType || !sourceName || !targetType || !targetName) {
            throw new Error('onConnect: source, target, sourceType, sourceName, targetType, targetName cannot be null ' + source + ' ' + target + ' ' + sourceType + ' ' + sourceName + ' ' + targetType + ' ' + targetName);
        }


        onNodeStructureChange?.(node, "deleteinput", {
            producerInstanceID: edge.source, 
            inputType: sourceType == "output" ? "variable" : "trigger", 
            source: sourceName,
            target: targetName
        });
        setEdgeMenu(null);
    }

    const clearSelection = useCallback(() => {
        setSelectedNodes((current) => (current.length ? [] : current));
        setGraphNodes((nds) =>
            nds.map((graphNode) => {
                const alreadyCleared =
                    !graphNode.selected && !graphNode.data?.isSelected;
                if (alreadyCleared) {
                    return graphNode;
                }

                return {
                    ...graphNode,
                    selected: false,
                    data: {
                        ...graphNode.data,
                        isSelected: false,
                    },
                };
            })
        );
    }, [setGraphNodes, setSelectedNodes]);

    const handlePaneContextMenu = useCallback(
        (event) => {
            // Prevent native context menu from showing
            event.preventDefault();
            if (readOnly) { return };

            setNodeMenu(null);
            setEdgeMenu(null);
            clearSelection();

            // Calculate position of the context menu. We want to make sure it
            // doesn't get positioned off-screen.
            const pane = ref.current.getBoundingClientRect();
            setPaneMenu({top: event.clientY, left: event.clientX});
        },
        [setNodeMenu, setEdgeMenu, setPaneMenu, readOnly, clearSelection],
    );

    /*

        const { source, target, sourceHandle, targetHandle } = edge;
        // parse sourceHandle into <sourceType>-<sourceName>
        const [sourceType, sourceName] = sourceHandle.split('-');
        // parse targetHandle into <targetType>-<targetName>
        const [targetType, targetName] = targetHandle.split('-');
        // if any of the variables above is null throw an error
        if (!source || !target || !sourceType || !sourceName || !targetType || !targetName) {
            throw new Error('onConnect: source, target, sourceType, sourceName, targetType, targetName cannot be null ' + source + ' ' + target + ' ' + sourceType + ' ' + sourceName + ' ' + targetType + ' ' + targetName);
        }


        onNodeStructureChange?.(node, "deleteinput", {
            producerInstanceID: edge.source, 
            inputType: sourceType == "output" ? "variable" : "trigger", 
            source: sourceName,
            target: targetName
        });
            if (sourceType === "event") {

                onNodeStructureChange?.(targetNode, "addinputeventtrigger", {producerEvent: sourceName, targetTrigger: targetName, producerInstanceID: source});

            } else if (sourceType === "output") {

                onNodeStructureChange?.(targetNode, "addinputvariableproducer", {producerOutput: sourceName, consumerVariable: targetName, producerInstanceID: source});

            } else {
                throw new Error('onConnect: input type not recognized ' + sourceType);
            }            
    */

    const handleCopy = useCallback(async (event) => {
        event.preventDefault();
        if (!selectedNodes || selectedNodes.length === 0) {
            return;
        }

        let nodesToCopy = selectedNodes
            .map((nodeID) => nodes.find((node) => node.instanceID === nodeID))
            .filter(Boolean);

        if (!nodesToCopy || nodesToCopy.length === 0) {
            setNodeMenu(null);
            return;
        }

        nodesToCopy = JSON.parse(JSON.stringify(nodesToCopy));

        let edges = [];
        const inputParams = [];
        const versionPersonas = [];

        for (let i = 0; i < nodesToCopy.length; i += 1) {
            const node = nodesToCopy[i];

            if (node.inputs && node.inputs.length > 0) {
                for (let j = 0; j < node.inputs.length; j += 1) {
                    const input = node.inputs[j];
                    const nodeInCopySet = nodesToCopy.find((n) => n.instanceID === input.producerInstanceID);
                    if (!nodeInCopySet) {
                        continue;
                    }

                    if (input.triggers) {
                        input.triggers.forEach((trigger) => {
                            edges.push({
                                inputType: "trigger",
                                sourceID: input.producerInstanceID,
                                targetID: node.instanceID,
                                sourceName: trigger.producerEvent,
                                targetName: trigger.targetTrigger,
                            });
                        });
                    }
                    if (input.variables) {
                        input.variables.forEach((variable) => {
                            edges.push({
                                inputType: "variable",
                                sourceID: input.producerInstanceID,
                                targetID: node.instanceID,
                                sourceName: variable.producerOutput,
                                targetName: variable.consumerVariable,
                            });
                        });
                    }
                    inputParams.push({
                        sourceID: input.producerInstanceID,
                        targetID: node.instanceID,
                        params: {
                            includeHistory: input.includeHistory,
                            historyParams: input.historyParams,
                        },
                    });
                }
            }

            if (node.personaLocation && node.personaLocation.source === "version") {
                const personas = versionInfo?.personas ?? [];
                const personaMatch = personas.find((persona) => persona.personaID === node.personaLocation.personaID);
                if (personaMatch) {
                    versionPersonas.push(personaMatch);
                }
            }
        }

        nodesToCopy = nodesToCopy.map((node) => {
            if (node.inputs) {
                delete node.inputs;
            }
            return node;
        });

        const hydrationSummary = await hydrateFilePayloadForClipboard(nodesToCopy);

        const warnings = [];
        if (hydrationSummary.skippedSession) {
            warnings.push('Inline file data was not copied because no active session is loaded. Start a play session before copying File Store data if you need offline copies.');
        }
        if (hydrationSummary.skippedSizeLimit) {
            warnings.push(`Inline file data exceeded ${formatBytes(INLINE_PAYLOAD_LIMIT_BYTES)}. The copy will reference existing storage blobs instead.`);
        }
        if (hydrationSummary.errors.length > 0) {
            const truncatedErrors = hydrationSummary.errors.slice(0, 5).join('\n');
            warnings.push(`Some files could not be inlined:\n${truncatedErrors}`);
        }

        if (warnings.length > 0) {
            alert(warnings.join('\n\n'));
        }

        const copyData = {
            contents: "nodecopydata",
            nodes: nodesToCopy,
            edges,
            personas: versionPersonas,
            inputParams,
        };

        await copyDataToClipboard(copyData);
        setNodeMenu(null);
    }, [selectedNodes, nodes, versionInfo, hydrateFilePayloadForClipboard]);

    const handleCreateCustomComponent = useCallback((event) => {
        event.preventDefault();
        if (readOnly) { return; }

        const selectedInstanceIDs = (nodeMenu?.nodes && nodeMenu.nodes.length > 0)
            ? nodeMenu.nodes.map((nodeInstance) => nodeInstance.instanceID)
            : selectedNodes;

        if (!selectedInstanceIDs || selectedInstanceIDs.length === 0) {
            return;
        }

        onNodeStructureChange?.(null, "startCustomComponent", {
            instanceIDs: selectedInstanceIDs,
        });
    }, [nodeMenu, onNodeStructureChange, readOnly, selectedNodes]);

    const isCustomComponentSelection = Boolean(
        nodeMenu?.nodes &&
        nodeMenu.nodes.length === 1 &&
        nodeMenu.nodes[0]?.nodeType === "customComponent"
    );

    const handleUnbundleComponent = useCallback((event) => {
        event.preventDefault();
        if (readOnly) { return; }

        const componentNode =
            nodeMenu?.nodes && nodeMenu.nodes.length === 1 && nodeMenu.nodes[0].nodeType === "customComponent"
                ? nodeMenu.nodes[0]
                : null;

        if (!componentNode) {
            if (selectedNodes.length === 1) {
                const nodeInstance = nodes.find((n) => n.instanceID === selectedNodes[0]);
                if (nodeInstance?.nodeType === "customComponent") {
                    onNodeStructureChange?.(nodeInstance, "unbundleCustomComponent", {});
                }
            }
            return;
        }

        onNodeStructureChange?.(componentNode, "unbundleCustomComponent", {});
        setNodeMenu(null);
    }, [nodeMenu, nodes, onNodeStructureChange, readOnly, selectedNodes, setNodeMenu]);

    const handlePaste = useCallback(async (event) => {
        if (readOnly) { return; }

        event.preventDefault();

        try {
            const clipboardData = await pasteDataFromClipboard();
            if (!clipboardData || clipboardData.contents !== "nodecopydata" || !Array.isArray(clipboardData.nodes) || clipboardData.nodes.length === 0) {
                setPaneMenu(null);
                return;
            }

            const nodesFromClipboard = JSON.parse(JSON.stringify(clipboardData.nodes));
            const uploadSummary = await uploadInlineFilesForNodes(nodesFromClipboard);

            if (uploadSummary.errors.length > 0) {
                const truncatedErrors = uploadSummary.errors.slice(0, 5).join('\n');
                alert(`Unable to paste because some files failed to upload:\n${truncatedErrors}`);
                setPaneMenu(null);
                return;
            }

            const payload = {
                ...clipboardData,
                nodes: nodesFromClipboard,
            };

            let newNodes = [];
            const nodeInstanceIDMappings = {};
            const startNode = payload.nodes.find((node) => node.nodeType === "start");

            if (startNode) {
                onNodeStructureChange?.(startNode, "overwrite", {});
                newNodes.push(startNode);
                nodeInstanceIDMappings[startNode.instanceID] = startNode;
            }

            for (let i = 0; i < payload.nodes.length; i += 1) {
                const node = payload.nodes[i];
                if (node.nodeType === "start") {
                    continue;
                }

                const newNodeByRef = onNodeStructureChange?.(node, "duplicate", {});
                newNodes.push(newNodeByRef);
                nodeInstanceIDMappings[node.instanceID] = newNodeByRef;
            }

            if (payload.edges && payload.edges.length > 0) {
                for (let i = 0; i < payload.edges.length; i += 1) {
                    const edge = payload.edges[i];
                    const sourceNode = nodeInstanceIDMappings[edge.sourceID];
                    const targetNode = nodeInstanceIDMappings[edge.targetID];

                    if (!sourceNode || !targetNode) {
                        throw new Error('handlePaste: source or target node not found');
                    }

                    const sourceID = sourceNode.instanceID;

                    if (edge.inputType === "trigger") {
                        onNodeStructureChange?.(targetNode, "addinputeventtrigger", { producerEvent: edge.sourceName, targetTrigger: edge.targetName, producerInstanceID: sourceID });
                    } else if (edge.inputType === "variable") {
                        onNodeStructureChange?.(targetNode, "addinputvariableproducer", { producerOutput: edge.sourceName, consumerVariable: edge.targetName, producerInstanceID: sourceID });
                    } else {
                        throw new Error('handlePaste: input type not recognized ' + edge.inputType);
                    }
                }
            }

            if (payload.inputParams) {
                payload.inputParams.forEach((item) => {
                    const targetNode = nodeInstanceIDMappings[item.targetID];
                    const sourceNode = nodeInstanceIDMappings[item.sourceID];
                    if (!targetNode || !sourceNode) {
                        return;
                    }

                    const producerInstanceID = sourceNode.instanceID;
                    const newInputParams = JSON.parse(JSON.stringify(item.params));

                    if (newInputParams.includeHistory && newInputParams.historyParams && newInputParams.historyParams.includedNodes) {
                        newInputParams.historyParams.includedNodes = newInputParams.historyParams.includedNodes
                            .map((instanceID) => {
                                const mappedInstance = nodeInstanceIDMappings[instanceID];
                                if (mappedInstance) {
                                    return mappedInstance.instanceID;
                                }
                                if (instanceID === "start") {
                                    return "start";
                                }
                                console.log("Node not found in mapping for paste, likely outside selection: ", instanceID);
                                return null;
                            })
                            .filter((nodeInstance) => nodeInstance != null);
                    }

                    onNodeStructureChange?.(targetNode, "setinputparams", { producerInstanceID, inputParams: newInputParams });
                });
            }

            if (payload.personas && payload.personas.length > 0) {
                for (let i = 0; i < payload.personas.length; i += 1) {
                    const persona = payload.personas[i];
                    let personaToAdd = null;
                    if (!nullUndefinedOrEmpty(versionInfo.personas)) {
                        personaToAdd = versionInfo.personas.find((p) => p.personaID === persona.personaID);
                    }
                    if (!personaToAdd) {
                        personaToAdd = JSON.parse(JSON.stringify(persona));
                    } else {
                        personaToAdd = {
                            ...JSON.parse(JSON.stringify(personaToAdd)),
                            ...persona,
                        };
                    }
                    onPersonaListChange?.(personaToAdd, "upsert", {});
                }
            }

            setPaneMenu(null);
        } catch (error) {
            console.error('Failed to paste nodes:', error);
            alert('Paste failed. Check the console for details.');
            setPaneMenu(null);
        }
    }, [readOnly, uploadInlineFilesForNodes, onNodeStructureChange, versionInfo, onPersonaListChange]);

    const handleSelectAll = (event) => {
        if (readOnly) { return };

        event.preventDefault();
        event.stopPropagation();
        setGraphNodes((nds) => nds.map((graphNode) => {
            graphNode = {
                ...graphNode, 
                selected: true,
            }
            return graphNode;
        }));
    };


    const onPaneClick = useCallback((event) => {
        event.preventDefault();
        if (readOnly) { return };

        setNodeMenu(null);
        setEdgeMenu(null);
        clearSelection();
    }, [setNodeMenu, setEdgeMenu, readOnly, clearSelection]);
    
    const handleKeyDown = (event) => {
        
        // Handle cross-platform delete/backspace
        if (event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey)) {
            console.log('Delete key pressed');
            if (readOnly) { return };

            handleDeleteNodesByID(event, selectedNodes);
        } 
        
        // Handle copy: Command+C on macOS, Ctrl+C on Windows
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            console.log('Ctrl+C pressed');
            handleCopy(event);
        }

        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
            const componentNode = nodes.find((node) => selectedNodes.includes(node.instanceID) && node.nodeType === "customComponent");
            if (componentNode) {
                onNodeStructureChange?.(componentNode, "unbundleCustomComponent", {});
                return;
            }
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
            handleCreateCustomComponent(event);
        }

        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
            const componentNode = nodes.find((node) => selectedNodes.includes(node.instanceID) && node.nodeType === "customComponent");
            if (componentNode) {
                onNodeStructureChange?.(componentNode, "unbundleCustomComponent", {});
                return;
            }
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
            handleCreateCustomComponent(event);
        }
        
        // Handle paste: Command+V on macOS, Ctrl+V on Windows
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            console.log('Ctrl+V pressed');
            if (readOnly) { return };

            void handlePaste(event);
        }
        
        // Handle paste: Command+A on macOS, Ctrl+A on Windows
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            handleSelectAll(event);
        }
    };
    
    const onError = (msgId, msg) => {
        if (msgId === '002') {
          return;
        }
      
        console.warn(msg);
      }

    const canvasBackground = theme?.colors?.messagesAreaBackgroundColor || '#050b1b';

    return (
      <div
        className="relative h-full w-full overflow-hidden rounded-[2rem] bg-slate-950/25 p-2 text-slate-100 shadow-[inset_0_1px_0_rgba(148,163,184,0.12)]"
        style={{ background: 'radial-gradient(circle at top, rgba(56,189,248,0.06), transparent 70%)' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="absolute inset-0 -z-10 rounded-[1.9rem] bg-[radial-gradient(circle_at_25%_0%,rgba(56,189,248,0.1),transparent_65%)]" />
        <div
          className="absolute inset-2 rounded-[1.75rem] bg-slate-950/82 shadow-[0_45px_90px_-75px_rgba(56,189,248,0.55)]"
          style={{ backgroundColor: canvasBackground }}
        >
          <ReactFlowProvider>
            <ReactFlow
              ref={ref}
              nodes={graphNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              defaultViewport={defaultViewport}
              attributionPosition="bottom-left"
              onInit={onInit}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodeContextMenu={onNodeContextMenu}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onPaneClick={onPaneClick}
              onPaneContextMenu={handlePaneContextMenu}
              onConnect={onConnect}
              onEdgeClick={(event, edge) => handleEdgeClicked(edge)}
              onEdgeContextMenu={(event, edge) => handleEdgeContextMenu(event, edge)}
              connectionLineComponent={CustomConnectionLine}
              connectionLineStyle={connectionLineStyle}
              defaultEdgeOptions={defaultEdgeOptions}
              autoPanOnNodeDrag={false}
              autoPanOnConnect={true}
              panOnDrag={[2]}
              selectionOnDrag={true}
              elevateNodesOnSelect={true}
              selectionMode="full"
              onSelectionChange={handleSelectionChange}
              onSelectionContextMenu={handleSelectionContextMenu}
              onError={onError}
              autoFocus={true}
              minZoom={0.1}
              maxZoom={2}
              fitView
              className="!bg-transparent"
              style={{ width: '100%', height: '100%' }}
            >
              <Controls className="!bg-slate-900/80 !text-slate-100" />
            </ReactFlow>
          </ReactFlowProvider>

          <ContextMenu open={Boolean(nodeMenu)} position={nodeMenu} onClose={() => setNodeMenu(null)}>
            <ContextMenuItem
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={(event) => handleDeleteNodes(event)}
            >
              Delete Node
            </ContextMenuItem>
            {nodeMenu?.nodes && nodeMenu.nodes.length > 0 ? (
              <ContextMenuItem
                icon={<PackagePlus className="h-4 w-4" />}
                onSelect={(event) => handleCreateCustomComponent(event)}
              >
                Create Custom Component
              </ContextMenuItem>
            ) : null}
            {isCustomComponentSelection ? (
              <ContextMenuItem
                icon={<SplitSquareHorizontal className="h-4 w-4" />}
                onSelect={(event) => handleUnbundleComponent(event)}
              >
                Unbundle Component
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem
              icon={<Copy className="h-4 w-4" />}
              onSelect={(event) => { void handleCopy(event); }}
            >
              Copy Node
            </ContextMenuItem>
          </ContextMenu>

          <ContextMenu
            open={Boolean(edgeMenu)}
            position={edgeMenu}
            onClose={() => setEdgeMenu(null)}
          >
            <ContextMenuItem
              icon={<Trash2 className="h-4 w-4" />}
              onSelect={(event) => edgeMenu && handleDeleteEdge(event, edgeMenu.node, edgeMenu.edge)}
            >
              Delete Input
            </ContextMenuItem>
          </ContextMenu>

          <ContextMenu
            open={Boolean(paneMenu)}
            position={paneMenu}
            onClose={() => setPaneMenu(null)}
          >
            <ContextMenuItem
              icon={<ClipboardPaste className="h-4 w-4" />}
              onSelect={(event) => { void handlePaste(event); }}
            >
              Paste
            </ContextMenuItem>
            <ContextMenuItem
              icon={<SquareStack className="h-4 w-4" />}
              onSelect={(event) => handleSelectAll(event)}
            >
              Select All
            </ContextMenuItem>
          </ContextMenu>
        </div>
      </div>
    );
}
