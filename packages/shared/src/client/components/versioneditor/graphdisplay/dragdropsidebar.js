import React from 'react';
// import MUI typography
import {
    Typography,
    Box,
    Paper,
} from '@mui/material';
import { NodeContainer } from './nodecontainer';
import { getPersonaFromLocation } from '@src/common/personainfo';
import { getMessageStyling } from "@src/client/themestyling";
import { getAddableNodeTypes } from '@src/common/nodeMetadata';
import { getMetadataForNodeType } from '@src/common/nodeMetadata';

const addableNodeTypes = getAddableNodeTypes();

export const DragDropSidebar = (params) => {
  const { theme, versionInfo, readOnly } = params;
  const nodes = versionInfo.stateMachineDescription.nodes;
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };
  
  if (!nodes) {
    return null;
  }

  return (
      <Box sx={{
        height: "100%",
        width: "100%",
        overflowY: "auto",
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2, // Adjust the gap between items as needed
        padding: 1,
        // Other styles as needed, e.g., padding, background, etc.
        }}
      >
        <Box sx={{width: '100%', marginBottom: '10px'}}>
            <Typography variant="body1">Add a blank node from a template:</Typography>
        </Box>
        {addableNodeTypes.map((addableTemplate,index) => {
            const nodeMetadata = getMetadataForNodeType(addableTemplate.nodeType);
            const template = nodeMetadata.newNodeTemplate;
            const nodeAttributes =  nodeMetadata.nodeAttributes;
            const personaLocation = {
              source: "builtin",
              personaID: nodeMetadata.defaultPersona,
            };
            const persona = getPersonaFromLocation(versionInfo, personaLocation);
            let styling = getMessageStyling(["text"], persona);
            return (
            <NodeContainer key={addableTemplate.nodeType} width={180} height={40} styling={styling} onDragStart={(event) => (!readOnly) && onDragStart(event, JSON.stringify({action: "add", template: addableTemplate.nodeType}))} draggable >
                <Typography variant="body1" style={{ fontWeight: 'bold', color: styling.color }}>
                    {addableTemplate.label}
                </Typography>
            </NodeContainer>
            );

        })}
        <Box sx={{width: '100%', marginBottom: '10px'}}>
            <Typography variant="body1">Or duplicate an existing node:</Typography>
        </Box>
        {nodes.map((node) => {
            const nodeMetadata = getMetadataForNodeType(node.nodeType);
            const nodeAttributes =  nodeMetadata.nodeAttributes;
            const personaLocation = {
              source: "builtin",
              personaID: nodeMetadata.defaultPersona,
            };
            const persona = getPersonaFromLocation(versionInfo, personaLocation);
            let styling = getMessageStyling(["text"], persona);
            return (
            <NodeContainer key={node.instanceID} width={180} height={40} styling={styling} onDragStart={(event) => (!readOnly) && onDragStart(event, JSON.stringify({action: "duplicate", node: node}))} draggable >
                <Typography variant="body1" style={{ fontWeight: 'bold', color: styling.color }}>
                    {node.instanceName}
                </Typography>
            </NodeContainer>
            );
        })}
      </Box>
  );
};
