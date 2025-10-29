'use client';

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Loader2, Clock, User, AlertTriangle } from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetAllSessionsForGame } from '@src/client/editor';
import { PrettyDate } from '@src/common/date';
import SessionViewer from '@src/client/components/sessionviewer';
import { defaultAppTheme } from '@src/common/theme';
import { useAtom } from 'jotai';
import { vhState } from '@src/client/states';

function PageContainer({ children }) {
  return (
    <div className="px-4 pt-28 pb-16 sm:px-6 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12">{children}</div>
    </div>
  );
}

function FullPageState({ icon, title, description, children }) {
  return (
    <div className="glass-panel mx-auto max-w-xl text-center">
      <div className="flex flex-col items-center gap-4">
        {icon ? <div className="rounded-2xl border border-border/40 bg-surface/80 p-3">{icon}</div> : null}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-emphasis">{title}</h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function InlinePlaceholder({ icon, title, description, children }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center">
      {icon ? <div className="rounded-2xl border border-border/50 bg-surface/80 p-3">{icon}</div> : null}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-emphasis">{title}</h3>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function SessionListPage() {
  const { loading, account, game, version, gamePermissions, editMode, session, switchSessionID } =
    useContext(stateManager);
  const [, setViewportHeight] = useAtom(vhState);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionID, setSelectedSessionID] = useState(null);
  const [isFetchingSessions, setIsFetchingSessions] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const gameID = game?.gameID ?? null;
  const versionID = version?.versionID ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const updateViewportHeight = () => {
      setViewportHeight(`${window.innerHeight}px`);
    };
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, [setViewportHeight]);

  useEffect(() => {
    if (!gameID || !versionID) {
      setSessions([]);
      setSelectedSessionID(null);
      setFetchError(null);
      setIsFetchingSessions(false);
      return;
    }

    let isCancelled = false;

    const fetchSessions = async () => {
      setIsFetchingSessions(true);
      setFetchError(null);
      try {
        const sessionList = await callGetAllSessionsForGame(gameID, versionID);
        if (isCancelled) {
          return;
        }
        const normalized = Array.isArray(sessionList) ? sessionList : [];
        setSessions(normalized);
        if (normalized.length === 0) {
          setSelectedSessionID(null);
          return;
        }
        setSelectedSessionID((previous) => {
          if (previous && normalized.some((entry) => entry.sessionID === previous)) {
            return previous;
          }
          return normalized[0].sessionID;
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }
        console.error('Error fetching game sessions:', error);
        setSessions([]);
        setSelectedSessionID(null);
        setFetchError('We could not load sessions for this version. Try again in a moment.');
      } finally {
        if (!isCancelled) {
          setIsFetchingSessions(false);
        }
      }
    };

    fetchSessions();

    return () => {
      isCancelled = true;
    };
  }, [gameID, versionID, reloadToken]);

  const selectedSession = useMemo(
    () => sessions.find((entry) => entry.sessionID === selectedSessionID) ?? null,
    [sessions, selectedSessionID]
  );

  useEffect(() => {
    const activeSessionID = session?.sessionID ?? null;
    if (!activeSessionID) {
      setSelectedSessionID((prev) => (prev === null ? prev : null));
      return;
    }
    setSelectedSessionID((prev) => (prev === activeSessionID ? prev : activeSessionID));
  }, [session?.sessionID]);

  const handleSelectSession = useCallback(
    (sessionID) => {
      setSelectedSessionID(sessionID);
      if (sessionID && sessionID !== session?.sessionID) {
        switchSessionID(sessionID, game?.gameID);
      }
    },
    [switchSessionID, game?.gameID, session?.sessionID]
  );

  const handleRetry = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  if (loading) {
    return (
      <PageContainer>
        <FullPageState
          icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
          title="Loading session archive"
          description="Hang tight while we prepare your workspace."
        />
      </PageContainer>
    );
  }

  if (!account) {
    return (
      <PageContainer>
        <FullPageState
          title="Sign in required"
          description="You need to be signed in to review saved sessions. Please refresh or sign in again."
        />
      </PageContainer>
    );
  }

  if (!game) {
    return (
      <PageContainer>
        <FullPageState
          title="Project unavailable"
          description="We couldn't find this experience. Make sure the URL is correct or that you still have access."
        />
      </PageContainer>
    );
  }

  if (!gamePermissions?.includes('game_modifyPermissions')) {
    return (
      <PageContainer>
        <FullPageState
          title="You don't have access"
          description="Ask an editor to share this project or adjust your permissions to view its sessions."
        />
      </PageContainer>
    );
  }

  if (!editMode) {
    return (
      <PageContainer>
        <FullPageState
          title="Turn on edit mode"
          description="Switch to edit mode to inspect past sessions and debug player journeys."
        />
      </PageContainer>
    );
  }

  const hasSessions = sessions.length > 0;
  const headerSubtitle = fetchError
    ? 'We hit a snag loading sessions. Try again in a moment.'
    : hasSessions
    ? `Review ${sessions.length} saved ${sessions.length === 1 ? 'session' : 'sessions'} from real players.`
    : 'Select a version to load saved sessions and review playthroughs.';

  return (
    <PageContainer>
      <header className="space-y-6">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            Session archive
          </span>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-emphasis">Play session history</h1>
            <p className="max-w-2xl text-sm text-muted">{headerSubtitle}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="space-y-4">
          <div className="glass-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-emphasis">Sessions</h2>
                <p className="text-xs text-muted">Pick a session to inspect the transcript.</p>
              </div>
              <span className="tag text-[11px] uppercase tracking-wide">
                {isFetchingSessions && !hasSessions ? 'Loading…' : `${sessions.length} total`}
              </span>
            </div>

            <div className="mt-5 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {isFetchingSessions && !hasSessions ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-2xl border border-border/60 bg-surface/60"
                    />
                  ))}
                </div>
              ) : null}

              {fetchError ? (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-5 text-sm text-rose-100">
                  <p>{fetchError}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="button-secondary mt-4 w-full justify-center"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {!isFetchingSessions && !fetchError && !hasSessions ? (
                <div className="rounded-2xl border border-border/60 bg-surface/70 px-4 py-6 text-sm text-muted">
                  {version
                    ? 'No sessions recorded for this version yet. Once players start a run, they\'ll show up here.'
                    : 'Select a version to see the sessions associated with it.'}
                </div>
              ) : null}

              {sessions.map((session) => {
                const accountName = session?.account?.email || session?.accountID || 'Unknown player';
                const assignedName = session?.assignedName;
                const isSelected = session.sessionID === selectedSessionID;
                const lastPlayed = session?.latestUpdate ? PrettyDate(session.latestUpdate) : 'Unknown date';
                const versionName = session?.versionInfo?.versionName;

                return (
                  <button
                    key={session.sessionID}
                    type="button"
                    onClick={() => handleSelectSession(session.sessionID)}
                    className={clsx(
                      'w-full rounded-2xl border px-4 py-4 text-left transition-all duration-150',
                      isSelected
                        ? 'border-primary/60 bg-primary/10 shadow-[0_18px_44px_-28px_rgba(79,70,229,0.65)]'
                        : 'border-border/60 bg-surface/80 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted" aria-hidden="true" />
                          <p className="truncate text-sm font-semibold text-emphasis">
                            {assignedName || accountName}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                            Last played {lastPlayed}
                          </span>
                          <span>User: {accountName}</span>
                        </div>
                      </div>
                      {versionName ? (
                        <span className="tag whitespace-nowrap text-[11px] uppercase tracking-wide">
                          {versionName}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="glass-panel min-h-[420px]">
          {!version ? (
            <InlinePlaceholder
              title="Choose a version"
              description="Pick a version from the selector to view its saved sessions."
            />
          ) : fetchError ? (
            <InlinePlaceholder
              icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
              title="Couldn't load sessions"
              description="Something went wrong while loading this version's sessions."
            >
              <button
                type="button"
                onClick={handleRetry}
                className="button-secondary"
              >
                Try again
              </button>
            </InlinePlaceholder>
          ) : isFetchingSessions && !selectedSession ? (
            <InlinePlaceholder
              icon={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
              title="Loading sessions"
              description="We're pulling in the latest play sessions for this version."
            />
          ) : selectedSession ? (
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface/80">
              <SessionViewer
                key={selectedSession.sessionID}
                theme={game?.theme ?? defaultAppTheme}
                game={game}
                sessionID={selectedSession.sessionID}
                editMode={editMode}
              />
            </div>
          ) : hasSessions ? (
            <InlinePlaceholder
              title="Select a session"
              description="Choose a session from the list to replay the conversation."
            />
          ) : (
            <InlinePlaceholder
              title="No sessions yet"
              description="As soon as someone plays this experience, the full transcript will show up here."
            />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
