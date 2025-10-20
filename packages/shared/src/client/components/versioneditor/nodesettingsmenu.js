import React, { useEffect, useState, useRef } from "react";
import { NodeInputsEditor } from "./nodeinputseditor";
import { SettingsMenu } from "@src/client/components/settingsmenus/settingsmenu";
import { nodeTypeMenus } from "./nodetypemenus.js";
import { defaultAppTheme } from "@src/common/theme";
import { getWarningsForNode } from "./versioneditorutils";
import { PersonaChooser } from "./personas/personachooser";

const treatAsDebugCheckbox = [{
  label: "Hide output (editors can toggle 'Showing debug messages' to see output)",
  type: "checkbox",
  path: "hideOutput",
  defaultValue: false,
  tooltip: "Hide output (editors can toggle 'Showing debug messages' to see output)",
}];

const buttonStyles = {
  subtle: "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus:ring-slate-500",
  primary: "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-300",
  danger: "inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-rose-500 dark:hover:bg-rose-400 dark:focus:ring-rose-300",
  outline: "inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-500",
};

function ConfirmDialog({ open, title, description, onCancel, onConfirm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
        {title ? <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2> : null}
        {description ? (
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={buttonStyles.outline}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={buttonStyles.danger}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

const warningStyles = "rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-700 shadow-sm dark:border-amber-400/50 dark:bg-amber-900/40 dark:text-amber-100";

export function NodeSettingsMenu(params) {
  const { node, nodes, onChange, onNodeStructureChange, onPersonaListChange, readOnly, versionInfo } = params;
  const [popupDialogOpen, setPopupDialogOpen] = useState(false);
  const [warningText, setWarningText] = useState(null);
  const [warningTitle, setWarningTitle] = useState(null);
  const onConfirmRef = useRef(null);

  if (!node) {
    return null;
  }

  const menu = nodeTypeMenus[node.nodeType];
  const isCustomComponent = node.nodeType === "customComponent";
  const [showAdvanced, setShowAdvanced] = useState(() => !isCustomComponent);

  useEffect(() => {
    setShowAdvanced(!isCustomComponent);
  }, [isCustomComponent, node.instanceID]);

  const onVariableChanged = (object, relativePath, newValue) => {
    onChange?.(object, relativePath, newValue);
    if (relativePath === "instanceName" || relativePath === "inputs" || relativePath === "personaLocation") {
      onNodeStructureChange?.(node, "visualUpdateNeeded", {});
    }
  };

  const handleDuplicate = () => {
    onNodeStructureChange?.(node, "duplicate", {});
  };

  const handleCancelPopup = () => {
    setPopupDialogOpen(false);
    setWarningText(null);
    setWarningTitle(null);
    onConfirmRef.current = null;
  };

  const handleDelete = () => {
    setWarningText(`Are you sure you want to permanently delete the node "${node.instanceName}"? You will lose all settings permanently.`);
    setWarningTitle(`Delete Node "${node.instanceName}"?`);
    onConfirmRef.current = () => onNodeStructureChange?.(node, "delete", {});
    setPopupDialogOpen(true);
  };

  const handleCopyParams = () => {
    setWarningText(`Are you sure you want to overwrite the endpoint of all nodes of type "${node.nodeType}"? You will lose all existing settings permanently.`);
    setWarningTitle("Copy parameters");
    onConfirmRef.current = () => onNodeStructureChange?.(node, "copyParamsToSameType", {});
    setPopupDialogOpen(true);
  };

  const handleConfirmPopup = () => {
    setPopupDialogOpen(false);
    const confirm = onConfirmRef.current;
    onConfirmRef.current = null;
    confirm?.();
  };

  const onInputChanged = (inputObject, path, newValue) => {
    onVariableChanged(inputObject, path, newValue);
    onNodeStructureChange?.(node, "input", {});
  };

  const renderWarnings = (nodeToCheck) => {
    const warnings = getWarningsForNode(nodeToCheck);
    if (!warnings || warnings.length === 0) {
      return null;
    }

    return (
      <div className={warningStyles}>
        <p className="text-sm font-semibold">Warnings</p>
        <ul className="mt-2 space-y-1 text-sm leading-5">
          {warnings.map((warning) => (
            <li key={warning}>Warning: {warning}</li>
          ))}
        </ul>
      </div>
    );
  };

  const advancedContent = (
    <React.Fragment>
      {renderWarnings(node)}

      <SettingsMenu
        menu={treatAsDebugCheckbox}
        rootObject={node}
        onChange={onVariableChanged}
        readOnly={readOnly}
        key="treatAsDebugCheckbox"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Persona</p>
        <PersonaChooser
          theme={defaultAppTheme}
          node={node}
          versionInfo={versionInfo}
          onChange={onVariableChanged}
          onPersonaListChange={onPersonaListChange}
          readOnly={readOnly}
        />
      </div>

      <div className="space-y-3">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Options</p>
        <SettingsMenu
          menu={menu}
          rootObject={node}
          onChange={onVariableChanged}
          readOnly={readOnly}
          key="topLevelNodeOptions"
        />
      </div>

      {!node.isSourceNode ? (
        <NodeInputsEditor
          node={node}
          nodes={nodes}
          readOnly={readOnly}
          onChange={onInputChanged}
        />
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={handleDuplicate}
          disabled={readOnly}
          className={buttonStyles.primary}
        >
          Duplicate Node
        </button>
        <button
          type="button"
          onClick={handleCopyParams}
          disabled={readOnly}
          className={buttonStyles.subtle}
        >
          Copy Parameters To All {node.nodeType} Nodes
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={readOnly}
          className={buttonStyles.danger}
        >
          Delete Node
        </button>
      </div>
    </React.Fragment>
  );

  const componentMetadata = node.params?.metadata || {};
  const componentName = componentMetadata.componentName || node.instanceName || "Custom Component";
  const componentID = node.params?.componentID || "Unassigned";
  const componentVersion = node.params?.version;
  let componentVersionLabel = "Unversioned";
  if (typeof componentVersion === "string" && componentVersion.trim().length > 0) {
    componentVersionLabel = componentVersion;
  } else if (componentVersion && typeof componentVersion === "object") {
    const major = Number.isFinite(componentVersion.major) ? componentVersion.major : 0;
    const minor = Number.isFinite(componentVersion.minor) ? componentVersion.minor : 0;
    const patch = Number.isFinite(componentVersion.patch) ? componentVersion.patch : 0;
    componentVersionLabel = `${major}.${minor}.${patch}`;
  }

  const customComponentBasicsMenu = React.useMemo(() => {
    if (!isCustomComponent) {
      return null;
    }
    return [
      {
        label: "Instance Basics",
        type: "fieldlist",
        fields: [
          {
            label: "Name this instance",
            type: "text",
            path: "instanceName",
            tooltip: "Unique name used when referencing this component instance.",
            maxChar: 60,
            multiline: false,
            defaultValue: node.instanceName || "Custom Component",
          },
        ],
      },
    ];
  }, [isCustomComponent, node.instanceName]);

  return (
    <React.Fragment>
      <div className="space-y-6">
        {isCustomComponent ? (
          <React.Fragment>
            {customComponentBasicsMenu ? (
              <SettingsMenu
                menu={customComponentBasicsMenu}
                rootObject={node}
                onChange={onVariableChanged}
                readOnly={readOnly}
                key="customComponentBasics"
              />
            ) : null}

            <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-slate-200">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-700 dark:text-slate-100">{componentName}</span>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Component
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-semibold text-slate-600 dark:text-slate-200">Component ID:</span>{" "}
                  <code className="rounded bg-slate-200/60 px-[0.35rem] py-[0.1rem] text-xs tracking-tight text-slate-700 dark:bg-slate-800/80 dark:text-slate-100">
                    {componentID}
                  </code>
                </div>
                <div>
                  <span className="font-semibold text-slate-600 dark:text-slate-200">Version:</span>{" "}
                  <span>{componentVersionLabel}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => onNodeStructureChange?.(node, "editCustomComponent", {})}
                className={buttonStyles.primary}
                disabled={readOnly}
              >
                Open Component Editor
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced((previous) => !previous)}
                className={buttonStyles.subtle}
              >
                {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
              </button>
            </div>

            {showAdvanced ? advancedContent : null}
          </React.Fragment>
        ) : (
          advancedContent
        )}
      </div>

      <ConfirmDialog
        open={popupDialogOpen}
        title={warningTitle}
        description={warningText}
        onCancel={handleCancelPopup}
        onConfirm={handleConfirmPopup}
      />
    </React.Fragment>
  );
}
