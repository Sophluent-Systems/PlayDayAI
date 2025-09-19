import React, { memo } from 'react';
import { BaseEdge, BezierEdge, EdgeProps } from 'reactflow';

function SelfConnectingEdge(props) {
  // we are using the default bezier edge when source and target ids are different
  if (props.source !== props.target) {
    return <BezierEdge {...props} />;
  }

  const { sourceX, sourceY, targetX, targetY, id, markerEnd } = props;
  const radiusX = (sourceX - targetX) * 0.6;
  const radiusY = 50;
  const edgePath = `M ${sourceX - 5} ${sourceY} A ${radiusX} ${radiusY} 0 1 0 ${
    targetX + 2
  } ${targetY}`;

  return <BaseEdge 
            path={edgePath} 
            markerEnd={markerEnd} 
            fill="none"
            {...props} 
          />;
}

export default memo(SelfConnectingEdge);