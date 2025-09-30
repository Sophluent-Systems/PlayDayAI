import React from 'react';
import { PersonaEditor } from './personaeditor';
import { Undo2, Save } from 'lucide-react';

const buttonStyles = {
  outline: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-slate-500',
  primary: 'inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-300',
};

export function InlinePersonaEditor(props) {
  const { theme, persona, onChange, onCancel, onSave, readOnly } = props;

  return (
    <div className='flex w-full flex-col gap-6'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-lg font-semibold text-slate-800 dark:text-slate-100'>Persona</h3>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={onCancel}
            className={buttonStyles.outline}
          >
            <Undo2 className='h-4 w-4' />
            Discard
          </button>
          <button
            type='button'
            onClick={() => onSave?.(persona)}
            className={buttonStyles.primary}
          >
            <Save className='h-4 w-4' />
            Save
          </button>
        </div>
      </div>

      <PersonaEditor theme={theme} persona={persona} onChange={onChange} readOnly={readOnly} />
    </div>
  );
}
