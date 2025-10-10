'use client';

import React, { useState, useEffect } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { defaultAppTheme } from '@src/common/theme';
import VersionEditor from '@src/client/components/versioneditor/versioneditor';
import ChatBot from '@src/client/components/chatbot';
import { stateManager } from '@src/client/statemanager';
import { EditorPreferencesCheck } from '@src/client/components/editorpreferencescheck';
import { useAtom } from 'jotai';
import { vhState, collapsiblePanelSettingsState } from '@src/client/states';

function StatusCallout({ title, description }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-white/10 px-6 py-6 text-center text-slate-100 shadow-[0_45px_120px_-60px_rgba(56,189,248,0.6)] backdrop-blur">
        <p className="text-lg font-semibold uppercase tracking-[0.25em]">{title}</p>
        {description ? <p className="mt-3 text-sm text-slate-300">{description}</p> : null}
      </div>
    </div>
  );
}

export default function Home() {
  const { loading, game, versionList, version, setAccountPreference, editMode } = React.useContext(stateManager);
  const [themeToUse, setThemeToUse] = useState(defaultAppTheme);
  const [, setVh] = useAtom(vhState);
  const [collapsiblePanelSettings, setCollapsiblePanelSettings] = useAtom(collapsiblePanelSettingsState);
  const [playViewOpen, setPlayViewOpen] = useState(() => {
    const persisted = collapsiblePanelSettings?.editGameVersions;
    if (Array.isArray(persisted)) {
      return Boolean(persisted[1]);
    }
    if (persisted && typeof persisted === 'object' && 'playOpen' in persisted) {
      return Boolean(persisted.playOpen);
    }
    return false;
  });

  useEffect(() => {
    const persisted = collapsiblePanelSettings?.editGameVersions;
    let desired;
    if (Array.isArray(persisted)) {
      desired = Boolean(persisted[1]);
    } else if (persisted && typeof persisted === 'object' && 'playOpen' in persisted) {
      desired = Boolean(persisted.playOpen);
    }
    if (typeof desired === 'boolean' && desired !== playViewOpen) {
      setPlayViewOpen(desired);
    }
  }, [collapsiblePanelSettings]);

  useEffect(() => {
    const updateViewportHeight = () => setVh(window.innerHeight);
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, [setVh]);

  useEffect(() => {
    if (!loading && !editMode) {
      setAccountPreference('editMode', true);
    }
  }, [loading, editMode, setAccountPreference]);

  useEffect(() => {
    const newThemeToUse = game && game.theme ? game.theme : defaultAppTheme;
    setThemeToUse(newThemeToUse);
  }, [game]);

  const handleTogglePlayView = () => {
    const next = !playViewOpen;
    setPlayViewOpen(next);
    setCollapsiblePanelSettings({
      ...collapsiblePanelSettings,
      editGameVersions: {
        ...(collapsiblePanelSettings?.editGameVersions &&
        !Array.isArray(collapsiblePanelSettings.editGameVersions)
          ? collapsiblePanelSettings.editGameVersions
          : {}),
        playOpen: next,
      },
    });
  };

  const renderEditorPanel = () => {
    if (loading) {
      return <StatusCallout title="Loading game versions..." />;
    }
    if (!versionList) {
      return <StatusCallout title='Select "Add Version" from the dropdown above' />;
    }
    return <VersionEditor />;
  };

  const renderPlayPanel = () => {
    if (loading || !game || !version) {
      return <StatusCallout title="No version selected yet" />;
    }
    return (
      <div className="flex h-full w-full flex-col">
        <ChatBot url={game?.url} title={game?.title} theme={themeToUse} key={game?.url} />
      </div>
    );
  };

  const immersiveBackground =
    themeToUse?.colors?.titleBackgroundColor || themeToUse?.palette?.background?.immersive;

  return (
    <RequireAuthentication>
      <div
        className="relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100"
        style={immersiveBackground ? { backgroundColor: immersiveBackground } : undefined}
      >
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-6 z-30 flex -translate-x-1/2 items-center">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1.5 text-[11px] uppercase tracking-[0.35em] shadow-[0_25px_70px_-45px_rgba(56,189,248,0.65)] backdrop-blur">
              <span className="text-slate-400">Views</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold shadow transition ${
                  playViewOpen ? 'bg-white/10 text-slate-200' : 'bg-sky-500/80 text-white'
                }`}
              >
                Edit
              </span>
              <button
                type="button"
                onClick={handleTogglePlayView}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  playViewOpen
                    ? 'bg-emerald-500/80 text-white shadow hover:bg-emerald-400'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {playViewOpen ? 'Hide Play' : 'Show Play'}
              </button>
            </div>
          </div>

          <div className={`flex flex-1 min-h-0 flex-col overflow-hidden ${playViewOpen ? 'lg:flex-row' : ''}`}>
            <div className={`${playViewOpen ? 'lg:w-1/2' : 'w-full'} flex flex-1 min-h-0 flex-col overflow-hidden`}>
              <div className="m-2 flex flex-1 min-h-0 overflow-hidden">
                {renderEditorPanel()}
              </div>
            </div>
            {playViewOpen ? (
              <div className="flex flex-1 min-h-0 flex-col overflow-hidden lg:w-1/2">
                <div className="m-2 flex flex-1 min-h-0 overflow-hidden">
                  <div className="flex flex-1 min-h-0 flex-col overflow-y-auto">
                    {renderPlayPanel()}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

      </div>
      <EditorPreferencesCheck />
    </RequireAuthentication>
  );
}
