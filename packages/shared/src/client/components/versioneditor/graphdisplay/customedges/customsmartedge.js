import React, { memo } from 'react';
import { useNodes, BezierEdge } from 'reactflow'
import { getSmartEdge } from '@tisoap/react-flow-smart-edge'

function CustomSmartEdge(props) {
	const {
		id,
		sourcePosition,
		targetPosition,
		sourceX,
		sourceY,
		targetX,
		targetY,
		style,
		markerStart,
		markerEnd,
    source,
    target,
    sourceID,
    targetID
	} = props

	const nodes = useNodes()

	const getSmartEdgeResponse = getSmartEdge({
		sourcePosition,
		targetPosition,
		sourceX,
		sourceY,
		targetX,
		targetY,
		nodes
	})

	// If the value returned is null, it means "getSmartEdge" was unable to find
	// a valid path, and you should do something else instead
	if (getSmartEdgeResponse === null) {
		return <BezierEdge {...props} />
	}


	const { edgeCenterX, edgeCenterY, svgPathString } = getSmartEdgeResponse
	return (
		<>
      {/* Visual Edge */}
      <path
        id={id}
		style={style}
        d={svgPathString}
		markerStart={markerStart}
		markerEnd={markerEnd}
		fill="none"
		className='react-flow__edge-path'
	  />
      {/* Clickable Overlay */}
      <path
        id={`${id}-clickoverlay`} // Unique ID for the overlay =
        d={svgPathString}
        style={{ stroke: 'rgba(0,0,0,0)', strokeWidth: 20 }} // Transparent but wide for click detection
        cursor="pointer"
		fill="none"
      />
		</>
	)
}

export default memo(CustomSmartEdge);
