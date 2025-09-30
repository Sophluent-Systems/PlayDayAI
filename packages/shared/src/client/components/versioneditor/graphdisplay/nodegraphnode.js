'use client';
import React, { useEffect, useState, memo } from 'react';

import { Handle, Position, useStore } from 'reactflow';

import clsx from 'clsx';

import { GripVertical, Play, AlertCircle } from 'lucide-react';

import { NodeContainer } from './nodecontainer';

import { getNodePersonaDetails } from '@src/common/personainfo';

import { getMessageStyling } from '@src/client/themestyling';

import { getWarningsForNode } from '../versioneditorutils';

import { getInputsAndOutputsForNode } from '@src/common/nodeMetadata';



const IOTopOffset = 16;

const IOHeight = 28;

const IOIconSize = 18;

const defaultWidth = 240;

const defaultHeight = 120;



const handleBaseStyle = {

  width: defaultWidth,

  height: '22px',

  background: 'transparent',

  border: 'transparent',

  justifyContent: 'center',

  alignItems: 'center',

  display: 'flex',

  position: 'absolute',

  zIndex: 1000,

};



const handleContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '0 0',
  pointerEvents: 'none',
  width: '100%',
};

const leftHandleContainerStyle = {
  ...handleContainerStyle,
  justifyContent: 'flex-start',
  textAlign: 'left',
  paddingLeft: 4,
};

const rightHandleContainerStyle = {
  ...handleContainerStyle,
  justifyContent: 'flex-end',
  textAlign: 'right',
  paddingRight: 4,
};

const normalizeOption = (option, index, prefix) => {
  if (typeof option === 'string') {
    return { value: option, label: option };
  }
  if (option && typeof option === 'object') {
    const rawValue = option.value ?? option.key ?? option.name ?? option.label;
    const value = rawValue ?? `${prefix}-${index}`;
    const label = option.label ?? (typeof rawValue === 'string' ? rawValue : `${prefix} ${index + 1}`);
    return { ...option, value, label };
  }
  const value = `${prefix}-${index}`;
  return { value, label: `${prefix} ${index + 1}` };
};
const indicatorPillClasses = 'absolute left-1/2 top-0 flex h-7 w-20 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 shadow-lg backdrop-blur';



const labelClasses = 'flex flex-1 cursor-pointer flex-col items-center justify-center px-6 py-4 text-center';



const NodeGraphNode = memo((props) => {

  const { data, id, readOnly } = props;

  const { theme, versionInfo, node, onClicked } = data;

  const connectionNodeId = useStore((state) => state.connectionNodeId);

  const isConnecting = !!connectionNodeId;

  const isTarget = connectionNodeId && connectionNodeId !== id;

  const [metadata, setMetadata] = useState(null);

  const [styling, setStyling] = useState(null);



  const persona = getNodePersonaDetails(versionInfo, node);

  const isSelected = data.isSelected;



  const height = Math.max(

    defaultHeight,

    (metadata ? metadata.inputs.length + metadata.outputs.length + metadata.events.length : 0) * IOHeight

  );



  const warnings = getWarningsForNode(node);



  useEffect(() => {

    let newStyling = getMessageStyling(['text'], persona);



    newStyling = {

      ...newStyling,

      backgroundColor: isTarget || isSelected ? 'rgba(56, 189, 248, 0.15)' : newStyling.backgroundColor,

      borderStyle: isTarget ? 'dashed' : 'solid',

      borderColor: isSelected ? 'rgba(56, 189, 248, 0.65)' : newStyling.borderColor,

      className: clsx(

        'transition-all duration-200',

        isSelected ? 'ring-2 ring-sky-400/70 ring-offset-2 ring-offset-slate-950/50' : 'ring-0'

      ),

    };



    setStyling(newStyling);

  }, [persona, isSelected, isTarget]);



  useEffect(() => {

    if (node) {

      const meta = getInputsAndOutputsForNode(node);

      const normalizedMeta = {
        ...meta,
        inputs: (meta.inputs || []).map((input, index) => normalizeOption(input, index, 'input')),
        outputs: (meta.outputs || []).map((output, index) => normalizeOption(output, index, 'output')),
        events: (meta.events || []).map((event, index) => normalizeOption(event, index, 'event')),
      };

      setMetadata(normalizedMeta);

    }

  }, [node]);



  if (!metadata) {

    return null;

  }



  const hasWarnings = warnings && warnings.length > 0;

  const warningText = hasWarnings ? warnings.join('\n') : '';



  return (

    <NodeContainer styling={styling} height={height} width={defaultWidth}>
      <div className="custom-drag-handle absolute inset-x-0 top-0 h-6 cursor-grab active:cursor-grabbing" />


      {node.nodeType !== 'start' && (

        <Handle

          key={`trigger-default`}

          type="target"

          position={Position.Left}

          id={`trigger-default`}

          style={{ ...handleBaseStyle, left: 0, top: `${IOTopOffset}px` }}

          isConnectableStart={isConnecting}

        >

          <div style={{ ...leftHandleContainerStyle, color: '#fff' }}>

            <Play className="h-3.5 w-3.5" />

          </div>

        </Handle>

      )}



      {metadata.inputs.map((variable, index) => (

        <Handle

          key={`variable-${variable.value}`}

          type="target"

          position={Position.Left}

          id={`variable-${variable.value}`}

          style={{ ...handleBaseStyle, left: 0, top: `${IOTopOffset + IOHeight + index * IOHeight}px` }}

          isConnectableStart={isConnecting}

        >

          <div style={{ ...leftHandleContainerStyle, color: '#fff' }}>

            <span className="h-2 w-2 rounded-full bg-white/90" />

            <span className="text-[10px] uppercase tracking-wider text-white/80">{variable.label}</span>

          </div>

        </Handle>

      ))}



      {!isConnecting && metadata.events.map((event, index) => (

        <Handle

          key={`event-${event.value}-${index}`}

          type="source"

          position={Position.Right}

          id={`event-${event.value}`}

          style={{ ...handleBaseStyle, right: 0, top: `${IOTopOffset + index * IOHeight}px` }}

        >

          <div style={{ ...rightHandleContainerStyle, color: '#fff' }}>

            <span className="text-[10px] uppercase tracking-wider text-white/80">{event.label}</span>

            <span className="h-2 w-2 rounded-full bg-white/90" />

          </div>

        </Handle>

      ))}



      {!isConnecting && metadata.outputs.map((output, index) => (

        <Handle

          key={`output-${output.value}`}

          type="source"

          position={Position.Right}

          id={`output-${output.value}`}

          style={{ ...handleBaseStyle, right: 0, top: `${IOTopOffset + (metadata.events.length + index) * IOHeight}px` }}

        >

          <div style={{ ...rightHandleContainerStyle, color: '#fff' }}>

            <span className="text-[10px] uppercase tracking-wider text-white/80">{output.label}</span>

            <span className="h-2 w-2 rounded-full bg-white/90" />

          </div>

        </Handle>

      ))}



      <div className={indicatorPillClasses}>

        <GripVertical className="h-4 w-4" />

      </div>



      <div className={labelClasses} onClick={onClicked}>

        <span

          className="text-sm font-semibold tracking-wide"

          style={{ color: styling?.color || '#f1f5f9' }}

        >

          {node.instanceName}

        </span>

        <span className="mt-1 text-[10px] uppercase tracking-[0.35em] text-white/40">{node.nodeType}</span>

      </div>



      {hasWarnings && (

        <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-900" title={warningText}>

          <AlertCircle className="h-4 w-4" />

        </div>

      )}

    </NodeContainer>

  );

});



export default NodeGraphNode;

