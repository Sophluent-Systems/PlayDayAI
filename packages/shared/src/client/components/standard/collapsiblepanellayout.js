
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAtom } from 'jotai';
import { vhState, collapsiblePanelSettingsState } from '@src/client/states';
import { nullUndefinedOrEmpty } from '@src/common/objects';

const drawerWidthCollapsed = 80;

const buttonStyles = {
  subtle:
    'inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:bg-white/70 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800/60',
  icon:
    'absolute z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus:ring-slate-600',
};

export function CollapsiblePanelLayout({ panels, persistKey }) {
  const [drawerOpen, setDrawerOpen] = useState(null);
  const containerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [vh] = useAtom(vhState);
  const [collapsiblePanelSettings, setCollapsiblePanelSettings] = useAtom(collapsiblePanelSettingsState);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (!panels) {
      return;
    }

    const applyPersistedState = (persisted) => {
      if (!nullUndefinedOrEmpty(persisted)) {
        setDrawerOpen(persisted);
      } else {
        const defaultState = panels.map((panel) => Boolean(panel.defaultOpen));
        setDrawerOpen(defaultState);
        if (persistKey) {
          setCollapsiblePanelSettings({
            ...collapsiblePanelSettings,
            [persistKey]: defaultState,
          });
        }
      }
    };

    if (persistKey) {
      applyPersistedState(collapsiblePanelSettings?.[persistKey]);
    } else if (!drawerOpen || panels.length !== drawerOpen.length) {
      applyPersistedState(null);
    }
  }, [panels, persistKey, collapsiblePanelSettings]);

  const calculateDrawerWidth = (panelIndex) => {
    if (!drawerOpen) {
      return drawerWidthCollapsed;
    }

    if (drawerOpen[panelIndex] && panels[panelIndex].width) {
      return panels[panelIndex].width;
    }

    if (!drawerOpen[panelIndex]) {
      return drawerWidthCollapsed;
    }

    let fixedWidth = 0;
    let flexiblePanels = 0;
    let closedWidth = 0;

    panels.forEach((panel, index) => {
      if (drawerOpen[index]) {
        if (panel.width) {
          fixedWidth += panel.width;
        } else {
          flexiblePanels += 1;
        }
      } else {
        closedWidth += drawerWidthCollapsed;
      }
    });

    const available = Math.max(viewportWidth - closedWidth - fixedWidth, 0);
    if (flexiblePanels === 0) {
      return drawerWidthCollapsed;
    }

    return Math.max(available / flexiblePanels, drawerWidthCollapsed);
  };

  const handleDrawerToggle = (index) => {
    if (panels[index].lockedOpen) {
      return;
    }

    const nextState = [...drawerOpen];
    nextState[index] = !nextState[index];

    if (index === panels.length - 1 && nextState.every((open, i) => i === index || !open)) {
      nextState[Math.max(0, index - 1)] = true;
    }

    if (index === 0 && nextState.every((open, i) => i === index || !open)) {
      nextState[Math.min(panels.length - 1, index + 1)] = true;
    }

    setDrawerOpen(nextState);

    if (persistKey) {
      setCollapsiblePanelSettings({
        ...collapsiblePanelSettings,
        [persistKey]: nextState,
      });
    }
  };

  const renderDrawer = (panelIndex) => {
    const isLastPanel = panelIndex === panels.length - 1;
    const drawerWidth = calculateDrawerWidth(panelIndex);
    const panel = panels[panelIndex];

    return (
      <div
        key={panelIndex}
        className={`relative flex h-full flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${
          isLastPanel ? 'border-r-0' : ''
        }`}
        style={{ width: drawerWidth, minWidth: drawerWidth }}
      >
        {drawerOpen?.[panelIndex] ? (
          panel.content
        ) : (
          <div className='flex h-full flex-col' style={{ height: `${vh}px` }} />
        )}

        {!drawerOpen?.[panelIndex] ? (
          <button
            type='button'
            onClick={() => handleDrawerToggle(panelIndex)}
            className='absolute inset-0 flex items-center justify-center bg-slate-900/60 text-xs font-semibold tracking-wide text-white'
          >
            <span
              className='inline-flex items-center justify-center'
              style={{ transform: `rotate(${isLastPanel ? 90 : 270}deg)` }}
            >
              {panel.label}
            </span>
          </button>
        ) : null}

        {!panel.lockedOpen ? (
          <button
            type='button'
            className={`${buttonStyles.icon} ${isLastPanel ? 'right-3' : 'left-3'} bottom-20`}
            onClick={() => handleDrawerToggle(panelIndex)}
          >
            {isLastPanel ? (
              drawerOpen?.[panelIndex] ? <ChevronRight className='h-4 w-4' /> : <ChevronLeft className='h-4 w-4' />
            ) : drawerOpen?.[panelIndex] ? (
              <ChevronLeft className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </button>
        ) : null}
      </div>
    );
  };

  const renderPanelButtons = () => (
    <div className='pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full border border-slate-200/70 bg-white/80 p-1 shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80'>
      <div className='pointer-events-auto flex items-center gap-2'>
        {panels.map((panel, index) => (
          <button
            type='button'
            key={index}
            className={`${buttonStyles.subtle} ${drawerOpen?.[index] ? 'border-transparent bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900' : ''}`}
            onClick={() => handleDrawerToggle(index)}
          >
            {panel.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className='relative flex w-full flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950'
      style={{ height: `${vh}px` }}
    >
      {drawerOpen && panels && panels.map((_, index) => renderDrawer(index))}
      {drawerOpen && panels && renderPanelButtons()}
    </div>
  );
}
