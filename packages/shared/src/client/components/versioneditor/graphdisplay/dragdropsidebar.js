'use client';
import React from "react";
import { NodeContainer } from "./nodecontainer";
import { getPersonaFromLocation } from "@src/common/personainfo";
import { getMessageStyling } from "@src/client/themestyling";
import { getAddableNodeTypes } from "@src/common/nodeMetadata";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";

const addableNodeTypes = getAddableNodeTypes();

export const DragDropSidebar = ({ theme, versionInfo, readOnly }) => {
  const nodes = versionInfo.stateMachineDescription.nodes;

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  if (!nodes) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-wrap gap-3 overflow-y-auto p-4">
      <div className="w-full text-xs font-semibold uppercase tracking-[0.35em] text-slate-300/90">
        Add a blank node from a template
      </div>
      {addableNodeTypes.map((addableTemplate) => {
        const nodeMetadata = getMetadataForNodeType(addableTemplate.nodeType);
        const personaLocation = {
          source: "builtin",
          personaID: nodeMetadata.defaultPersona,
        };
        const persona = getPersonaFromLocation(versionInfo, personaLocation);
        const styling = getMessageStyling(["text"], persona);

        return (
          <NodeContainer
            key={addableTemplate.nodeType}
            width={180}
            height={48}
            styling={styling}
            draggable={!readOnly}
            onDragStart={(event) =>
              !readOnly && onDragStart(event, JSON.stringify({ action: "add", template: addableTemplate.nodeType }))
            }
          >
            <span className="text-sm font-semibold" style={{ color: styling.color }}>
              {addableTemplate.label}
            </span>
          </NodeContainer>
        );
      })}

      <div className="w-full pt-4 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300/90">
        Or duplicate an existing node
      </div>
      {nodes.map((node) => {
        const nodeMetadata = getMetadataForNodeType(node.nodeType);
        const personaLocation = {
          source: "builtin",
          personaID: nodeMetadata.defaultPersona,
        };
        const persona = getPersonaFromLocation(versionInfo, personaLocation);
        const styling = getMessageStyling(["text"], persona);

        return (
          <NodeContainer
            key={node.instanceID}
            width={180}
            height={48}
            styling={styling}
            draggable={!readOnly}
            onDragStart={(event) =>
              !readOnly && onDragStart(event, JSON.stringify({ action: "duplicate", node }))
            }
          >
            <span className="truncate text-sm font-semibold" style={{ color: styling.color }}>
              {node.instanceName}
            </span>
          </NodeContainer>
        );
      })}
    </div>
  );
};
