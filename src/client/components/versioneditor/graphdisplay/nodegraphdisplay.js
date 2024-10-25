import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { DragDropSidebar } from "./dragdropsidebar";
import { 
    Box,
    Menu,
    MenuItem,
} from "@mui/material";
import FloatingEdge from './customedges/floatingedge';
import CustomConnectionLine from './customedges/customconnectionline';
import { copyDataToClipboard, pasteDataFromClipboard } from "@src/client/clipboard";
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
    stroke: '#ff0072' 
}; // Bright pink color

const makerEndStyle = {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: '#ff0072',
}

const connectionLineStyle = {
  strokeWidth: 3,
  stroke: '#ff0072',
};


const defaultEdgeOptions = {
    style: connectionLineStyle,
    type: 'customsmartedge',
    markerEnd: makerEndStyle,
  };


export function NodeGraphDisplay(params) {
    const { theme, versionInfo, onNodeClicked, onEdgeClicked, onNodeStructureChange, onPersonaListChange, readOnly } = params;
    const nodes = versionInfo.stateMachineDescription.nodes;
    const [graphNodes, setGraphNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);  
    const [nodeMenu, setNodeMenu] = useState(null);
    const [edgeMenu, setEdgeMenu] = useState(null);
    const [paneMenu, setPaneMenu] = useState(null);
    const ref = useRef(null);
    const [doneInitialFitView, setDoneInitialFitView] = useState(false);

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


    if (!nodes) {
        return null;
    }

    useEffect(() => {
        if (nodes) {
            let stateMachineNodes = nodes;
            if (stateMachineNodes.length == 0) {
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
            const heightPerNode = 120;
            const widthPerNode = 240;
            const center = 100;
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
                subgraphStartYOffset += totalSubgraphHeight;  // Increment yOffset for the next subgraph dynamically
            });

            setGraphNodes((nds) => {
                let newNodes = [];
                stateMachineNodes.forEach(node => {                    
                    let graphNode = findGraphNode(nds, node.instanceID);
                    if (!graphNode) {
                        graphNode = {
                            id: node.instanceID,
                            type: 'nodeGraphNode',
                            dragHandle: '.custom-drag-handle',
                            data: {
                                versionInfo,
                                node,
                                theme,
                                isSelected: selectedNodes.includes(node.instanceID),
                                onClicked: () => handleNodeClicked(node),
                                readOnly,
                            }
                        };
                    } else {
                        graphNode.data = {...graphNode.data, versionInfo, node, theme};
                    }
                    graphNode.position = positions[node.instanceID];
                    graphNode.data.label = node.instanceName;
                    newNodes.push(graphNode);
                });

                return newNodes;
            });
            
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
        }
    }, [nodes]);


    useEffect(() => {
        if (selectedNodes != null) {
            setGraphNodes((nds) => nds.map((graphNode) => {
                    graphNode.data = {
                        ...graphNode.data, 
                        isSelected: selectedNodes.includes(graphNode.id),
                    }
                    return graphNode;
                }));
        }
    }, [selectedNodes]);
    
      const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }, []);
    
      const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            if (readOnly) { return };
    
            const eventData = event.dataTransfer.getData('application/reactflow');

            try {
                const dropAction = JSON.parse(eventData);
    
                if (dropAction.action === "add") {
                    onNodeStructureChange?.(null, "add", {templateName: dropAction.template});
                } else if (dropAction.action === "duplicate") {
                    onNodeStructureChange?.(dropAction.node, "duplicate", {});
                }
            } catch(e) {
                console.error("onDrop: Error parsing graph event data", e);
            }
        },
        [reactFlowInstance],
      );

      const onNodeContextMenu = useCallback(
        (event, node) => {
          // Prevent native context menu from showing
          event.preventDefault();
            
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
          let newNodeMenu = nodeInstance ? { top: event.clientY, left: event.clientX} : null;
          setNodeMenu(newNodeMenu);
        },
        [setNodeMenu, nodes],
      );
      
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
            
            // If they're alreayd connected, onNodeStructureChange will find and ignore it. So just submit it.

            if (sourceType === "event") {

                onNodeStructureChange?.(targetNode, "addinputeventtrigger", {producerEvent: sourceName, targetTrigger: targetName, producerInstanceID: source});

            } else if (sourceType === "output") {

                onNodeStructureChange?.(targetNode, "addinputvariableproducer", {producerOutput: sourceName, consumerVariable: targetName, producerInstanceID: source});

            } else {
                throw new Error('onConnect: input type not recognized ' + sourceType);
            }            

        } else {
            throw new Error('onConnect: source or target node not found' + source + ' ' + target);
        }
    }
    
    const handleSelectionChange = ({ nodes, edges }) => {
            const newSelectedNodes = nodes.map((node) => node.id);
            // if the selection is different from the current selection, update the state
            if (newSelectedNodes.length !== selectedNodes.length || newSelectedNodes.find((node) => !selectedNodes.includes(node))) {
                setSelectedNodes(newSelectedNodes);
            }
    };

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
      [setNodeMenu, nodes],
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
        [setEdgeMenu, nodes],
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

    const handlePaneContextMenu = useCallback(
        (event) => {
            // Prevent native context menu from showing
            event.preventDefault();

            setNodeMenu(null);
            setEdgeMenu(null);
            clearSelection();

            // Calculate position of the context menu. We want to make sure it
            // doesn't get positioned off-screen.
            const pane = ref.current.getBoundingClientRect();
            setPaneMenu({top: event.clientY, left: event.clientX});
        },
        [setNodeMenu, setEdgeMenu, setPaneMenu],
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

    const handleCopy = (event) => {
        event.preventDefault();
        if (!selectedNodes || selectedNodes.length == 0) {
            return;
        }
        let nodesToCopy = selectedNodes.map((nodeID) => nodes.find((node) => node.instanceID === nodeID));
        nodesToCopy = JSON.parse(JSON.stringify(nodesToCopy));
        if (nodesToCopy && nodesToCopy.length > 0) {
            let edges = [];
            let inputParams=[];
            let versionPersonas = [];
            for (let i=0; i<nodesToCopy.length; i++) {
                const node = nodesToCopy[i];

                //
                // Map inputs to edges to be copied
                // 
                if (node.inputs && node.inputs.length > 0) {
                    for (let j=0; j<node.inputs.length; j++) {
                        const input = node.inputs[j];
                        const nodeInCopySet = nodesToCopy.find((n) => n.instanceID === input.producerInstanceID);
                        if (nodeInCopySet) {
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
                                }
                            });
                        }
                    }
                }
                
                // 
                // If the persona is attached to the version (not inline in the node),
                // then add it to the array of personas to copy
                //

                if (node.personaLocation && node.personaLocation.source === "version") {
                    versionPersonas.push(versionInfo.personas.find(persona => persona.personaID === node.personaLocation.personaID));
                }
            }
            nodesToCopy = nodesToCopy.map((node) => {
                delete node.inputs;
                return node;
            });
            const copyData = {
                contents: "nodecopydata",
                nodes: nodesToCopy,
                edges: edges,
                personas: versionPersonas,
                inputParams: inputParams,
            }

            copyDataToClipboard(copyData);
        }
        setNodeMenu(null);
    }

    const handlePaste = (event) => {
        if (readOnly) { return };
        
        event.preventDefault();
        pasteDataFromClipboard().then((data) => {
            if (data && data.contents === "nodecopydata" && data.nodes && data.nodes.length > 0) {
                // special case: if the start node is in the copy set, then overwrite the
                // start node with the copy
                let newNodes = [];
                let nodeInstanceIDMappings = {};
                let startNode = data.nodes.find((node) => node.nodeType === "start");
                if (startNode) {
                    onNodeStructureChange?.(startNode, "overwrite", {});
                    newNodes.push(startNode);
                    nodeInstanceIDMappings[startNode.instanceID] = startNode;
                }

                for (let i=0; i<data.nodes.length; i++) {
                    // if we encounter the start node, skip it
                    if (data.nodes[i].nodeType === "start") {
                        continue;
                    }
                    const newNodeByRef = onNodeStructureChange?.(data.nodes[i], "duplicate", {});
                    // This allows us to match edges correctly later
                    newNodes.push(newNodeByRef);
                    nodeInstanceIDMappings[data.nodes[i].instanceID] = newNodeByRef;
                }
                if (data.edges && data.edges.length > 0) {
                    for (let i=0; i<data.edges.length; i++) {
                        const edge = data.edges[i];
                        const sourceID = nodeInstanceIDMappings[edge.sourceID].instanceID;
                        const targetNode = nodeInstanceIDMappings[edge.targetID];
                        if (sourceID && targetNode) {
                            
                            if (edge.inputType === "trigger") {

                                onNodeStructureChange?.(targetNode, "addinputeventtrigger", {producerEvent: edge.sourceName, targetTrigger: edge.targetName, producerInstanceID: sourceID});

                            } else if (edge.inputType === "variable") {

                                onNodeStructureChange?.(targetNode, "addinputvariableproducer", {producerOutput: edge.sourceName, consumerVariable: edge.targetName, producerInstanceID: sourceID});

                            } else {
                                throw new Error('handlePaste: input type not recognized ' + edge.inputType);
                            }     
                        } else {
                            throw new Error('handlePaste: source or target node not found' + sourceID + ' ' + targetNode);
                        }
                    }
                }
                data.inputParams &&data.inputParams.forEach((item) => {
                    const targetNode = nodeInstanceIDMappings[item.targetID];
                    const producerInstanceID = nodeInstanceIDMappings[item.sourceID].instanceID;
                    let newInputParams = JSON.parse(JSON.stringify(item.params));
                    // Need to fix up all the instance IDs in historyParams.includedNodes, if it exists
                    if (newInputParams.includeHistory && newInputParams.historyParams && newInputParams.historyParams.includedNodes) {
                        newInputParams.historyParams.includedNodes = newInputParams.historyParams.includedNodes.map((instanceID) => {
                            const mappedInstance = nodeInstanceIDMappings[instanceID];                            
                            if (mappedInstance) {
                                return mappedInstance.instanceID;
                            } else if (instanceID == "start") {
                                // special exception for the start node
                                return "start";  
                            } else {
                                console.log("Node not found in mapping for paste, likely outside selection: ", instanceID)
                                return null;
                            }
                        });
                        // Now filter out any nulls
                        newInputParams.historyParams.includedNodes = newInputParams.historyParams.includedNodes.filter((node) => node != null);
                    }
                    if (targetNode && producerInstanceID) {
                        onNodeStructureChange?.(targetNode, "setinputparams", {producerInstanceID, inputParams: newInputParams});
                    }
                });
                if (data.personas && data.personas.length > 0) {
                    for (let i=0; i<data.personas.length; i++) {
                        const persona = data.personas[i];
                        // Is there an existing persona with the same ID?
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
                            }
                        }
                        onPersonaListChange?.(personaToAdd, "upsert", {});
                    }
                }
            }
            setPaneMenu(null);
        });
    }

    function clearSelection() {
        setSelectedNodes([]);
        setGraphNodes((nds) => nds.map((graphNode) => {
            graphNode = {
                ...graphNode,
                selected: false,
            }
            return graphNode;
        }));
    }

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
    }, [setNodeMenu, setEdgeMenu]);
    
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
            handleCopy(event, selectedNodes);
        }
        
        // Handle paste: Command+V on macOS, Ctrl+V on Windows
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            console.log('Ctrl+V pressed');
            if (readOnly) { return };

            handlePaste(event);
        }
        
        // Handle paste: Command+A on macOS, Ctrl+A on Windows
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            console.log('Ctrl+A pressed');
            handleSelectAll(event);
        }
    };
    
    const onError = (msgId, msg) => {
        if (msgId === '002') {
          return;
        }
      
        console.warn(msg);
      }

    return (
        <Box sx={{ 
                height: '100%', 
                width: '100%', 
                display: 'flex',
                flexDirection: 'column',
                // background color a midnight blue
                //backgroundColor: '#1f1f3f',
                backgroundColor: theme.colors.messagesAreaBackgroundColor,
            }}
            tabIndex={0}  // Makes the Box focusable
            onKeyDown={handleKeyDown}
        >
                <Box sx={{
                    height: '70%',
                    width: '100%',
                    border: 1, // sets the border width
                    borderColor: 'black', // sets the border color
                    borderStyle: 'solid',
                }}
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
                        >

                            <Controls />
                            {/* Delete node menu */}
                            <Menu
                                    open={!!nodeMenu}
                                    anchorReference="anchorPosition"
                                    onClose={() => setNodeMenu(null)}
                                    anchorPosition={nodeMenu ? { top: nodeMenu.top, left: nodeMenu.left} : {top:0, left:0}}
                                >
                                    <MenuItem key={"contextmenuitem-delete"} onClick={(event) => handleDeleteNodes(event)}>Delete</MenuItem>
                                    <MenuItem key={"contextmenuitem-copy"} onClick={(event) => handleCopy(event)}>Copy</MenuItem>
                            </Menu>
                            {/* Delete edge menu */}
                            <Menu
                                    open={!!edgeMenu}
                                    anchorReference="anchorPosition"
                                    onClose={() => setEdgeMenu(null)}
                                    anchorPosition={edgeMenu ? { top: edgeMenu.top, left: edgeMenu.left} : {top:0, left:0}}
                                >
                                    <MenuItem key={"contextmenuitem-delete"} onClick={(event) => handleDeleteEdge(event, edgeMenu.node, edgeMenu.edge)}>Delete Input</MenuItem>
                            </Menu>
                            {/* Delete edge menu */}
                            <Menu
                                    open={!!paneMenu}
                                    anchorReference="anchorPosition"
                                    onClose={() => setPaneMenu(null)}
                                    anchorPosition={paneMenu ? { top: paneMenu.top, left: paneMenu.left} : {top:0, left:0}}
                                >
                                    <MenuItem key={"contextmenuitem-pase"} onClick={(event) => handlePaste(event)}>Paste</MenuItem>
                                    <MenuItem key={"contextmenuitem-selectall"} onClick={(event) => handleSelectAll(event)}>Select All</MenuItem>
                            </Menu>
                        </ReactFlow>
                    </ReactFlowProvider>
                </Box>
                <Box sx={{
                    height:'30%',
                    width: '100%',
                    border: 1, // sets the border width
                    borderColor: 'black', // sets the border color
                    borderStyle: 'solid',
                    // background color a medium gray with a hint of cobalt
                    backgroundColor:  theme.colors.messagesAreaBackgroundColor,
                }}
                >
                    <DragDropSidebar theme={theme} versionInfo={versionInfo} readOnly={readOnly} />
                </Box>
        </Box>
    );
}