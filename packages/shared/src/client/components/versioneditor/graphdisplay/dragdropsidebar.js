'use client';
import React from "react";
import { ChevronDown } from "lucide-react";
import { NodeContainer } from "./nodecontainer";
import { getPersonaFromLocation } from "@src/common/personainfo";
import { getMessageStyling } from "@src/client/themestyling";
import { getAddableNodeTypes, getMetadataForNodeType } from "@src/common/nodeMetadata";

const addableNodeTypes = getAddableNodeTypes();

const MEDIA_TYPES = new Set(["audio", "image", "video"]);
const AI_NODE_TYPES = new Set(["llm", "llmData", "staticText", "imagePromptWriter", "suggestionsWriter", "scenario"]);
const MEDIA_NODE_TYPES = new Set(["imageGenerator", "tts", "stt", "audioPlayback"]);
const LOGIC_NODE_TYPES = new Set(["ifThenElse", "forLoop", "whileLoop", "delay", "randomNumber"]);
const DATA_NODE_TYPES = new Set(["codeBlock", "fileStore", "arrayIterator", "arrayIndex"]);

const TEMPLATE_GROUPS = [
  {
    key: "user-input",
    label: "User Input & Capture",
    match: (_nodeType, metadata) => Boolean(metadata?.nodeAttributes?.userInput),
  },
  {
    key: "ai-generation",
    label: "AI Generation & Writing",
    match: (nodeType) => AI_NODE_TYPES.has(nodeType),
  },
  {
    key: "media",
    label: "Media & Output",
    match: (nodeType, metadata) =>
      MEDIA_NODE_TYPES.has(nodeType) ||
      (metadata?.nodeAttributes?.mediaTypes || []).some((type) => MEDIA_TYPES.has(type)),
  },
  {
    key: "logic",
    label: "Logic & Flow",
    match: (nodeType) => LOGIC_NODE_TYPES.has(nodeType),
  },
  {
    key: "data",
    label: "Data & Storage",
    match: (nodeType) => DATA_NODE_TYPES.has(nodeType),
  },
  {
    key: "other",
    label: "Other Nodes",
    match: () => true,
  },
];

const SIDEBAR_ITEM_HEIGHT = 44;

function buildGroupedTemplates() {
  const assigned = new Set();

  return TEMPLATE_GROUPS.map((group) => {
    const templates = addableNodeTypes.reduce((accumulator, template) => {
      if (assigned.has(template.nodeType)) {
        return accumulator;
      }

      const metadata = getMetadataForNodeType(template.nodeType);
      if (group.match(template.nodeType, metadata)) {
        assigned.add(template.nodeType);
        accumulator.push({ template, metadata });
      }

      return accumulator;
    }, []);

    if (templates.length === 0) {
      return null;
    }

    return {
      key: group.key,
      label: group.label,
      templates,
    };
  }).filter(Boolean);
}

const groupedTemplates = buildGroupedTemplates();

const headerTextClass = "text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400/90";

export const DragDropSidebar = ({ theme, versionInfo, readOnly }) => {
  const nodes = versionInfo.stateMachineDescription.nodes;

  const handleDragStart = (event, payload) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  if (!nodes) {
    return null;
  }

  const initialCollapsedState = React.useMemo(() => {
    const state = { existing: false };
    groupedTemplates.forEach((group) => {
      state[group.key] = false;
    });
    return state;
  }, []);

  const [collapsedSections, setCollapsedSections] = React.useState(initialCollapsedState);

  const toggleSection = React.useCallback((key) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }, []);

  const renderSectionHeader = (label, key) => {
    const isCollapsed = collapsedSections[key] ?? false;

    return (
      <button
        type="button"
        onClick={() => toggleSection(key)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left transition hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-slate-400/40"
        aria-expanded={!isCollapsed}
      >
        <span className={headerTextClass}>{label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
        />
      </button>
    );
  };

  const isExistingCollapsed = collapsedSections.existing ?? false;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="border-b border-white/10 px-4 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-300/80">
          Node Library
        </div>
      </div>
      <div className="h-full overflow-y-auto px-4 py-3 space-y-6">
        {groupedTemplates.map((group) => {
          const isCollapsed = collapsedSections[group.key] ?? false;

          return (
            <div key={group.key} className="space-y-2">
              {renderSectionHeader(group.label, group.key)}
              {!isCollapsed ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.templates.map(({ template, metadata }) => {
                    const personaLocation = {
                      source: "builtin",
                      personaID: metadata.defaultPersona,
                    };
                    const persona = getPersonaFromLocation(versionInfo, personaLocation);
                    const styling = getMessageStyling(["text"], persona);

                    return (
                      <NodeContainer
                        key={template.nodeType}
                        width="100%"
                        height={SIDEBAR_ITEM_HEIGHT}
                        styling={styling}
                        draggable={!readOnly}
                        onDragStart={(event) =>
                          !readOnly && handleDragStart(event, { action: "add", template: template.nodeType })
                        }
                        className="!px-3 !py-2 text-xs"
                      >
                        <span className="truncate font-semibold" style={{ color: styling.color }}>
                          {template.label}
                        </span>
                      </NodeContainer>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="space-y-2 border-t border-white/10 pt-4">
          {renderSectionHeader("Existing Nodes", "existing")}
          {!isExistingCollapsed ? (
            nodes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-[12px] text-slate-400">
                Add a template above to start duplicating nodes.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      width="100%"
                      height={SIDEBAR_ITEM_HEIGHT}
                      styling={styling}
                      draggable={!readOnly}
                      onDragStart={(event) =>
                        !readOnly && handleDragStart(event, { action: "duplicate", node })
                      }
                      className="!px-3 !py-2 text-xs"
                    >
                      <span className="truncate font-semibold" style={{ color: styling.color }}>
                        {node.instanceName}
                      </span>
                    </NodeContainer>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
