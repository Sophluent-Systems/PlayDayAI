'use client';

import React, { useState, useEffect } from "react";
import { SettingsMenu } from "@src/client/components/settingsmenus/settingsmenu";
import { NodeMultiSelect } from "@src/client/components/nodemultiselect";

const topLevelCheckbox = [
  {
    label: "Include message history as input",
    type: "checkbox",
    path: "includeHistory",
    defaultValue: true,
    tooltip: "Publish to the world?",
  },
];

const additionalOptions = [
  {
    label: "Advanced",
    type: "subSection",
    fields: [
      {
        label: "Ignore compression",
        type: "checkbox",
        path: "historyParams.ignoreCompression",
        defaultValue: false,
        tooltip: "Include all messages, ignoring compression (might create very large requests)",
      },
      {
        label: "Include deleted",
        type: "checkbox",
        path: "historyParams.includeDeleted",
        defaultValue: false,
        tooltip: "Include messages that have been deleted",
      },
      {
        label: "Include interrupted (errors, stopped by user)",
        type: "checkbox",
        path: "historyParams.includeFailed",
        defaultValue: false,
        tooltip: "Include messages that have failed or been halted",
      },
    ],
  },
];

const spanModeOption = [
  {
    label: "History Options",
    type: "radio",
    options: [
      { label: "Full history", value: "full" },
      { label: "Exclude certain ranges", value: "exclude" },
      { label: "Include only certain ranges", value: "include" },
    ],
    path: "historyParams.spanSelectionMode",
    defaultValue: "full",
    tooltip: "Include only certain ranges of the history?",
  },
];

const excludeOptions = [
  {
    label: "excludeOptions",
    type: "fieldlist",
    fields: [
      {
        label: "# of items to exclude from start of history",
        type: "decimal",
        range: [0, 1000],
        path: "startingSpan",
        defaultValue: 0,
        tooltip: "The number of 'messages' in the history to remove starting from the beginning of the list",
      },
      {
        label: "# of items to exclude from recent history",
        type: "decimal",
        range: [0, 1000],
        path: "endingSpan",
        defaultValue: 0,
        tooltip: "The number of 'messages' in the history to remove, starting from the most recent message",
      },
    ],
  },
];

const includeOptions = [
  {
    label: "includeOptions",
    type: "fieldlist",
    fields: [
      {
        label: "# of items to include from start of history",
        type: "decimal",
        range: [0, 1000],
        path: "historyParams.startingSpan",
        tooltip: "The number of 'messages' in the history to include starting from the beginning of the list",
      },
      {
        label: "# of items to include from recent history",
        type: "decimal",
        range: [0, 1000],
        path: "historyParams.endingSpan",
        tooltip: "The number of 'messages' in the history to include, starting from the most recent message",
      },
    ],
  },
];

export function HistoryInputSelector({ nodes, input, onChange, readOnly }) {
  const [includeHistory, setIncludeHistory] = useState(true);

  const onVariableChanged = (rootObject, path, value) => {
    if (path === "includeHistory") {
      setIncludeHistory(Boolean(value));
    }

    if (typeof path !== "string") {
      console.error("HistoryInputSelector:onVariableChanged received invalid path", path);
      return;
    }

    onChange?.(rootObject, path, value);
  };

  useEffect(() => {
    if (input) {
      setIncludeHistory(Boolean(input.includeHistory));
    }
  }, [input]);

  if (!input || !nodes) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <SettingsMenu
        menu={topLevelCheckbox}
        rootObject={input}
        onChange={onVariableChanged}
        readOnly={readOnly}
      />

      <div className="mt-4 space-y-4">
        <SettingsMenu
          menu={spanModeOption}
          rootObject={input}
          onChange={onVariableChanged}
          readOnly={!includeHistory || readOnly}
        />

        <NodeMultiSelect
          nodes={nodes}
          rootObject={input}
          label='Select nodes to include (empty means "all nodes")'
          tooltip="Select nodes to include in the history"
          path="historyParams.includedNodes"
          defaultValue={[]}
          readOnly={!includeHistory || readOnly}
          onChange={(...params) => onVariableChanged(...params)}
        />

        {input.historyParams?.spanSelectionMode === "exclude" ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800">
            <SettingsMenu
              menu={excludeOptions}
              rootObject={input}
              onChange={onVariableChanged}
              readOnly={!includeHistory || readOnly}
            />
          </div>
        ) : null}

        {input.historyParams?.spanSelectionMode === "include" ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800">
            <SettingsMenu
              menu={includeOptions}
              rootObject={input}
              onChange={onVariableChanged}
              readOnly={!includeHistory || readOnly}
            />
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-900">
          <SettingsMenu
            menu={additionalOptions}
            rootObject={input}
            onChange={onVariableChanged}
            readOnly={!includeHistory || readOnly}
          />
        </div>
      </div>
    </div>
  );
}
