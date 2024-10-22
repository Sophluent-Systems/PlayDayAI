import React, { memo } from 'react';
import { getBezierPath, BaseEdge, useStore, EdgeProps, ReactFlowState } from 'reactflow';


const getForwardEdgePath = (
  { sourceX, sourceY, targetX, targetY }, offset
) => {
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  return `M ${sourceX} ${sourceY} Q ${centerX} ${centerY + offset} ${targetX} ${targetY}`;
};


const getBackwardsEdgePath = (
  { sourceX, sourceY, targetX, targetY }, offset
) => {
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;
  const radiusX = (sourceX - targetX) * 0.55;
  const radiusY = 50;

  //  A ${radiusX} ${radiusY} 0 1 0 
  // 
  return `M ${sourceX - 2} ${sourceY}  Q ${centerX} ${centerY + offset} ${targetX + 2} ${targetY}`;
};

function CurvyEdge(props) {
  const {
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  } = props;
  const isBiDirectionEdge = useStore((s) => {
    const edgeExists = s.edges.some(
      (e) =>
        (e.source === target && e.target === source) || (e.target === source && e.source === target)
    );

    return edgeExists;
  });

  const edgePathParams = {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  };

  let path = '';

  const startOfSourceX = sourceX - 100;
  const endOfTargetX = targetX + 100;
  const offset =  ((targetX - sourceX)/25) * 10;

  path = (startOfSourceX <= endOfTargetX) ? getForwardEdgePath(edgePathParams, offset) : getBackwardsEdgePath(edgePathParams, offset);

  return <BaseEdge path={path} {...props} />;
}

export default memo(CurvyEdge);