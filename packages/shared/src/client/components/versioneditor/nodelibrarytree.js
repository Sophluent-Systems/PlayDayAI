'use client';
import React from "react";
import clsx from "clsx";
import { ChevronRight, Layers, Plus, Copy, PackagePlus } from "lucide-react";
import { getPersonaFromLocation } from "@src/common/personainfo";
import { getMessageStyling } from "@src/client/themestyling";
import { getAddableNodeTypes, getMetadataForNodeType } from "@src/common/nodeMetadata";
import {
  getVisualsForNode,
  buildVisualsFromStyling,
  nodeUsesCustomPersona,
} from "./nodepalette";

const addableNodeTypes = getAddableNodeTypes();

const MEDIA_TYPES = new Set(["audio", "image", "video"]);
const AI_NODE_TYPES = new Set(["llm", "llmData", "openAiAgent", "microsoftAgentFramework", "uiAutomation", "staticText", "imagePromptWriter", "suggestionsWriter", "scenario"]);
const MEDIA_NODE_TYPES = new Set(["imageGenerator", "videoGenerator", "tts", "stt", "audioPlayback"]);
const LOGIC_NODE_TYPES = new Set(["ifThenElse", "forLoop", "whileLoop", "delay", "randomNumber"]);
const DATA_NODE_TYPES = new Set(["codeBlock", "fileStore", "arrayIterator", "arrayIndex", "perplexitySearch"]);

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

function buildGroupedTemplates() {
  const assigned = new Set();

  const groups = TEMPLATE_GROUPS.reduce((accumulator, group) => {
    const templates = addableNodeTypes.reduce((innerAccumulator, template) => {
      if (assigned.has(template.nodeType)) {
        return innerAccumulator;
      }

      const metadata = getMetadataForNodeType(template.nodeType);
      if (group.match(template.nodeType, metadata)) {
        assigned.add(template.nodeType);
        innerAccumulator.push({ template, metadata });
      }

      return innerAccumulator;
    }, []);

    if (templates.length > 0) {
      accumulator.push({ ...group, templates });
    }
    return accumulator;
  }, []);

  return groups;
}

const groupedTemplates = buildGroupedTemplates();

function TreeToggle({ expanded }) {
  return (
    <ChevronRight
      className={`h-4 w-4 transition-transform ${expanded ? "rotate-90 text-sky-300" : "text-slate-400"}`}
    />
  );
}

function TreeBranchButton({ label, icon, expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-sky-500/60"
      aria-expanded={expanded}
    >
      <TreeToggle expanded={expanded} />
      {icon ? <span className="flex h-6 w-6 items-center justify-center text-slate-300">{icon}</span> : null}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}

function TreeLeafButton({
  label,
  description,
  onDoubleClick,
  draggable,
  onDragStart,
  actionIcon,
  visuals = {},
}) {
  const inlineStyle = {
    backgroundColor: visuals.backgroundColor ?? "rgba(12, 26, 48, 0.85)",
    borderColor: visuals.borderColor ?? "rgba(148, 163, 184, 0.45)",
    color: visuals.textColor ?? "#f8fafc",
    boxShadow: visuals.shadow,
  };
  const dotStyle = {
    backgroundColor: visuals.dotColor ?? "rgba(248, 250, 252, 0.8)",
  };
  const hoverClass = visuals.hoverClass ?? "hover:border-white/40 hover:shadow-[0_16px_40px_-20px_rgba(148,163,184,0.45)]";
  const secondaryColor = visuals.secondaryColor ?? "rgba(248, 250, 252, 0.75)";

  return (
      <div
        className={clsx(
          "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-xs font-semibold transition",
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          hoverClass
        )}
        style={inlineStyle}
        draggable={draggable}
        onDragStart={onDragStart}
        onDoubleClick={onDoubleClick}
      >
        {actionIcon ? (
          <span className="flex h-5 w-5 items-center justify-center" style={{ color: inlineStyle.color }}>
            {React.cloneElement(actionIcon, { className: "h-4 w-4" })}
          </span>
        ) : null}
        <div className="flex flex-1 flex-col">
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: inlineStyle.color }}>
            <span className="h-2.5 w-2.5 rounded-full" style={dotStyle} aria-hidden />
            <span className="truncate">{label}</span>
          </span>
          {description ? (
            <span className="truncate text-[10px] uppercase tracking-[0.35em]" style={{ color: secondaryColor }}>
              {description}
            </span>
          ) : null}
        </div>
      </div>
  );
}

export function NodeLibraryTree({ versionInfo, readOnly }) {
  const nodes = versionInfo?.stateMachineDescription?.nodes ?? [];
  const customComponents = Array.isArray(versionInfo?.stateMachineDescription?.customComponents)
    ? versionInfo.stateMachineDescription.customComponents
    : [];

  const [expandedBranches, setExpandedBranches] = React.useState(() => {
    const defaults = { templates: true, existing: true };
    if (customComponents.length > 0) {
      defaults.components = true;
    }
    groupedTemplates.forEach((group) => {
      defaults[`templates:${group.key}`] = group.key === "user-input";
    });
    return defaults;
  });

  React.useEffect(() => {
    if (customComponents.length === 0) {
      return;
    }
    setExpandedBranches((prev) => {
      let next = prev;
      let changed = false;
      if (prev.components === undefined) {
        next = { ...prev, components: true };
        changed = true;
      }
      customComponents.forEach((definition) => {
        const key = `components:${definition.library || "personal"}`;
        if (next[key] === undefined) {
          if (!changed) {
            next = { ...next };
            changed = true;
          }
          next[key] = true;
        }
      });
      return changed ? next : prev;
    });
  }, [customComponents]);

  const toggleBranch = React.useCallback((key) => {
    setExpandedBranches((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }, []);

  const nodeGroups = React.useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => {
      const metadata = getMetadataForNodeType(node.nodeType);
      const label = metadata?.label || metadata?.name || node.nodeType;
      if (!map.has(label)) {
        map.set(label, {
          label,
          nodeType: node.nodeType,
          nodes: [],
        });
      }
      map.get(label).nodes.push(node);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [nodes]);

  const handleTemplateDragStart = React.useCallback((event, payload) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }, []);

  const renderTemplateGroup = (group) => {
    const branchKey = `templates:${group.key}`;
    const isExpanded = expandedBranches[branchKey] ?? false;

    return (
      <li key={group.key} className="space-y-1">
        <TreeBranchButton
          label={group.label}
          expanded={isExpanded}
          icon={<Layers className="h-4 w-4" />}
          onClick={() => toggleBranch(branchKey)}
        />
        {isExpanded ? (
          <ul className="ml-6 space-y-1 border-l border-white/10 pl-3">
            {group.templates.map(({ template, metadata }) => {
              const visuals = getVisualsForNode(template.nodeType, metadata);
              const personaLocation = {
                source: "builtin",
                personaID: metadata?.defaultPersona,
              };
              const persona = getPersonaFromLocation(versionInfo, personaLocation);
              const dragStyling = getMessageStyling(["text"], persona);

              return (
                <li key={template.nodeType}>
                  <TreeLeafButton
                    label={template.label}
                    description={template.nodeType}
                    draggable={!readOnly}
                    actionIcon={<Plus className="h-4 w-4" />}
                    visuals={visuals}
                    onDragStart={(event) =>
                      !readOnly &&
                      handleTemplateDragStart(event, {
                        action: "add",
                        template: template.nodeType,
                        styling: dragStyling,
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  const renderCustomComponents = () => {
    const branchKey = "components";
    const expanded = expandedBranches[branchKey] ?? true;
    if (customComponents.length === 0) {
      return (
        <li className="space-y-1">
          <TreeBranchButton
            label="Custom Components"
            expanded={expanded}
            icon={<PackagePlus className="h-4 w-4" />}
            onClick={() => toggleBranch(branchKey)}
          />
          {expanded ? (
            <div className="ml-6 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-4 text-xs text-slate-400">
              Save grouped nodes as a component to reuse them here.
            </div>
          ) : null}
        </li>
      );
    }

    const groupedByLibrary = customComponents.reduce((accumulator, definition) => {
      const key = definition.library || "personal";
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(definition);
      return accumulator;
    }, {});

    const libraryLabels = {
      personal: "My Components",
      shared: "Shared Library",
    };

    return (
      <li className="space-y-1">
        <TreeBranchButton
          label={`Custom Components (${customComponents.length})`}
          expanded={expanded}
          icon={<PackagePlus className="h-4 w-4" />}
          onClick={() => toggleBranch(branchKey)}
        />
        {expanded ? (
          <ul className="ml-6 space-y-2 border-l border-white/10 pl-3">
            {Object.entries(groupedByLibrary).map(([libraryKey, items]) => {
              const branchId = `components:${libraryKey}`;
              const branchExpanded = expandedBranches[branchId] ?? true;
              const friendlyLabel = libraryLabels[libraryKey] || libraryKey;
              return (
                <li key={branchId} className="space-y-1">
                  <TreeBranchButton
                    label={`${friendlyLabel} (${items.length})`}
                    expanded={branchExpanded}
                    icon={<Layers className="h-4 w-4" />}
                    onClick={() => toggleBranch(branchId)}
                  />
                  {branchExpanded ? (
                    <ul className="ml-6 space-y-1 border-l border-white/10 pl-3">
                      {items.map((definition) => (
                        <li key={definition.componentID}>
                          <TreeLeafButton
                            label={definition.name || "Custom Component"}
                            description={definition.description || "Reusable component"}
                            draggable={!readOnly}
                            visuals={{
                              backgroundColor: "rgba(56,189,248,0.12)",
                              borderColor: "rgba(56,189,248,0.45)",
                              textColor: "#f8fafc",
                              dotColor: "rgba(56,189,248,0.8)",
                              hoverClass:
                                "hover:border-sky-400/60 hover:shadow-[0_16px_40px_-20px_rgba(56,189,248,0.35)]",
                            }}
                            onDragStart={(event) =>
                              !readOnly &&
                              handleTemplateDragStart(event, {
                                action: "addCustomComponent",
                                componentID: definition.componentID,
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  const renderExistingNodes = () => {
    const branchKey = "existing";
    const expanded = expandedBranches[branchKey] ?? true;

    if (nodes.length === 0) {
      return (
        <li className="space-y-1">
          <TreeBranchButton
            label="Existing Nodes"
            expanded={expanded}
            icon={<Copy className="h-4 w-4" />}
            onClick={() => toggleBranch(branchKey)}
          />
          {expanded ? (
            <div className="ml-6 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-4 text-xs text-slate-400">
              Add a template to start duplicating nodes.
            </div>
          ) : null}
        </li>
      );
    }

    return (
      <li className="space-y-1">
        <TreeBranchButton
          label="Existing Nodes"
          expanded={expanded}
          icon={<Copy className="h-4 w-4" />}
          onClick={() => toggleBranch(branchKey)}
        />
        {expanded ? (
          <ul className="ml-6 space-y-2 border-l border-white/10 pl-3">
            {nodeGroups.map((group) => {
              const branchId = `existing:${group.label}`;
              const branchExpanded = expandedBranches[branchId] ?? false;
              return (
                <li key={branchId} className="space-y-1">
                  <TreeBranchButton
                    label={`${group.label} (${group.nodes.length})`}
                    expanded={branchExpanded}
                    onClick={() => toggleBranch(branchId)}
                    icon={<Layers className="h-4 w-4" />}
                  />
                  {branchExpanded ? (
                    <ul className="ml-6 space-y-1 border-l border-white/10 pl-3">
                      {group.nodes.map((node) => {
                        const metadata = getMetadataForNodeType(node.nodeType);
                        const defaultPersonaLocation = {
                          source: "builtin",
                          personaID: metadata?.defaultPersona,
                        };
                        const usesCustom = nodeUsesCustomPersona(node, metadata);
                        const persona = usesCustom
                          ? getPersonaFromLocation(versionInfo, node.personaLocation)
                          : null;
                        const personaForStyling =
                          persona ?? getPersonaFromLocation(versionInfo, defaultPersonaLocation);
                        const dragStyling = getMessageStyling(["text"], personaForStyling);
                        const visuals = usesCustom
                          ? buildVisualsFromStyling(dragStyling)
                          : getVisualsForNode(node.nodeType, metadata);

                        return (
                          <li key={node.instanceID}>
                            <TreeLeafButton
                              label={node.instanceName}
                              description={node.nodeType}
                              draggable={!readOnly}
                              actionIcon={<Copy className="h-4 w-4" />}
                              visuals={visuals}
                              onDragStart={(event) =>
                                !readOnly &&
                                handleTemplateDragStart(event, {
                                  action: "duplicate",
                                  node,
                                  styling: dragStyling,
                                })
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-200/80">
        Node Library
      </div>
      <nav className="flex-1 overflow-y-auto pr-2">
        <ul className="space-y-2">
          <li className="space-y-1">
            <TreeBranchButton
              label="Templates"
              expanded={expandedBranches.templates ?? true}
              icon={<Layers className="h-4 w-4" />}
              onClick={() => toggleBranch("templates")}
            />
            {expandedBranches.templates ? (
              <ul className="ml-6 space-y-2 border-l border-white/10 pl-3">
                {groupedTemplates.map((group) => renderTemplateGroup(group))}
              </ul>
            ) : null}
          </li>
          {renderCustomComponents()}
          {renderExistingNodes()}
        </ul>
      </nav>
    </div>
  );
}

export default NodeLibraryTree;
