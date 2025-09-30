import React, { useEffect, useState, useRef } from 'react';
import { BuiltInPersonas } from '@src/common/builtinpersonas';
import { PersonaCard } from './personacard';
import { InlinePersonaEditor } from './inlinepersonaeditor';
import { Plus, Pencil, ChevronDown, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { setNestedObjectProperty } from '@src/common/objects';
import { getMetadataForNodeType } from '@src/common/nodeMetadata';

const newOptionPersona = {
  personaID: 'new',
  displayName: 'Create New',
  theme: {
    colors: {
      messageBackgroundColor: '#ffffff',
      messageTextColor: '#000000',
      audioVisualizationColor: '#000000',
      buttonColor: '#f0f0f0',
    },
    fonts: {
      fontFamily: 'Inter, sans-serif',
    },
    icon: {
      iconID: 'Add',
      color: '#000000',
    },
  },
};

const areaTitles = {
  inline: 'Custom to this node',
  builtin: 'Built-in',
  version: 'Shared (available to any node in this version)',
};

const buttonStyles = {
  subtle: 'inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:focus:ring-slate-500',
  primary: 'inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-slate-300',
};

export function PersonaChooser(props) {
  const { theme, versionInfo, node, onChange, onPersonaListChange, onNodeStructureChange, readOnly } = props;
  const [personaOptions, setPersonaOptions] = useState(undefined);
  const [selectedIndex, setSelectedIndex] = useState({ index: undefined, category: undefined });
  const [mode, setMode] = useState('select');
  const [panelOpen, setPanelOpen] = useState(false);
  const selectedRef = useRef(null);
  const editingPersonaRef = useRef(null);

  function updatePersonaOptions(personaLocation) {
    const inlinePersonas = [{ persona: newOptionPersona, source: 'new' }];
    if (personaLocation && personaLocation.source === 'inline') {
      inlinePersonas.push(personaLocation);
    }

    const builtinPersonas = BuiltInPersonas.map((persona) => ({ persona, source: 'builtin' }));

    const versionPersonas = versionInfo?.personas
      ? versionInfo.personas.map((persona) => ({ source: 'version', persona }))
      : [];

    setSelectedIndexToLocation(personaLocation, inlinePersonas, builtinPersonas, versionPersonas);
    setPersonaOptions({ inline: inlinePersonas, builtin: builtinPersonas, version: versionPersonas });
  }

  useEffect(() => {
    updatePersonaOptions(node.personaLocation);
  }, [versionInfo, node]);

  useEffect(() => {
    if (panelOpen && mode === 'select' && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [panelOpen, mode, selectedIndex]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closePanel(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [panelOpen, mode]);

  function createNewPersona(templatePersona) {
    const newPersona = {
      persona: JSON.parse(JSON.stringify(templatePersona)),
      source: 'version',
    };
    newPersona.persona.personaID = uuidv4();
    return newPersona;
  }

  function startEditPersona(personaCopy) {
    editingPersonaRef.current = personaCopy;
    setMode('editpersona');
    setPanelOpen(true);
  }

  const handleSelectionChanged = (option, index, category) => {
    if (option.source === 'new') {
      startEditPersona(createNewPersona(BuiltInPersonas[0]));
      return;
    }

    setSelectedIndex({ index, category });
    let newPersonaLocation = { source: option.source };
    if (option.source === 'builtin' || option.source === 'version') {
      newPersonaLocation.personaID = option.persona.personaID;
    } else if (option.source === 'inline') {
      newPersonaLocation = JSON.parse(JSON.stringify(option));
    }

    onChange?.(node, 'personaLocation', newPersonaLocation);
    closePanel(false);
  };

  const handleEditCurrentPersonaPressed = () => {
    if (selectedIndex.category === 'inline' && selectedIndex.index === 0) {
      return;
    }
    const currentPersona = personaOptions[selectedIndex.category][selectedIndex.index];
    if (currentPersona.source === 'builtin') {
      const newPersona = createNewPersona(currentPersona.persona);
      newPersona.source = 'inline';
      startEditPersona(newPersona);
    } else {
      startEditPersona(JSON.parse(JSON.stringify(currentPersona)));
    }
  };

  function setSelectedIndexToLocation(personaLocation, inline, builtin, version) {
    let personaLocationToUse = personaLocation;
    if (!personaLocationToUse) {
      const nodeMetadata = getMetadataForNodeType(node.nodeType);
      personaLocationToUse = {
        source: 'builtin',
        personaID: nodeMetadata.defaultPersona,
      };
      onChange?.(node, 'personaLocation', personaLocationToUse);
    }

    if (personaLocationToUse.source === 'inline') {
      const index = inline.findIndex((entry) => entry.persona.personaID === personaLocationToUse.persona?.personaID);
      setSelectedIndex({ index, category: 'inline' });
    } else if (personaLocationToUse.source === 'builtin') {
      const index = builtin.findIndex((entry) => entry.persona.personaID === personaLocationToUse.personaID);
      setSelectedIndex({ index, category: 'builtin' });
    } else if (personaLocationToUse.source === 'version') {
      const index = version.findIndex((entry) => entry.persona.personaID === personaLocationToUse.personaID);
      setSelectedIndex({ index, category: 'version' });
    } else {
      throw new Error('PersonaChooser: unknown source ' + personaLocationToUse.source);
    }
  }

  function savePersona() {
    const isNew = editingPersonaRef.current.source === 'new';
    if (isNew) {
      editingPersonaRef.current.source = 'version';
    }
    if (editingPersonaRef.current.source === 'version' || isNew) {
      onPersonaListChange?.(editingPersonaRef.current.persona, 'upsert', {});
      onChange?.(node, 'personaLocation', {
        source: 'version',
        personaID: editingPersonaRef.current.persona.personaID,
      });
    } else if (editingPersonaRef.current.source === 'inline') {
      onChange?.(node, 'personaLocation', editingPersonaRef.current);
    } else {
      throw new Error('PersonaChooser: savePersona unexpected source ' + editingPersonaRef.current.source);
    }

    onNodeStructureChange?.(node, 'visualUpdateNeeded', {});
    editingPersonaRef.current = null;
  }

  const closePanel = (shouldSave) => {
    if (mode === 'editpersona') {
      if (shouldSave) {
        savePersona();
      } else {
        editingPersonaRef.current = null;
      }
    }
    setMode('select');
    setPanelOpen(false);
  };

  const handlePersonaEditSave = () => {
    closePanel(true);
  };

  const handlePersonaEditCancel = () => {
    closePanel(false);
  };

  const handleTriggerSelectPanel = () => {
    setMode('select');
    setPanelOpen(true);
  };

  const handleAddPersona = () => {
    if (readOnly) {
      return;
    }
    startEditPersona(createNewPersona(BuiltInPersonas[0]));
  };

  if (!personaOptions || typeof selectedIndex.index === 'undefined') {
    return null;
  }

  const currentOption = personaOptions[selectedIndex.category][selectedIndex.index];

  return (
    <div className='flex w-full max-w-3xl items-center gap-2'>
      <button
        type='button'
        className={`${buttonStyles.subtle} flex-1 justify-between`}
        onClick={handleTriggerSelectPanel}
      >
        <div className='flex flex-1 items-center gap-3'>
          <PersonaCard persona={currentOption.persona} />
        </div>
        <ChevronDown className='h-4 w-4 opacity-70' />
      </button>

      <button
        type='button'
        onClick={handleAddPersona}
        disabled={readOnly}
        className={buttonStyles.subtle}
      >
        <Plus className='h-4 w-4' />
        New
      </button>

      <button
        type='button'
        onClick={handleEditCurrentPersonaPressed}
        disabled={readOnly}
        className={buttonStyles.subtle}
      >
        <Pencil className='h-4 w-4' />
        Edit
      </button>

      {panelOpen ? (
        <div
          className='fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 py-10'
          onClick={() => closePanel(false)}
        >
          <div
            className='relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='flex items-center justify-between border-b border-white/10 px-6 py-4 text-slate-100'>
              <div>
                <h3 className='text-lg font-semibold'>{mode === 'select' ? 'Choose a persona' : 'Edit persona'}</h3>
                <p className='text-sm text-slate-300'>Assign personas to tailor the node experience.</p>
              </div>
              <button type='button' onClick={() => closePanel(false)} className='rounded-full border border-white/20 p-2 transition hover:border-white/40'>
                <X className='h-4 w-4' />
              </button>
            </div>

            {mode === 'select' ? (
              <div className='max-h-[70vh] overflow-y-auto px-6 py-6 text-slate-100'>
                <div className='space-y-6'>
                  {['inline', 'builtin', 'version'].map((category) => (
                    <section key={category} className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <h4 className='text-sm font-semibold uppercase tracking-wide text-slate-300'>{areaTitles[category]}</h4>
                        <span className='text-xs text-slate-500'>
                          {personaOptions[category].length === 0 ? 'No personas available' : `${personaOptions[category].length} option${personaOptions[category].length === 1 ? '' : 's'}`}
                        </span>
                      </div>
                      <div className='space-y-2'>
                        {personaOptions[category].map((option, index) => {
                          const isSelected = selectedIndex.index === index && selectedIndex.category === category;
                          return (
                            <button
                              key={option.persona.personaID || `${category}-${index}`}
                              type='button'
                              className={`w-full rounded-2xl border p-2 text-left transition ${isSelected ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'}`}
                              onClick={() => handleSelectionChanged(option, index, category)}
                              disabled={readOnly && option.source !== 'builtin'}
                              ref={isSelected ? selectedRef : null}
                            >
                              <PersonaCard persona={option.persona} />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : null}

            {mode === 'editpersona' ? (
              <div className='max-h-[80vh] overflow-y-auto px-6 py-6 text-slate-100'>
                <InlinePersonaEditor
                  theme={theme}
                  persona={editingPersonaRef.current.persona}
                  onChange={(rootObject, path, value) => {
                    setNestedObjectProperty(editingPersonaRef.current.persona, path, value);
                  }}
                  onCancel={handlePersonaEditCancel}
                  onSave={handlePersonaEditSave}
                  readOnly={readOnly}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
