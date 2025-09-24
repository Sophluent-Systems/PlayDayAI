'use client';

import React, { memo, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { useAtom } from 'jotai';
import {
  ChevronDown,
  Layers,
  Sparkles,
  Clock,
  ListFilter,
  Users,
  Pencil,
  Trash2,
  Plus,
  RefreshCcw,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ChatBot from '@src/client/components/chatbot';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { stateManager } from '@src/client/statemanager';
import { vhState } from '@src/client/states';
import { defaultAppTheme } from '@src/common/theme';
import { callGetAllSessionsForGame, callAddGameVersion } from '@src/client/editor';
import { callDeleteGameSession, callRenameSession } from '@src/client/gameplay';
import { PrettyDate } from '@src/common/date';
import { analyticsReportEvent } from '@src/client/analytics';

function overlayPortal(content) {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(content, document.body);
}

function SelectionSheet({ open, title, description, onClose, children, footer }) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  return overlayPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur"
      onPointerDown={handleBackdropClick}
    >
      <div className="w-full max-w-3xl rounded-3xl border border-border/70 bg-surface p-6 shadow-[0_32px_80px_-32px_rgba(15,23,42,0.6)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-emphasis">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/70 p-2 text-muted transition-colors hover:border-primary/50 hover:text-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6 max-h-[60vh] overflow-y-auto pr-1">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

function RenameDialog({ open, initialValue, onSubmit, onCancel }) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (open) {
      setValue(initialValue || '');
    }
  }, [open, initialValue]);

  return (
    <SelectionSheet
      open={open}
      title="Rename session"
      description="Give your session a friendly name so teammates can find it quickly."
      onClose={onCancel}
      footer={[
        <button
          key="cancel"
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-emphasis"
        >
          Cancel
        </button>,
        <button
          key="save"
          type="button"
          onClick={() => onSubmit(value.trim())}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-18px_rgba(99,102,241,0.6)]"
          disabled={!value.trim()}
        >
          Save name
        </button>,
      ]}
    >
      <label className="block text-sm font-medium text-emphasis">
        Session title
        <input
          className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis focus:border-primary focus:outline-none"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="e.g. Playtest with Sam"
        />
      </label>
    </SelectionSheet>
  );
}

function VersionList({
  versions,
  activeVersionName,
  onSelect,
  allowAdd,
  onCreate,
  creating,
}) {
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {versions.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border/70 bg-surface/80 px-4 py-6 text-center text-sm text-muted">
            No versions yet. Create one to start playtesting.
          </li>
        ) : (
          versions.map((version) => {
            const isActive = version.versionName === activeVersionName;
            return (
              <li key={version.versionID}>
                <button
                  type="button"
                  onClick={() => onSelect(version.versionName)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200',
                    isActive
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10'
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold">{version.versionName}</p>
                    <p className="mt-1 text-xs text-muted">Updated {PrettyDate(version.lastUpdatedDate)}</p>
                  </div>
                  {version.published ? (
                    <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                      Live
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
      {allowAdd ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/60 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          disabled={creating}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New version
        </button>
      ) : null}
    </div>
  );
}

function SessionList({
  sessions,
  activeSessionID,
  onSelect,
  onRename,
  onDelete,
}) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-surface/80 px-6 py-8 text-center text-sm text-muted">
        No saved sessions yet. Launch the experience to create one.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sessions.map((item) => {
        const assignedName = item.assignedName || 'Untitled session';
        const accountName = item?.account?.email || item.accountID;
        const isActive = item.sessionID === activeSessionID;
        return (
          <li key={item.sessionID}>
            <div
              className={clsx(
                'flex flex-col gap-3 rounded-2xl border px-4 py-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between',
                isActive
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10'
              )}
            >
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onSelect(item.sessionID)}
                  className="text-left"
                >
                  <p className="text-sm font-semibold">{assignedName}</p>
                  <p className="text-xs text-muted">
                    Player: {accountName} - Last played {PrettyDate(item.latestUpdate)} - Version {item.versionInfo.versionName}
                  </p>
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <button
                  type="button"
                  onClick={() => onRename(item)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.sessionID)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 transition-colors hover:border-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const defaultThemeCard = {
  gradient: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(56,189,248,0.12) 100%)',
};

function buildThemeCard(theme) {
  if (!theme) {
    return defaultThemeCard;
  }
  const colors = theme.colors || {};
  const primary = colors.buttonColor || colors.messageBackgroundColor || '#6366f1';
  const secondary = colors.messageTextColor || '#14b8a6';
  return {
    gradient: `linear-gradient(135deg, ${primary}26 0%, ${secondary}1f 100%)`,
  };
}

function Home() {
  const router = useRouter();
  const {
    account,
    loading,
    game,
    versionList,
    version,
    session,
    switchVersionByName,
    gamePermissions,
    editMode,
    switchSessionID,
  } = useContext(stateManager);

  const [sessions, setSessions] = useState([]);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [renameSession, setRenameSession] = useState(null);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const chatPanelRef = useRef(null);
  const chatBotViewportRef = useRef(null);
  const [chatPanelHeight, setChatPanelHeight] = useState(null);
  const [viewportHeight, setViewportHeight] = useAtom(vhState);
  const lastMeasuredViewportHeight = useRef(null);

  const themeToUse = game?.theme || defaultAppTheme;
  const themeCard = useMemo(() => buildThemeCard(themeToUse), [themeToUse]);
  const activeVersionName = version?.versionName;
  const activeSessionID = session?.sessionID;

  useEffect(() => {
    if (game && account && versionList && versionList.length > 0 && !version) {
      if (game.primaryVersion && versionList.find((item) => item.versionName === game.primaryVersion)) {
        switchVersionByName(game.primaryVersion);
        return;
      }
      const sorted = [...versionList].sort(
        (a, b) => new Date(b.lastUpdatedDate).getTime() - new Date(a.lastUpdatedDate).getTime()
      );
      switchVersionByName(sorted[0].versionName);
    }
  }, [account, versionList, game, version, switchVersionByName]);

  const refreshGameSessions = useCallback(async () => {
    if (!game?.gameID || !version?.versionID || !account?.accountID) {
      return;
    }
    try {
      setLoadingSessions(true);
      const sessionList = await callGetAllSessionsForGame(game.gameID, version.versionID, account.accountID);
      setSessions(sessionList || []);
    } catch (error) {
      console.error('Error fetching game sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [game?.gameID, version?.versionID, account?.accountID]);

  useEffect(() => {
    if (version && account) {
      refreshGameSessions();
    }
  }, [version, account, refreshGameSessions]);

  const headerSubtitle = useMemo(() => {
    if (!game) {
      return '';
    }
    const totalSessions = sessions?.length || 0;
    return `${totalSessions} saved ${totalSessions === 1 ? 'session' : 'sessions'} - ${versionList?.length || 0} versions`;
  }, [game, sessions?.length, versionList?.length]);
  
  useEffect(() => {
    if (!editMode) {
      setChatPanelHeight(null);
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateHeight = () => {
      if (!chatPanelRef.current) {
        return;
      }
      const { top } = chatPanelRef.current.getBoundingClientRect();
      const SAFE_MARGIN = 100;
      const available = window.innerHeight - top - SAFE_MARGIN;
      setChatPanelHeight(available > 0 ? available : null);
    };

    const handleResize = () => {
      updateHeight();
    };

    updateHeight();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [editMode, headerSubtitle, activeVersionName, sessions?.length, version?.lastUpdatedDate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    lastMeasuredViewportHeight.current =
      typeof viewportHeight === 'number' ? Math.floor(viewportHeight) : null;

    let frame = null;

    const measureViewport = () => {
      if (!chatBotViewportRef.current) {
        return;
      }
      const rect = chatBotViewportRef.current.getBoundingClientRect();
      const measuredHeight = Math.floor(rect.height);
      if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) {
        return;
      }
      if (lastMeasuredViewportHeight.current === measuredHeight) {
        return;
      }
      lastMeasuredViewportHeight.current = measuredHeight;
      setViewportHeight(measuredHeight);
    };

    const scheduleMeasure = () => {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measureViewport();
      });
    };

    measureViewport();
    window.addEventListener('resize', scheduleMeasure);

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && chatBotViewportRef.current) {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      resizeObserver.observe(chatBotViewportRef.current);
    }

    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [chatBotViewportRef, lastMeasuredViewportHeight, setViewportHeight, viewportHeight, editMode]);

  const chatBotViewportStyle = useMemo(() => {
    if (typeof viewportHeight === 'number' && viewportHeight > 0) {
      return {
        height: `${viewportHeight}px`,
        width: '100%',
      };
    }
    return {
      height: '100%',
      width: '100%',
    };
  }, [viewportHeight]);

  const canPlay = useMemo(() => gamePermissions?.includes('game_play'), [gamePermissions]);
  const canCreateVersion = useMemo(
    () => editMode && gamePermissions?.includes('game_edit'),
    [editMode, gamePermissions]
  );

  const handleSelectSession = useCallback(
    (sessionID) => {
      if (!sessionID || sessionID === session?.sessionID) {
        return;
      }
      switchSessionID(sessionID);
      setSessionsOpen(false);
    },
    [session?.sessionID, switchSessionID]
  );

  const handleDeleteSession = useCallback(
    async (sessionID) => {
      try {
        await callDeleteGameSession(sessionID);
        await refreshGameSessions();
      } catch (error) {
        console.error('Failed to delete session', error);
      }
    },
    [refreshGameSessions]
  );

  const handleRenameSession = useCallback(
    async (newName) => {
      if (!renameSession || !newName) {
        setRenameSession(null);
        return;
      }
      if (newName !== renameSession.assignedName) {
        try {
          await callRenameSession(game.gameID, renameSession.sessionID, newName);
          await refreshGameSessions();
        } catch (error) {
          console.error('Failed to rename session', error);
        }
      }
      setRenameSession(null);
    },
    [renameSession, game?.gameID, refreshGameSessions]
  );

  const handleCreateVersion = useCallback(async () => {
    const baseName = `v${(versionList?.length || 0) + 1}`;
    let proposed = baseName;
    let suffix = 1;
    while (versionList?.some((item) => item.versionName === proposed)) {
      suffix += 1;
      proposed = `${baseName}-${suffix}`;
    }
    try {
      setCreatingVersion(true);
      const prototype = version?.versionName;
      await callAddGameVersion(game.gameID, proposed, prototype);
      analyticsReportEvent('create_version', {
        event_category: 'Editor',
        event_label: 'Create version',
        gameID: game.gameID,
        versionName: proposed,
      });
      await refreshGameSessions();
      switchVersionByName(proposed);
    } catch (error) {
      console.error('Failed to create version', error);
    } finally {
      setCreatingVersion(false);
    }
  }, [game?.gameID, versionList, version?.versionName, refreshGameSessions, switchVersionByName]);

  const renderContent = () => {
    if (loading || !account || !gamePermissions) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-muted">Loading workspace...</div>
        </div>
      );
    }

    if (!canPlay) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center text-muted">You are not authorised to play this game.</div>
        </div>
      );
    }

    const headerPrimary = (
      <div className="space-y-1">
        <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Play Day - Live preview
        </p>
        <h1 className="text-3xl font-semibold text-emphasis sm:text-4xl">{game?.title}</h1>
        <p className="text-sm text-muted">{headerSubtitle}</p>
      </div>
    );

    const headerActions = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 sm:pr-2">
          <button
            type="button"
            onClick={() => setVersionsOpen(true)}
            className="inline-flex w-full items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-4 py-2 text-sm font-semibold text-emphasis transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary sm:w-auto"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            {activeVersionName || 'Select version'}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSessionsOpen(true)}
            className="inline-flex w-full items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-4 py-2 text-sm font-semibold text-emphasis transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary sm:w-auto"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {activeSessionID ? 'Switch session' : 'Choose session'}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={refreshGameSessions}
            className="inline-flex w-full items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-primary/50 hover:text-primary sm:w-auto"
          >
            <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>
    );

    const headerSection = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {headerPrimary}
        {headerActions}
      </div>
    );

    const renderInfoBadges = () => (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {game?.url ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface/70 px-3 py-1 font-medium text-emphasis">
            <ListFilter className="h-3 w-3" aria-hidden="true" />
            {game.url}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-surface/70 px-3 py-1 font-medium text-emphasis">
          <Layers className="h-3 w-3" aria-hidden="true" />
          {activeVersionName || 'Version TBD'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface/70 px-3 py-1 font-medium text-emphasis">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Updated {version ? PrettyDate(version.lastUpdatedDate) : '--'}
        </span>
      </div>
    );

    if (!editMode) {
      return (
        <div className="relative flex min-h-0 flex-1 flex-col bg-background">
          <div className="flex flex-none flex-col gap-4 border-b border-border/60 bg-background/90 px-6 py-6 text-emphasis shadow-[0_18px_40px_-32px_rgba(15,23,42,0.55)] backdrop-blur-sm sm:px-8 lg:px-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {headerPrimary}
              {headerActions}
            </div>
            {renderInfoBadges()}
          </div>
          <div className="flex min-h-0 flex-1">
            <div
              ref={chatBotViewportRef}
              className="flex min-h-0 w-full flex-1 flex-col"
              style={chatBotViewportStyle}
            >
              <ChatBot
                url={game?.url}
                title={game?.title}
                theme={themeToUse}
                session={session}
                version={version}
                versionList={versionList}
              />
            </div>
          </div>
        </div>
      );
    }

    const editPanel = (
      <div
        ref={chatPanelRef}
        className="mx-auto w-full max-w-6xl flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/60 bg-surface/95 shadow-[0_40px_120px_-45px_rgba(15,23,42,0.5)]"
        style={{
          backgroundImage: themeCard.gradient,
          height: chatPanelHeight ? `${chatPanelHeight}px` : undefined,
        }}
      >
        <div className="px-6 py-4 space-y-4">
          {headerSection}
          {renderInfoBadges()}
        </div>
        <div className="flex flex-1 min-h-0 flex-col px-6 pb-6">
          <div
            ref={chatBotViewportRef}
            className="flex flex-1 min-h-0 w-full overflow-hidden rounded-2xl border border-border/60 bg-background/95"
            style={chatBotViewportStyle}
          >
            <ChatBot
              url={game?.url}
              title={game?.title}
              theme={themeToUse}
              session={session}
              version={version}
              versionList={versionList}
            />
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {editPanel}
      </div>
    );
  };


  return (
    <RequireAuthentication>
      <div
        className={clsx(
          'relative flex h-screen flex-col overflow-hidden bg-background'
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[320px] bg-gradient-to-b from-primary/15 via-background to-transparent"
          aria-hidden="true"
        />
        <div
          className={clsx(
            'relative z-10 flex w-full flex-1 flex-col min-h-0',
            editMode ? 'mx-auto max-w-7xl px-4 pt-8 sm:px-8 lg:px-12' : ''
          )}
        >
          {renderContent()}
        </div>
        <SelectionSheet
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          title="Switch version"
          description="Pick which build of this experience you want to launch."
        >
          <VersionList
            versions={versionList || []}
            activeVersionName={activeVersionName}
            onSelect={(name) => {
              switchVersionByName(name);
              setVersionsOpen(false);
            }}
            allowAdd={canCreateVersion}
            onCreate={handleCreateVersion}
            creating={creatingVersion}
          />
        </SelectionSheet>
        <SelectionSheet
          open={sessionsOpen}
          onClose={() => setSessionsOpen(false)}
          title="Play sessions"
          description={loadingSessions ? 'Syncing latest sessions...' : 'Select a session to resume or manage saves.'}
        >
          <SessionList
            sessions={sessions}
            activeSessionID={activeSessionID}
            onSelect={handleSelectSession}
            onRename={(item) => setRenameSession(item)}
            onDelete={handleDeleteSession}
          />
        </SelectionSheet>
        <RenameDialog
          open={!!renameSession}
          initialValue={renameSession?.assignedName || ''}
          onSubmit={handleRenameSession}
          onCancel={() => setRenameSession(null)}
        />
      </div>
    </RequireAuthentication>
  );
}

export default memo(Home);
