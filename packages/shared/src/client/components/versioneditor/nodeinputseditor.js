'use client';

import React, { useState, useEffect } from "react";
import { Plus, Save, Trash2, Pencil } from "lucide-react";
import { HistoryInputSelector } from "./historyinputselector";
import { SettingsMenu } from "@src/client/components/settingsmenus/settingsmenu";
import { getMetadataForNodeType } from "@src/common/nodeMetadata";
import { CollapsibleSection } from "@src/client/components/collapsiblesection";

const requireAllEventTriggersOption = [
  {
    label: "Require all event triggers to fire before running (if unchecked, run when any 1 event fires)",
    type: "checkbox",
    path: "requireAllEventTriggers",
    defaultValue: false,
    tooltip:
      "Require all the input events to fire to be present before running this node (or if unchecked run once for each input that becomes available).",
  },
  {
    label: "Require all variables to be ready before running (if unchecked, run when any 1 event fires)",
    type: "checkbox",
    path: "requireAllVariables",
    defaultValue: false,
    tooltip:
      "Require all the variables to be present before running this node (or if unchecked run once for each input that becomes available).",
  },
];

const buttonStyles = {
  subtle:
    "inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-700",
  primary:
    "inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-300",
  accent:
    "inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:focus:ring-emerald-300",
  danger:
    "inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-400 dark:focus:ring-rose-300",
  outline:
    "inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-500",
};

export function NodeInputsEditor({ readOnly, node, onChange, nodes, producerNodeID }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [nodeLookupTable, setNodeLookupTable] = useState({});
  const [canUseHistoryAsInput, setCanUseHistoryAsInput] = useState(false);

  useEffect(() => {
    if (nodes && nodes.length) {
      const lookup = nodes.reduce((acc, current) => {
        acc[current.instanceID] = current;
        return acc;
      }, {});
      setNodeLookupTable(lookup);
    } else {
      setNodeLookupTable({});
    }
  }, [nodes]);

  useEffect(() => {
    if (node && producerNodeID) {
      const index = node.inputs.findIndex((input) => input.producerInstanceID === producerNodeID);
      if (index >= 0) {
        setEditingIndex(index);
      }
    }
  }, [producerNodeID, node]);

  useEffect(() => {
    if (node) {
      const metadata = getMetadataForNodeType(node.nodeType);
      setCanUseHistoryAsInput(Boolean(metadata?.nodeAttributes?.canUseHistoryAsInput));
    }
  }, [node]);

  const handleAddInput = () => {
    if (readOnly || !nodes?.length) {
      return;
    }

    const newInput = {
      producerInstanceID: nodes[0].instanceID,
      includeHistory: true,
      historyParams: {},
      param: {
        variable: "",
      },
    };

    const nextInputs = [...(node.inputs || []), newInput];
    const newIndex = nextInputs.length - 1;

    setEditingIndex(newIndex);
    handleFinishedEditing(nextInputs);
  };

  const handleDeleteInput = (index) => {
    if (readOnly || !node.inputs) {
      return;
    }

    const nextInputs = node.inputs.filter((_, inputIndex) => inputIndex !== index);

    if (editingIndex === index) {
      setEditingIndex(null);
    }

    handleFinishedEditing(nextInputs);
  };

  const handleEditInput = (index) => {
    if (readOnly) {
      return;
    }

    setEditingIndex(index);
  };

  const handleSaveButtonPress = () => {
    setEditingIndex(null);
  };

  function handleFinishedEditing(newNodesInputState) {
    onChange?.(node, "inputs", newNodesInputState);
  }

  const handleHistoryOptionChange = (rootObject, path, value) => {
    if (typeof path !== "string") {
      console.error("handleHistoryOptionChange: Likely caught inexplicable bug: rootObject=", rootObject);
      return;
    }

    onChange?.(rootObject, path, value);
  };

  if (!node) {
    return null;
  }

  const inputs = Array.isArray(node?.inputs) ? node.inputs : [];
  const hasInputs = inputs.length > 0;
  const collapsedSummary = hasInputs
    ? `${inputs.length} input${inputs.length === 1 ? "" : "s"} configured`
    : "No inputs configured";

  return (
    <CollapsibleSection
      title="Inputs"
      collapsedView={collapsedSummary}
      defaultExpanded={false}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Connect upstream nodes, control history sharing, and decide when this node should run.
          </div>
          <button
            type="button"
            onClick={handleAddInput}
            disabled={readOnly || !nodes?.length}
            className={buttonStyles.primary}
          >
            <Plus className="h-4 w-4" />
            Add input
          </button>
        </div>

        <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <p>Each input can include history, override parameters, or provide variables from previous nodes.</p>
          <p>Inputs run in the order shown. Drag to reorder for precise control.</p>
        </div>

        <div className="space-y-4">
        {hasInputs ? (
          inputs.map((input, index) => {
            const producer = nodeLookupTable[input.producerInstanceID];
            const nodeLabel = producer?.instanceName || producer?.nodeType || "Unknown node";
            const historySummary =
              canUseHistoryAsInput && input.includeHistory ? "History included" : "History ignored";
            const overrideSummary = input.param?.variable
              ? `overriding params.${input.param.variable}`
              : null;

            return (
              <div
                key={`input-${index}`}
                className="rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600"
              >
                {editingIndex === index ? (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Input node
                      </p>
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{nodeLabel}</p>
                    </div>

                    {canUseHistoryAsInput ? (
                      <HistoryInputSelector
                        node={node}
                        nodes={nodes}
                        input={input}
                        onChange={handleHistoryOptionChange}
                        readOnly={readOnly}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        This node type does not support history configuration.
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveButtonPress}
                        disabled={readOnly}
                        className={buttonStyles.primary}
                      >
                        <Save className="h-4 w-4" />
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => handleEditInput(index)}
                      className="flex flex-1 flex-col items-start text-left"
                    >
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Node: {nodeLabel}</span>
                      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {historySummary}
                        {overrideSummary ? (
                          <>
                            <br />
                            <span className="font-medium text-slate-400 dark:text-slate-500">{overrideSummary}</span>
                          </>
                        ) : null}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditInput(index)}
                        disabled={readOnly}
                        className={buttonStyles.outline}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInput(index)}
                        disabled={readOnly}
                        className={buttonStyles.danger}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
            No inputs configured yet. Click "Add input" to connect this node.
          </div>
        )}
        </div>

        {inputs.length > 1 ? (
          <div className="pt-2">
            <SettingsMenu
              menu={requireAllEventTriggersOption}
              rootObject={node}
              onChange={onChange}
              readOnly={readOnly}
              key={"requireAllEventTriggersOption"}
            />
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}
