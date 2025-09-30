import React from "react";
import { Sparkles } from "lucide-react";
import { SettingsMenu } from "@src/client/components/settingsmenus/settingsmenu";
import { PersonaChooser } from "./personas/personachooser";
import { setNestedObjectProperty } from "@src/common/objects";
import { CustomInputControl } from "../standard/custominputcontrol";

const personaLabel = '"Who" is performing this work, and what should the output look like?';

export function NodeInitMenu(props) {
  const { node, menu, versionInfo, onPersonaListChange, gameTheme, readOnly } = props;

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Quick settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Configure the essentials before diving into full node options.</p>
        </div>
      </header>

      <CustomInputControl label={personaLabel}>
        <PersonaChooser
          theme={gameTheme}
          node={node}
          versionInfo={versionInfo}
          onChange={(object, relativePath, newValue) => setNestedObjectProperty(object, relativePath, newValue)}
          onPersonaListChange={onPersonaListChange}
          readOnly={readOnly}
        />
      </CustomInputControl>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <SettingsMenu
          menu={menu}
          rootObject={node}
          onChange={(object, relativePath, newValue) => setNestedObjectProperty(object, relativePath, newValue)}
          readOnly={readOnly}
          key={"nodeInitMenu"}
        />
      </div>
    </section>
  );
}


