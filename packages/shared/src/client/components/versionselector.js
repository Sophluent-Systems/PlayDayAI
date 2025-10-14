import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Plus, ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import { stateManager } from '@src/client/statemanager';
import { PrettyDate } from '@src/common/date';
import { callAddGameVersion } from '@src/client/editor';
import { useRouter } from 'next/router';
import { analyticsReportEvent } from '@src/client/analytics';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const dropdownButtonClass =
  'flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/15';

const menuContainerClass =
  'rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95';

const inlineListContainerClass =
  'flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900/60';

const versionRowClass =
  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-white/10';

const modalBackdropClass = 'fixed inset-0 z-[19000] flex items-center justify-center bg-slate-950/50 backdrop-blur';
const modalCardClass =
  'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900';

// Helper function to extract date value from MongoDB date objects or strings
function getDateValue(dateField) {
  if (!dateField) return null;
  // Handle MongoDB $date format: { $date: "2024-08-01T19:01:21.893Z" }
  if (dateField.$date) return dateField.$date;
  // Handle regular date object or string
  return dateField;
}

function useOutsideClick(refs, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const listener = (event) => {
      for (const ref of refs) {
        if (ref?.current && ref.current.contains(event.target)) {
          return;
        }
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, handler, enabled]);
}

function VersionListOption({ version, onSelect, isSelected }) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className={clsx(
        versionRowClass,
        isSelected && 'border border-slate-300 bg-slate-100 shadow-sm dark:border-white/20 dark:bg-white/10'
      )}
    >
      <div className='flex flex-col gap-1 text-left'>
        <span className='text-sm font-semibold text-slate-800 dark:text-slate-100'>{version.versionName}</span>
        <span className='text-xs text-slate-500 dark:text-slate-400'>
          Last updated {PrettyDate(version.lastUpdatedDate)}
        </span>
      </div>
      {version.published ? <Globe className='h-4 w-4 text-emerald-500' /> : null}
    </button>
  );
}

export function VersionSelector(props) {
  const {
    allowNewGameOption,
    firstOptionUnselectable,
    dropdown,
    chooseMostRecent,
    sx,
    showCreateButton,
  } = props;
  const router = useRouter();
  const { versionName } = router.query;
  const { game, versionList = [], version, switchVersionByName } = React.useContext(stateManager);

  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [selectedPrototypeIndex, setSelectedPrototypeIndex] = useState(0);
  const [validationMessage, setValidationMessage] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);

  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const hasInitializedVersion = useRef(false);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const clickRefs = useMemo(() => [dropdownRef, menuRef], []);
  useOutsideClick(clickRefs, closeMenu, isMenuOpen);

  const updateMenuPosition = useCallback(() => {
    if (!dropdownRef.current) {
      return;
    }
    const rect = dropdownRef.current.getBoundingClientRect();
    const offset = 8; // Tailwind mt-2
    setMenuPosition({
      left: rect.left,
      top: rect.bottom + offset,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isMenuOpen) {
      setMenuPosition(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isMenuOpen, updateMenuPosition]);

  const versionOptions = useMemo(() => {
    const options = [];
    if (allowNewGameOption) {
      options.push({ isNewOption: true });
    }
    if (firstOptionUnselectable) {
      options.push({ isPlaceholder: true, label: 'Select a version' });
    }
    const versions = versionList.map((item, index) => ({
      ...item,
      index,
    }));
    return [...options, ...versions];
  }, [versionList, allowNewGameOption, firstOptionUnselectable]);

  const selectedOption =
    currentIndex >= 0 && currentIndex < versionOptions.length ? versionOptions[currentIndex] : null;
  const selectedLabel = selectedOption
    ? selectedOption.isPlaceholder
      ? 'Select a version'
      : selectedOption.isNewOption
        ? 'Create a version'
        : selectedOption.versionName
    : 'Select a version';

  const setIndexForVersionName = useCallback((targetVersionName) => {
    if (!versionOptions.length) {
      setCurrentIndex(-1);
      return;
    }
    const offset = (allowNewGameOption ? 1 : 0) + (firstOptionUnselectable ? 1 : 0);
    const foundIndex = versionList.findIndex((item) => item.versionName === targetVersionName);
    if (foundIndex >= 0) {
      setCurrentIndex(foundIndex + offset);
    } else {
      setCurrentIndex(offset > 0 ? offset : 0);
    }
  }, [versionList, versionOptions.length, allowNewGameOption, firstOptionUnselectable]);

  useEffect(() => {
    if (version) {
      setIndexForVersionName(version.versionName);
    }
  }, [version, versionOptions.length, setIndexForVersionName]);

  // Reset initialization flag when game changes
  useEffect(() => {
    hasInitializedVersion.current = false;
  }, [game?.gameID]);

  useEffect(() => {
    if (!versionList.length) {
      return;
    }

    // On initial load with chooseMostRecent, always select the most recently edited version
    if (chooseMostRecent && !hasInitializedVersion.current) {
      hasInitializedVersion.current = true;
      const newest = [...versionList]
        .filter(Boolean)
        .sort((a, b) => {
          // Sort by lastUpdatedDate if available, otherwise by creationDate, otherwise use position in list
          const dateA = getDateValue(a.lastUpdatedDate) || getDateValue(a.creationDate) || new Date(0);
          const dateB = getDateValue(b.lastUpdatedDate) || getDateValue(b.creationDate) || new Date(0);
          return new Date(dateB) - new Date(dateA);
        })[0];
      if (newest) {
        switchVersionByName(newest.versionName);
      }
      return;
    }

    // After initialization, only switch if current version is not in list
    const currentVersionNameIsInList = !nullUndefinedOrEmpty(versionName)
      ? versionList.some((item) => item.versionName === versionName)
      : false;

    if (!currentVersionNameIsInList) {
      if (chooseMostRecent) {
        const newest = [...versionList]
          .filter(Boolean)
          .sort((a, b) => {
            const dateA = getDateValue(a.lastUpdatedDate) || getDateValue(a.creationDate) || new Date(0);
            const dateB = getDateValue(b.lastUpdatedDate) || getDateValue(b.creationDate) || new Date(0);
            return new Date(dateB) - new Date(dateA);
          })[0];
        if (newest) {
          switchVersionByName(newest.versionName);
        }
      } else if (versionList[0]) {
        switchVersionByName(versionList[0].versionName);
      }
    }
  }, [versionList, versionName, chooseMostRecent, switchVersionByName]);

  useEffect(() => {
    setSelectedPrototypeIndex((prev) => {
      const maxIndex = versionList.length;
      return prev > maxIndex ? 0 : prev;
    });
  }, [versionList.length]);

  const handleSelectByIndex = (index) => {
    if (index < 0 || index >= versionOptions.length) {
      return;
    }

    const option = versionOptions[index];
    if (option.isNewOption) {
      setAddDialogOpen(true);
      setIsMenuOpen(false);
      return;
    }

    if (option.isPlaceholder) {
      return;
    }

    setCurrentIndex(index);
    switchVersionByName(option.versionName);
    setIsMenuOpen(false);
  };

  const handleSelectByName = async (name) => {
    if (!name) {
      return;
    }
    await switchVersionByName(name);
    setIndexForVersionName(name);
    setIsMenuOpen(false);
  };

  const getValidationError = (value) => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return 'Version name is required';
    }
    if (!/^(?!.*\/\/)[a-zA-Z0-9-_]+$/.test(trimmed)) {
      return 'Only letters, numbers, dashes, and underscores are allowed';
    }
    if (versionList.some((item) => item.versionName === trimmed)) {
      return 'A version with this name already exists';
    }
    return null;
  };

  const handleAddVersion = async () => {
    const trimmedName = newVersionName.trim();
    const error = getValidationError(trimmedName);
    setValidationMessage(error);
    if (error) {
      return;
    }

    const prototype =
      selectedPrototypeIndex >= 0 && selectedPrototypeIndex < versionList.length
        ? versionList[selectedPrototypeIndex].versionName
        : null;

    await callAddGameVersion(game.gameID, trimmedName, prototype);

    analyticsReportEvent('create_version', {
      event_category: 'Editor',
      event_label: 'Create version',
      gameID: game.gameID,
      versionName: trimmedName,
    });

    setAddDialogOpen(false);
    setNewVersionName('');
    setValidationMessage(null);
    setSelectedPrototypeIndex(0);
    handleSelectByName(trimmedName);
  };

  const renderVersionOption = (option, index) => {
    if (option.isNewOption) {
      const isSelected = index === currentIndex;
      return (
        <button
          key='add-version'
          type='button'
          onClick={() => handleSelectByIndex(index)}
          className={clsx(
            'flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-left text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/20 dark:text-slate-100 dark:hover:border-white/30 dark:hover:bg-white/10',
            isSelected && 'border-slate-400 bg-slate-100 dark:border-white/40 dark:bg-white/10'
          )}
        >
          <span className='inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900'>
            <Plus className='h-4 w-4' />
          </span>
          <div className='flex flex-col text-left'>
            <span>Create version</span>
            <span className='text-xs font-normal text-slate-500 dark:text-slate-400'>
              Start from an existing version or a blank template
            </span>
          </div>
        </button>
      );
    }

    if (option.isPlaceholder) {
      return (
        <div
          key={`placeholder-${index}`}
          className='px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400'
        >
          Available versions
        </div>
      );
    }

    const isSelected = index === currentIndex;
    return (
      <VersionListOption
        key={option.versionName}
        version={option}
        onSelect={() => handleSelectByIndex(index)}
        isSelected={isSelected}
      />
    );
  };

  const handleOpenCreateDialog = () => {
    if (!allowNewGameOption) {
      return;
    }
    setIsMenuOpen(false);
    setAddDialogOpen(true);
  };

  const renderDropdown = () => (
    <>
      <div className='relative w-full' ref={dropdownRef}>
        <div className='flex w-full items-center gap-2'>
          <button type='button' className={dropdownButtonClass} onClick={() => setIsMenuOpen((prev) => !prev)}>
            <span className='flex flex-col text-left'>
              <span className='text-xs font-semibold uppercase tracking-[0.35em] text-slate-500 dark:text-slate-300'>
                Version
              </span>
              <span className='text-sm font-semibold'>{selectedLabel}</span>
            </span>
            <ChevronDown className='h-4 w-4' />
          </button>
          {showCreateButton && allowNewGameOption ? (
            <button
              type='button'
              onClick={handleOpenCreateDialog}
              className='inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:text-slate-100 dark:hover:border-white/20 dark:hover:bg-white/10'
            >
              <Plus className='h-5 w-5' />
              <span className='sr-only'>Create version</span>
            </button>
          ) : null}
        </div>
      </div>
      {isMenuOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className={menuContainerClass}
              style={{
                position: 'fixed',
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width,
                zIndex: 20000,
              }}
            >
              <div className='max-h-72 overflow-y-auto'>
                <div className='space-y-2'>
                  {versionOptions.map((option, index) => renderVersionOption(option, index))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );

  const renderInlineList = () => (
    <div className={inlineListContainerClass}>
      <div className='flex items-center justify-between gap-2 px-1'>
        <p className='text-xs font-semibold uppercase tracking-[0.25em] text-slate-400'>Versions</p>
        {showCreateButton && allowNewGameOption ? (
          <button
            type='button'
            onClick={handleOpenCreateDialog}
            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10'
          >
            <Plus className='h-4 w-4' />
            <span className='sr-only'>Create version</span>
          </button>
        ) : null}
      </div>
      <div className='space-y-2'>
        {versionOptions.map((option, index) => renderVersionOption(option, index))}
      </div>
    </div>
  );

  const renderAddVersionDialog = () => {
    if (!addDialogOpen) {
      return null;
    }

    const prototypeOptions = versionList.map((item, index) => (
      <option key={item.versionName} value={index}>
        {item.versionName}
      </option>
    ));
    prototypeOptions.push(
      <option key='blank' value={versionList.length}>
        Blank
      </option>
    );

    return (
      <div className={modalBackdropClass}>
        <div className={modalCardClass}>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-semibold text-slate-900 dark:text-slate-100'>Create new version</h2>
            <button
              type='button'
              className='rounded-full border border-slate-200 p-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white'
              onClick={() => setAddDialogOpen(false)}
            >
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <label htmlFor='versionName' className='text-sm font-medium text-slate-700 dark:text-slate-200'>
                Version name
              </label>
              <input
                id='versionName'
                className='w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:focus:border-white/30 dark:focus:ring-white/20'
                value={newVersionName}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewVersionName(value);
                  setValidationMessage(getValidationError(value));
                }}
              />
              {validationMessage ? (
                <p className='text-xs font-medium text-rose-500'>{validationMessage}</p>
              ) : (
                <p className='text-xs text-slate-400'>Use letters, numbers, dashes, or underscores.</p>
              )}
            </div>

            <div className='space-y-2'>
              <label htmlFor='prototypeVersion' className='text-sm font-medium text-slate-700 dark:text-slate-200'>
                Copy settings from
              </label>
              <select
                id='prototypeVersion'
                className='w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:focus:border-white/30 dark:focus:ring-white/20'
                value={selectedPrototypeIndex}
                onChange={(event) => setSelectedPrototypeIndex(Number(event.target.value))}
              >
                {prototypeOptions}
              </select>
            </div>
          </div>

          <div className='mt-6 flex justify-end gap-2'>
            <button
              type='button'
              onClick={() => setAddDialogOpen(false)}
              className='inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleAddVersion}
              disabled={Boolean(validationMessage) || !newVersionName.trim()}
              className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_-20px_rgba(56,189,248,0.65)] transition hover:from-sky-400 hover:to-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Create
            </button>
          </div>
        </div>
      </div>
    );
  };

  let additionalClassName;
  let inlineStyle;
  if (sx && typeof sx === 'object') {
    additionalClassName = sx.className;
    if ('style' in sx) {
      inlineStyle = sx.style;
    } else if (!('className' in sx)) {
      inlineStyle = sx;
    }
  }

  const containerClassName = clsx('relative w-full', additionalClassName);

  return (
    <div className={containerClassName} style={inlineStyle}>
      {dropdown ? renderDropdown() : renderInlineList()}
      {renderAddVersionDialog()}
    </div>
  );
}
