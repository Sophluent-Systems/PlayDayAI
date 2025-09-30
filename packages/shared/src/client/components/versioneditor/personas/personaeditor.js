import React, { useEffect, useState } from 'react';
import { IconChooser } from './iconchooser';
import { nullUndefinedOrEmpty, getNestedObjectProperty, setNestedObjectProperty } from '@src/common/objects';
import { FontChooser } from '@src/client/components/standard/fontchooser';
import { PersonaPreview } from './personapreview';
import { SettingsMenu } from '@src/client/components/settingsmenus/settingsmenu';
import { ColorChooser } from './colorchooser';
import { defaultAppTheme } from '@src/common/theme';

const menu = [
  {
    label: 'Persona',
    type: 'fieldlist',
    fields: [
      {
        label: 'Display Name',
        type: 'text',
        path: 'displayName',
        defaultValue: 'AI',
        tooltip: "The display name of the persona",
      },
      {
        label: "Identity (who is this persona's in a nutshell?)",
        type: 'text',
        path: 'identity',
        maxLength: 2096,
        defaultValue: 'AI',
        tooltip: 'Describe the persona succinctly',
      },
      {
        label: 'Hide from end-users (shown to editors only)',
        type: 'checkbox',
        path: 'hideFromEndUsers',
        defaultValue: false,
        tooltip: 'Display only to editors, not end-users',
      },
    ],
  },
];

const colorsToEdit = [
  { label: 'Message Background', path: 'theme.colors.messageBackgroundColor' },
  { label: 'Message Text', path: 'theme.colors.messageTextColor' },
  { label: 'Icon Color', path: 'theme.icon.color' },
  { label: 'Button Color', path: 'theme.colors.buttonColor' },
  { label: 'Audio Color', path: 'theme.colors.audioVisualizationColor' },
];

export function PersonaEditor(props) {
  const { theme, persona, mediaTypes, onChange, readOnly } = props;
  const [localCopy, setLocalCopy] = useState(persona);

  useEffect(() => {
    setLocalCopy(persona);
  }, [persona]);

  const onVariableChanged = (rootObject, field, value) => {
    if (nullUndefinedOrEmpty(localCopy)) {
      throw new Error('PersonaEditor: onVariableChanged: localCopy is null');
    }

    setLocalCopy((previous) => {
      const next = { ...previous };
      setNestedObjectProperty(next, field, value);
      return next;
    });
    onChange?.(rootObject, field, value);
  };

  if (nullUndefinedOrEmpty(persona)) {
    return null;
  }

  return (
    <div className='space-y-6'>
      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
        <SettingsMenu
          menu={menu}
          rootObject={persona}
          onChange={onVariableChanged}
          readOnly={readOnly}
        />
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Font</p>
        <FontChooser
          value={persona.theme.fonts.fontFamily}
          defaultValue={defaultAppTheme.fonts.fontFamily}
          onChange={(nextFont) => onVariableChanged(persona, 'theme.fonts.fontFamily', nextFont)}
          readOnly={readOnly}
        />
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Icon</p>
        <IconChooser
          value={persona.theme.icon.iconID}
          defaultValue={'Person'}
          onChange={(newValue) => onVariableChanged(persona, 'theme.icon.iconID', newValue)}
          readOnly={readOnly}
        />
      </div>

      <div className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {colorsToEdit.map((colorVar) => (
            <ColorChooser
              key={colorVar.path}
              label={colorVar.label}
              value={getNestedObjectProperty(persona, colorVar.path)}
              onChange={(newValue) => onVariableChanged(persona, colorVar.path, newValue)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      <div className='space-y-2'>
        <p className='text-sm font-semibold text-slate-700 dark:text-slate-200'>Preview</p>
        <div className='flex justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900'>
          <PersonaPreview theme={theme} persona={localCopy} mediaTypes={mediaTypes} extended={true} />
        </div>
      </div>
    </div>
  );
}
