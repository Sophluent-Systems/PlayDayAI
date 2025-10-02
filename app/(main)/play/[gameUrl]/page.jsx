'use client';

import React, { memo, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import clsx from 'clsx';
import { ChevronDown, Layers, Plus, RefreshCcw, Users } from 'lucide-react';
import ChatBot from '@src/client/components/chatbot';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { stateManager } from '@src/client/statemanager';
import { useViewportDimensions } from '@src/client/hooks/useViewportDimensions';
import { defaultAppTheme } from '@src/common/theme';
import { callGetAllSessionsForGame, callAddGameVersion } from '@src/client/editor';
import { PrettyDate } from '@src/common/date';
import { analyticsReportEvent } from '@src/client/analytics';

const SESSION_NAME_FALLBACK = 'Untitled session';

function filterSessionsForAccount(list, accountID) {
  if (!Array.isArray(list) || !accountID) {
    return [];
  }
  return list.filter((item) => {
    const ownerID = item?.accountID ?? item?.account?.accountID;
    return ownerID === accountID;
  });
}

function formatSessionName(session) {
  return session?.assignedName?.trim() ? session.assignedName : SESSION_NAME_FALLBACK;
}

function formatSessionUpdatedLabel(session) {
  const timestamp = session?.latestUpdate || session?.lastUpdatedDate || session?.updatedAt;
  if (!timestamp) {
    return '--';
  }
  return PrettyDate(timestamp);
}

function Home() {
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
    startNewGameSession,
  } = useContext(stateManager);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [pendingVersionName, setPendingVersionName] = useState(null);

  const chatContainerRef = useRef(null);
  const menuContainerRef = useRef(null);
  const { width: viewportWidth, height: viewportHeight } = useViewportDimensions();

  const themeToUse = game?.theme || defaultAppTheme;
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

  const refreshGameSessions = useCallback(
    async (versionIDOverride) => {
      const effectiveVersionID = versionIDOverride ?? version?.versionID;
      if (!game?.gameID || !account?.accountID || !effectiveVersionID) {
        if (!versionIDOverride) {
          setSessions([]);
        }
        return;
      }
      try {
        setLoadingSessions(true);
        const sessionList = await callGetAllSessionsForGame(game.gameID, effectiveVersionID, account.accountID);
        setSessions(filterSessionsForAccount(sessionList, account.accountID));
      } catch (error) {
        console.error('Error fetching game sessions:', error);
      } finally {
        setLoadingSessions(false);
      }
    },
    [account?.accountID, game?.gameID, version?.versionID]
  );

  useEffect(() => {
    if (!account?.accountID || !version?.versionID) {
      setSessions([]);
      return;
    }
    refreshGameSessions();
  }, [account?.accountID, version?.versionID, refreshGameSessions]);

  useEffect(() => {
    if (!menuOpen || typeof document === 'undefined') {
      return undefined;
    }
    function handlePointerDown(event) {
      const container = menuContainerRef.current;
      if (container && container.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const chatBotDimensions = useMemo(() => {
    return {
      width: viewportWidth,
      height: viewportHeight,
    };
  }, [viewportWidth, viewportHeight]);

  const chatBotContainerStyle = useMemo(() => {
    return {
      width: `${chatBotDimensions.width}px`,
      height: `${chatBotDimensions.height}px`,
    };
  }, [chatBotDimensions]);

  const canPlay = useMemo(() => gamePermissions?.includes('game_play'), [gamePermissions]);
  const canCreateVersion = useMemo(
    () => editMode && gamePermissions?.includes('game_edit'),
    [editMode, gamePermissions]
  );

  const handleSelectSession = useCallback(
    (sessionID) => {
      if (!sessionID) {
        return;
      }
      if (sessionID !== session?.sessionID) {
        switchSessionID(sessionID);
      }
      setMenuOpen(false);
    },
    [session?.sessionID, switchSessionID]
  );

  const handleVersionSelect = useCallback(
    async (targetVersionName) => {
      if (!targetVersionName || !game?.url) {
        return;
      }
      setPendingVersionName(targetVersionName);
      try {
        await switchVersionByName(targetVersionName);
        const newSession = await startNewGameSession(game.url, targetVersionName);
        if (newSession?.versionID) {
          await refreshGameSessions(newSession.versionID);
        } else {
          const candidate = versionList?.find((item) => item.versionName === targetVersionName);
          if (candidate?.versionID) {
            await refreshGameSessions(candidate.versionID);
          } else {
            await refreshGameSessions();
          }
        }
        setMenuOpen(false);
      } catch (error) {
        console.error('Failed to start session for version', error);
      } finally {
        setPendingVersionName(null);
      }
    },
    [game?.url, refreshGameSessions, startNewGameSession, switchVersionByName, versionList]
  );

  const handleCreateVersion = useCallback(async () => {
    if (!game?.gameID) {
      return;
    }
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
      await handleVersionSelect(proposed);
    } catch (error) {
      console.error('Failed to create version', error);
    } finally {
      setCreatingVersion(false);
    }
  }, [game?.gameID, versionList, version?.versionName, handleVersionSelect]);

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

    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={chatContainerRef}
          style={chatBotContainerStyle}
          className="flex"
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
        {editMode ? (
          <div className="absolute top-20 left-4 z-40 sm:top-24 sm:left-8">
            <div ref={menuContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-4 py-2 text-sm font-semibold text-emphasis transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>{activeVersionName || 'Select version'}</span>
                <ChevronDown className={clsx('h-4 w-4 transition-transform', menuOpen ? 'rotate-180 text-primary' : 'text-muted')} aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-2.5rem)] sm:w-80 sm:max-w-none rounded-2xl border border-border/70 bg-surface/95 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
                  <div className="border-b border-border/60 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Versions</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto px-2 py-2">
                    {(versionList || []).length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted">
                        No versions yet. Create one to start playtesting.
                      </div>
                    ) : (
                      (versionList || []).map((item) => {
                        const isActive = item.versionName === activeVersionName;
                        const isPending = pendingVersionName === item.versionName;
                        const updatedLabel = formatSessionUpdatedLabel(item);
                        return (
                          <button
                            key={item.versionID ?? item.versionName}
                            type="button"
                            onClick={() => handleVersionSelect(item.versionName)}
                            disabled={isPending}
                            className={clsx(
                              'flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-200',
                              isActive
                                ? 'border-primary/60 bg-primary/10 text-primary'
                                : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10',
                              isPending && 'cursor-wait opacity-75'
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold">{item.versionName}</p>
                              <p className="mt-0.5 text-[11px] text-muted">Updated {updatedLabel}</p>
                            </div>
                            {isPending ? (
                              <RefreshCcw className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                            ) : isActive ? (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Active
                              </span>
                            ) : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                  {canCreateVersion ? (
                    <div className="border-t border-border/60 px-4 py-3">
                      <button
                        type="button"
                        onClick={handleCreateVersion}
                        disabled={creatingVersion}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        New version
                      </button>
                    </div>
                  ) : null}
                  <div className="border-t border-border/60 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Sessions</p>
                      <button
                        type="button"
                        onClick={() => refreshGameSessions()}
                        disabled={loadingSessions}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className={clsx('h-3.5 w-3.5', loadingSessions && 'animate-spin text-primary')} aria-hidden="true" />
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto px-2 py-2">
                    {loadingSessions ? (
                      <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted">
                        Syncing latest sessions...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted">
                        No saved sessions yet. Launch the experience to create one.
                      </div>
                    ) : (
                      sessions.map((item) => {
                        const isActive = item.sessionID === activeSessionID;
                        const updatedLabel = formatSessionUpdatedLabel(item);
                        return (
                          <button
                            key={item.sessionID}
                            type="button"
                            onClick={() => handleSelectSession(item.sessionID)}
                            className={clsx(
                              'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-200',
                              isActive
                                ? 'border-primary/60 bg-primary/10 text-primary'
                                : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10'
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold">{formatSessionName(item)}</p>
                              <p className="mt-0.5 text-[11px] text-muted">Updated {updatedLabel}</p>
                            </div>
                            {isActive ? (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                Current
                              </span>
                            ) : (
                              <Users className="h-4 w-4 text-muted" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
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
        <div className="relative z-10 flex w-full flex-1 flex-col min-h-0">
          {renderContent()}
        </div>
      </div>
    </RequireAuthentication>
  );
}

export default memo(Home);

