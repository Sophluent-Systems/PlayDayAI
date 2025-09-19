import React, { useEffect, useState, memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, Paper, Typography } from '@mui/material';
import { NodeContainer } from './nodecontainer';
import { getNodePersonaDetails } from '@src/common/personainfo';
import { getMessageStyling } from "@src/client/themestyling";
import { getWarningsForNode } from '../versioneditorutils';
import { getInputsAndOutputsForNode } from '@src/common/nodeMetadata';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';


const labelContainerStyle = {
  display: 'flex',
  flex: 1,
  flexGrow: 1,
  cursor: 'pointer',
  height: '100%',
  flexDirection: 'column', // Stack items vertically if needed
  justifyContent: 'center', // Center items vertically in the container
  alignItems: 'center', // Center items horizontally in the container
  };

const dragHandleStyle = {
  position: 'absolute', // Position absolutely within the node container
  left: '50%', // Position the handle 1px away from the node's left edge
  top: '-15px', // Center vertically
  transform: 'translateY(-50%)', // Adjust vertical position to truly center
  cursor: 'grab', // Add grab cursor for drag interaction
  display: 'flex',
  alignItems: 'center', // Center the icon within the handle
  justifyContent: 'center',
  width: '60px', // Specify width and height for the handle area
  height: '30px',
  // dark gray background color
  backgroundColor: "#808080", // Adjust handle background color as needed
  borderRadius: '4px', // Adjust border radius as needed
  color: "black",
  transform: 'translateX(-50%)', // Adjust horizontal position to truly center
  zIndex: 1000,
};

const targetHandleStyle = {
  width: '100%',
  height: '100%',
  background: 'blue',
  position: 'absolute',
  top: '10px',
  left: 0,
  borderRadius: 0,
  opacity: 0,
  border: 'none',
 }

 const handleBaseStyle = {
  width: '10px',
  height: '20px',
  background: 'transparent',
  //border: 'lightgray 1px solid', // useful for debugging
  border: 'transparent',
  justifyContent: 'center',
  alignItems: 'center',
  alignContent: 'center',
  display: 'flex',
  position: 'absolute',
  zIndex: 1000,
};

const inputOutputCircleStyle = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.9)',
  zIndex: 0,
  padding: 0,
  margin: 0,
};

const handleContainerBoxStyle = {
  display: 'flex', 
  justifyContent: 'flex-start', 
  alignItems: 'center', 
  alignContent: 'center',
  flexDirection: 'row',
  margin: 0,
  padding: 0,
  zIndex: 0,  // Ensure this is lower or equal to handle but higher than -1
  pointerEvents: 'none', 
  position: 'absolute', // change to absolute
  width: 'auto',
}

const IOTopOffset = 10;
const IOHeight = 20;
const IOIconSize=15;
const defaultWidth = 180;
const defaultHeight = 80;

const NodeGraphNode = memo((props) => {
  const { data, id, readOnly} = props;
  const { theme, versionInfo, node, onClicked } = data;
  const connectionNodeId = useStore((state) => state.connectionNodeId);
  const isConnecting = !!connectionNodeId;
  const isTarget = connectionNodeId && connectionNodeId !== id;
  const [metadata, setMetadata] = useState(null);
  const [styling, setStyling] = useState(null);


  const persona = getNodePersonaDetails(versionInfo, node);
  const isSelected = data.isSelected;

  const height = Math.max(defaultHeight, (metadata ? metadata.inputs.length + metadata.outputs.length + metadata.events.length : 0) * IOHeight);

  const warnings = getWarningsForNode(node);


  useEffect(() => {
    let newStyling = getMessageStyling(["text"], persona);

    newStyling = {
      ...newStyling,
      backgroundColor: (isTarget || isSelected) ? '#ffcce3' : newStyling.backgroundColor,
      borderStyle: isTarget ? 'dashed' : 'solid',
      display: 'flex',
      flexDirection: 'column',
    };

    setStyling(newStyling);
  }, [persona, isSelected, isTarget]);

  useEffect(() => {
    if (node) {
      const metadata = getInputsAndOutputsForNode(node);
      setMetadata(metadata);
    }
  }, [node]);


  if (!metadata) {
    return null;
  }

  return (
    <NodeContainer styling={styling} height={height} width={defaultWidth}>
      {/* If not the start node, the top left should be the default trigger */}
      {node.nodeType !== 'start' && (
        <Handle
            key={`trigger-default`}
            type="target"
            position={Position.Left}
            id={`trigger-default`}
            style={{ ...handleBaseStyle, left: 0, top: `${IOTopOffset}px`}}
            isConnectableStart={isConnecting}
          >
          <Box sx={{...handleContainerBoxStyle, left: 0}}>
              <PlayArrowIcon style={{ color: '#fff', fontSize: `${IOIconSize}px`, margin: -5 }} />
            </Box>
        </Handle>
      )}
      {/* Inputs */}
      {metadata.inputs.map((variable, index) => (
        <Handle
          key={`variable-${variable.value}`}
          type="target"
          position={Position.Left}
          id={`variable-${variable.value}`}
          style={{ ...handleBaseStyle, left: 0, top: `${IOTopOffset + IOHeight + index * IOHeight}px` }}
          isConnectableStart={isConnecting}
        >
        <Box sx={{...handleContainerBoxStyle, left: 0}}>
            <Box  style={inputOutputCircleStyle} />
            <Typography 
              variant="body1" 
              fontSize="8px"
              style={{ color: '#fff', marginLeft: '5px',zIndex: -1 }}
            >
                {variable.label}
            </Typography>
          </Box>
        </Handle>
      ))}

      
      <Box className="custom-drag-handle" style={dragHandleStyle}>
        <DragIndicatorIcon sx={{ transform: 'rotate(90deg)' }} />
      </Box>
      
      <Box sx={labelContainerStyle} onClick={onClicked}>
        <Typography   
          variant="body1"  
          fontSize="1rem"
          sx={{ color: styling.color, whiteSpace: "pre-wrap", zIndex: 0 }}
        >
          {node.instanceName}
        </Typography>
      </Box>
      
      {/* Events */}
      {!isConnecting && !readOnly && metadata.events.map((event, index) => (
        <Handle
          key={`event-${event}`}
          type="source"
          position={Position.Right}
          id={`event-${event}`}
          style={{ ...handleBaseStyle, right: 0, top: `${IOTopOffset + index * IOHeight}px`  }}
        >
        <Box sx={{...handleContainerBoxStyle, justifyContent: 'flex-start', right: 0 }}>
            <Typography 
              variant="body1" 
              fontSize="8px"
              style={{ color: '#fff', marginRight: '5px',  zIndex: -1 }}
            >
                {event}
            </Typography>
            <PlayArrowIcon style={{ color: '#fff', fontSize: `${IOIconSize}px`, margin: -5 }}  />
          </Box>
        </Handle>
      ))}
      {/* Outputs */}
      {!isConnecting && !readOnly && metadata.outputs.map((output, index) => (
        <Handle
          key={`output-${output}`}
          type="source"
          position={Position.Right}
          id={`output-${output}`}
          style={{ ...handleBaseStyle, right: 0, top: `${IOTopOffset + (index + metadata.events.length) * IOHeight}px` }}
        >
        <Box sx={{...handleContainerBoxStyle, justifyContent: 'flex-start', right: 0 }}>
              <Typography 
                variant="body1" 
                fontSize="8px"
                style={{ color: '#fff', marginRight: '5px', zIndex: 0 }}
              >
                  {output}
              </Typography>
              <Box  style={inputOutputCircleStyle} />
            </Box>
        </Handle>
      ))}


      {/* Warnings */}
      {warnings && (
        <Box
          sx={{
            position: 'absolute',
            top: 2,
            left: 2,
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'orange',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body1"
            style={{ color: '#FFF', fontWeight: 'bold' }}
          >
            !
          </Typography>
        </Box>
      )}
    </NodeContainer>
  );
});

export default NodeGraphNode;
