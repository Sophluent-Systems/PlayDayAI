"use client";

import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import {
  BookmarkMinus,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Eye,
  Home,
  Layers,
  Palette,
  Play,
  Share2,
  Wrench,
  GraduationCap,
  Loader2,
  RefreshCcw,
  User,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetAccountPermissionsForGame } from '@src/client/permissions';
import { callGetAllSessionsForGame, callListGameVersions } from '@src/client/editor';
import { ShareButton } from '@src/client/components/sharebutton';
import { PrettyDate } from '@src/common/date';
const MENU_WIDTH = 320;

const permissionsCache = new Map();
const permissionRequests = new Map();
const versionsCache = new Map();
const versionRequests = new Map();
const sessionsCache = new Map();
const sessionRequests = new Map();

const SESSION_NAME_FALLBACK = 'Untitled session';

function getCacheKey(accountID, gameUrl) {
  if (!accountID || !gameUrl) {
    return null;
  }
  return `${accountID}::${gameUrl}`;
}

function scheduleIdle(task) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(() => task(), { timeout: 1500 });
    return () => window.cancelIdleCallback(handle);
  }
  const timeout = setTimeout(() => task(), 120);
  return () => clearTimeout(timeout);
}

function getCachedPermissions(accountID, gameUrl) {
  if (!accountID || !gameUrl) {
    return Promise.resolve([]);
  }
  const key = getCacheKey(accountID, gameUrl);
  if (!key) {
    return Promise.resolve([]);
  }
  if (permissionsCache.has(key)) {
    return Promise.resolve(permissionsCache.get(key));
  }
  if (permissionRequests.has(key)) {
    return permissionRequests.get(key);
  }
  const request = callGetAccountPermissionsForGame(accountID, null, gameUrl)
    .then((permissions) => {
      const normalized = Array.isArray(permissions) ? [...permissions] : [];
      permissionsCache.set(key, normalized);
      permissionRequests.delete(key);
      return normalized;
    })
    .catch((error) => {
      permissionRequests.delete(key);
      throw error;
    });
  permissionRequests.set(key, request);
  return request;
}

function getCachedVersions(accountID, gameUrl) {
  if (!accountID || !gameUrl) {
    return Promise.resolve([]);
  }
  const key = getCacheKey(accountID, gameUrl);
  if (!key) {
    return Promise.resolve([]);
  }
  if (versionsCache.has(key)) {
    return Promise.resolve(versionsCache.get(key));
  }
  if (versionRequests.has(key)) {
    return versionRequests.get(key);
  }
  const request = callListGameVersions(null, gameUrl, false)
    .then((list) => {
      const normalized = Array.isArray(list) ? list.map((entry) => ({ ...entry })) : [];
      versionsCache.set(key, normalized);
      versionRequests.delete(key);
      return normalized;
    })
    .catch((error) => {
      versionRequests.delete(key);
      throw error;
    });
  versionRequests.set(key, request);
  return request;
}

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

function getSessionCacheKey(gameID, versionID, accountID) {
  if (!gameID || !versionID || !accountID) {
    return null;
  }
  return `${gameID}::${versionID}::${accountID}`;
}

function getCachedSessions(gameID, versionID, accountID) {
  const key = getSessionCacheKey(gameID, versionID, accountID);
  if (!key) {
    return Promise.resolve([]);
  }
  if (sessionsCache.has(key)) {
    return Promise.resolve(sessionsCache.get(key));
  }
  if (sessionRequests.has(key)) {
    return sessionRequests.get(key);
  }
  const request = callGetAllSessionsForGame(gameID, versionID, accountID)
    .then((list) => {
      const normalized = filterSessionsForAccount(Array.isArray(list) ? list : [], accountID);
      sessionsCache.set(key, normalized);
      sessionRequests.delete(key);
      return normalized;
    })
    .catch((error) => {
      sessionRequests.delete(key);
      throw error;
    });
  sessionRequests.set(key, request);
  return request;
}

function MenuPanel({ anchorRect, anchorElement, isOpen, children, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (!isOpen) {
        return;
      }
      // Don't close if clicking inside the panel or on the anchor button
      if (
        (panelRef.current && panelRef.current.contains(event.target)) ||
        (anchorElement && anchorElement.contains(event.target))
      ) {
        return;
      }
      onClose();
    }

    function handleKey(event) {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose, anchorElement]);

  if (!isOpen || !anchorRect) {
    return null;
  }

  const top = anchorRect.bottom + 12;
  
  // Align menu with button - prefer right edge alignment, fall back to left edge if overflows
  let left;
  if (typeof window !== 'undefined') {
    // Try to align the right edge of the menu with the right edge of the button
    const preferredLeft = anchorRect.right - MENU_WIDTH;
    
    // If that would go off the left side of the screen, align left edges instead
    if (preferredLeft < 16) {
      left = Math.min(anchorRect.left, window.innerWidth - MENU_WIDTH - 16);
    } else {
      left = Math.max(16, preferredLeft);
    }
  } else {
    // Server-side fallback: align with button's left edge
    left = anchorRect.left;
  }

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-50 flex w-[320px] flex-col rounded-3xl border border-border/60 bg-surface/95 shadow-[0_28px_55px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl"
      style={{ 
        top, 
        left,
        maxHeight: typeof window !== 'undefined' ? `calc(100vh - ${top}px - 16px)` : 'auto'
      }}
    >
      {children}
    </div>
  );

  if (typeof document === 'undefined') {
    return panel;
  }

  return createPortal(panel, document.body);
}

function MenuItem({ icon: Icon, label, description, onClick, disabled, trailing, isActive, variant = 'default' }) {
  const baseClasses =
    'group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200';
  const hoverClasses = disabled
    ? 'cursor-not-allowed opacity-50'
    : 'hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10';
  const toneClasses =
    variant === 'primary'
      ? 'border-primary/60 bg-primary/15 text-primary shadow-[0_12px_30px_-16px_rgba(99,102,241,0.45)]'
      : isActive
      ? 'border-primary/50 bg-primary/10 text-primary'
      : 'border-border/60 bg-surface/80 text-emphasis';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={description || undefined}
      className={clsx(baseClasses, hoverClasses, toneClasses)}
    >
      <span
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-xl border',
          variant === 'primary'
            ? 'border-transparent bg-primary text-white shadow-[0_10px_20px_-12px_rgba(99,102,241,0.7)]'
            : isActive
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/70 bg-surface/80 text-muted'
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex-1 truncate text-sm font-semibold leading-tight">{label}</span>
      {trailing}
    </button>
  );
}
export function GameMenuDropdown({
  gameUrl,
  gameID,
  allowEditOptions,
  includePlayOption,
  anchor,
  onMenuClose,
  onMenuUpdated,
  customMenuItems,
  onToggleFeatured,
  isFeatured,
}) {
  const {
    loading,
    account,
    game,
    versionList,
    version: activeVersion,
    session: activeSession,
    gamePermissions,
    switchVersionByName,
    switchSessionID,
    navigateTo,
    editMode,
    hasServicePerms,
  } = useContext(stateManager);
  const accountID = account?.accountID;
  const cacheKey = getCacheKey(accountID, gameUrl);

  const [gamePermissionsToUse, setGamePermissionsToUse] = useState(() => {
    if (gameUrl === game?.url && Array.isArray(gamePermissions)) {
      if (cacheKey) {
        permissionsCache.set(cacheKey, [...gamePermissions]);
      }
      return [...gamePermissions];
    }
    if (cacheKey && permissionsCache.has(cacheKey)) {
      return permissionsCache.get(cacheKey);
    }
    return null;
  });

  const [versions, setVersions] = useState(() => {
    if (gameUrl === game?.url && Array.isArray(versionList) && versionList.length > 0) {
      const normalized = versionList.map((entry) => ({ ...entry }));
      if (cacheKey) {
        versionsCache.set(cacheKey, normalized);
      }
      return normalized;
    }
    if (cacheKey && versionsCache.has(cacheKey)) {
      return versionsCache.get(cacheKey);
    }
    return [];
  });
  const [anchorRect, setAnchorRect] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const isAdmin = hasServicePerms ? hasServicePerms('service_modifyGlobalPermissions') : false;
  const menuOpen = Boolean(anchor);

  const activeSessionID = activeSession?.sessionID ?? null;
  const activeVersionID = activeVersion?.versionID ?? null;
  const effectiveGameID = gameID || activeVersion?.gameID || activeSession?.gameID || game?.gameID || null;
  const sessionCacheKey = getSessionCacheKey(effectiveGameID, activeVersionID, accountID);
  const canListSessions = Boolean(editMode && gamePermissionsToUse?.includes('game_play') && activeVersionID && effectiveGameID && accountID);

  useEffect(() => {
    if (!menuOpen) {
      setShowVersions(false);
      setShowSessions(false);
    }
  }, [menuOpen]);

  const updateAnchorRect = useCallback(() => {
    if (anchor && typeof anchor.getBoundingClientRect === 'function') {
      setAnchorRect(anchor.getBoundingClientRect());
    } else {
      setAnchorRect(null);
    }
  }, [anchor]);

  useEffect(() => {
    updateAnchorRect();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateAnchorRect);
      window.addEventListener('scroll', updateAnchorRect, true);
      return () => {
        window.removeEventListener('resize', updateAnchorRect);
        window.removeEventListener('scroll', updateAnchorRect, true);
      };
    }
    return undefined;
  }, [updateAnchorRect]);

  useEffect(() => {
    if (!sessionCacheKey) {
      setSessions([]);
      return;
    }
    if (sessionsCache.has(sessionCacheKey)) {
      setSessions(sessionsCache.get(sessionCacheKey));
    }
  }, [sessionCacheKey]);

  useEffect(() => {
    if (!menuOpen || !canListSessions || !sessionCacheKey) {
      return undefined;
    }
    let cancelled = false;

    if (sessionsCache.has(sessionCacheKey)) {
      setSessions(sessionsCache.get(sessionCacheKey));
      return undefined;
    }

    setLoadingSessions(true);
    getCachedSessions(effectiveGameID, activeVersionID, accountID)
      .then((list) => {
        if (!cancelled) {
          setSessions(list);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load sessions for project menu', error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [menuOpen, canListSessions, sessionCacheKey, effectiveGameID, activeVersionID, accountID]);

  useEffect(() => {
    if (!cacheKey && !(gameUrl === game?.url && Array.isArray(gamePermissions))) {
      setGamePermissionsToUse(null);
      return;
    }

    if (gameUrl === game?.url && Array.isArray(gamePermissions)) {
      const normalized = [...gamePermissions];
      if (cacheKey) {
        permissionsCache.set(cacheKey, normalized);
      }
      setGamePermissionsToUse(normalized);
      return;
    }

    if (cacheKey && permissionsCache.has(cacheKey)) {
      setGamePermissionsToUse(permissionsCache.get(cacheKey));
    }
  }, [cacheKey, gameUrl, game, gamePermissions]);

  useEffect(() => {
    if (!cacheKey && !(gameUrl === game?.url && Array.isArray(versionList) && versionList.length > 0)) {
      setVersions([]);
      return;
    }

    if (gameUrl === game?.url && Array.isArray(versionList) && versionList.length > 0) {
      const normalized = versionList.map((entry) => ({ ...entry }));
      if (cacheKey) {
        versionsCache.set(cacheKey, normalized);
      }
      setVersions(normalized);
      return;
    }

    if (cacheKey && versionsCache.has(cacheKey)) {
      setVersions(versionsCache.get(cacheKey));
    }
  }, [cacheKey, gameUrl, game, versionList]);

  useEffect(() => {
    if (loading || !accountID || !gameUrl) {
      return undefined;
    }
    if (gameUrl === game?.url && Array.isArray(gamePermissions)) {
      return undefined;
    }
    if (cacheKey && permissionsCache.has(cacheKey)) {
      return undefined;
    }

    let cancelled = false;

    const fetchPermissions = () => {
      getCachedPermissions(accountID, gameUrl)
        .then((permissions) => {
          if (!cancelled) {
            const normalizedPermissions = Array.isArray(permissions) ? permissions : [];
            if (cacheKey) {
              permissionsCache.set(cacheKey, normalizedPermissions);
            }
            setGamePermissionsToUse(normalizedPermissions);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Failed to load game permissions', error);
          }
        });
    };

    if (menuOpen && !gamePermissionsToUse) {
      fetchPermissions();
      return () => {
        cancelled = true;
      };
    }

    const cancelIdle = scheduleIdle(() => {
      if (!cancelled) {
        fetchPermissions();
      }
    });

    return () => {
      cancelled = true;
      if (typeof cancelIdle === 'function') {
        cancelIdle();
      }
    };
  }, [loading, accountID, gameUrl, cacheKey, menuOpen, gamePermissionsToUse, game, gamePermissions]);

  useEffect(() => {
    if (!allowEditOptions || !editMode || !accountID || !gameUrl) {
      return undefined;
    }
    if (!gamePermissionsToUse) {
      return undefined;
    }
    const canView = gamePermissionsToUse.includes('game_viewSource') || gamePermissionsToUse.includes('game_edit');
    if (!canView) {
      return undefined;
    }
    if (gameUrl === game?.url && Array.isArray(versionList) && versionList.length > 0) {
      return undefined;
    }

    const hasCachedVersions = cacheKey && versionsCache.has(cacheKey);
    let cancelled = false;

    const fetchVersions = () => {
      getCachedVersions(accountID, gameUrl)
        .then((list) => {
          if (!cancelled) {
            const normalizedList = Array.isArray(list) ? list : [];
            if (cacheKey) {
              versionsCache.set(cacheKey, normalizedList);
            }
            setVersions(normalizedList);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error('Failed to load versions for game menu', error);
          }
        });
    };

    if (menuOpen && (!hasCachedVersions || versions.length === 0)) {
      fetchVersions();
      return () => {
        cancelled = true;
      };
    }

    if (!hasCachedVersions) {
      const cancelIdle = scheduleIdle(() => {
        if (!cancelled) {
          fetchVersions();
        }
      });
      return () => {
        cancelled = true;
        if (typeof cancelIdle === 'function') {
          cancelIdle();
        }
      };
    }

    return () => {
      cancelled = true;
    };
  }, [
    allowEditOptions,
    editMode,
    accountID,
    gameUrl,
    cacheKey,
    menuOpen,
    gamePermissionsToUse,
    versions.length,
    game,
    versionList,
  ]);

  const handleNavigation = (relativePath) => {
    const switchingGames = gameUrl !== game?.url;
    navigateTo(relativePath, gameUrl, switchingGames);
    onMenuClose?.();
  };

  const handleGoHome = useCallback(() => {
    navigateTo('/', undefined, true);
    onMenuClose?.();
  }, [navigateTo, onMenuClose]);

  const handleSetVersion = (newVersionName, sourceGameID) => {
    const switchingGames = gameUrl !== game?.url;
    if (switchingGames) {
      handleNavigation('/play');
    }
    switchVersionByName(newVersionName, sourceGameID || gameID);
    setVersions((prev) => {
      const base = prev.length > 0 ? prev : Array.isArray(versionList) ? versionList : [];
      if (!base.length) {
        return prev;
      }
      const next = base.map((versionItem) => ({
        ...versionItem,
        isActive: versionItem.versionName === newVersionName,
      }));
      if (cacheKey) {
        versionsCache.set(cacheKey, next);
      }
      return next;
    });
    setShowVersions(false);
    onMenuClose?.();
  };

  const handleRefreshSessions = useCallback(async () => {
    if (!canListSessions || !sessionCacheKey || !effectiveGameID || !activeVersionID || !accountID) {
      return;
    }
    setLoadingSessions(true);
    try {
      const list = await callGetAllSessionsForGame(effectiveGameID, activeVersionID, accountID);
      const normalized = filterSessionsForAccount(Array.isArray(list) ? list : [], accountID);
      sessionsCache.set(sessionCacheKey, normalized);
      setSessions(normalized);
    } catch (error) {
      console.error('Failed to refresh sessions for project menu', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [canListSessions, sessionCacheKey, effectiveGameID, activeVersionID, accountID]);

  const handleSessionSelect = useCallback(
    async (sessionID) => {
      if (!sessionID) {
        return;
      }
      if (sessionID === activeSessionID) {
        onMenuClose?.();
        return;
      }
      try {
        await switchSessionID(sessionID, effectiveGameID);
      } catch (error) {
        console.error('Failed to switch session from project menu', error);
      } finally {
        onMenuClose?.();
      }
    },
    [activeSessionID, switchSessionID, effectiveGameID, onMenuClose]
  );

  const actions = useMemo(() => {
    if (!menuOpen) {
      return [];
    }

    const items = [];
    items.push({
      key: 'home',
      label: 'Back to home',
      description: 'Return to the workspace overview.',
      icon: Home,
      onSelect: handleGoHome,
    });
    if (!gamePermissionsToUse) {
      return items;
    }


    if (includePlayOption && gamePermissionsToUse.includes('game_play')) {
      items.push({
        key: 'play',
        label: 'Play now',
        description: 'Open the live experience in a new tab.',
        icon: Play,
        onSelect: () => handleNavigation('/play'),
        variant: 'primary',
      });
    }

    if (allowEditOptions && editMode) {
      if (gamePermissionsToUse.includes('game_edit')) {
        items.push({
          key: 'metadata',
          label: 'Edit metadata',
          description: 'Update title, artwork, and discovery info.',
          icon: Palette,
          onSelect: () => handleNavigation('/editdetails'),
        });
        items.push({
          key: 'builder',
          label: 'Open builder',
          description: 'Jump into the visual editor and game logic.',
          icon: Wrench,
          onSelect: () => handleNavigation('/editgameversions'),
        });
      }
      if (gamePermissionsToUse.includes('game_viewUsageData')) {
        items.push({
          key: 'sessions',
          label: 'View sessions',
          description: 'Inspect recent playthroughs and analytics.',
          icon: Eye,
          onSelect: () => handleNavigation('/sessionlist'),
        });
      }
      if (gamePermissionsToUse.includes('game_viewTrainingData')) {
        items.push({
          key: 'training',
          label: 'Training data',
          description: 'Curate conversational examples and transcripts.',
          icon: GraduationCap,
          onSelect: () => handleNavigation('/trainingdata'),
        });
      }
    }

    if (canListSessions) {
      items.push({
        key: 'session-switcher',
        label: 'Switch session',
        description: 'Resume a saved playtest session.',
        icon: User,
        type: 'sessions',
      });
    }

    if (allowEditOptions && editMode) {
      const canView = gamePermissionsToUse.includes('game_viewSource') || gamePermissionsToUse.includes('game_edit');
      if (canView && (versions.length > 0 || versionList?.length > 0)) {
        items.push({
          key: 'versions',
          label: 'Switch version',
          description: 'Activate a specific release for everyone.',
          icon: Layers,
          type: 'versions',
        });
      }
    }

    if (isAdmin && onToggleFeatured) {
      items.push({
        key: 'featured',
        label: isFeatured ? 'Remove from featured' : 'Add to featured',
        description: isFeatured
          ? 'Hide this project from the homepage spotlight.'
          : 'Highlight this project for all creators.',
        icon: isFeatured ? BookmarkMinus : BookmarkPlus,
        onSelect: () => {
          onToggleFeatured(gameID);
          onMenuClose?.();
        },
      });
    }

    if (customMenuItems && customMenuItems.length > 0) {
      customMenuItems.forEach((item, index) => {
        items.push({ key: 'custom-' + index, render: item });
      });
    }

    return items;
  }, [
    menuOpen,
    gamePermissionsToUse,
    includePlayOption,
    allowEditOptions,
    editMode,
    versions.length,
    versionList,
    canListSessions,
    isAdmin,
    isFeatured,
    onToggleFeatured,
    gameID,
    customMenuItems,
    handleNavigation,
    handleGoHome,
  ]);
  useEffect(() => {
    if (actions && onMenuUpdated) {
      onMenuUpdated(actions);
    }
  }, [actions, onMenuUpdated]);

  const shareAvailable =
    allowEditOptions && editMode && gamePermissionsToUse && gamePermissionsToUse.includes('game_modifyPermissions');

  const activeVersionName = activeVersion?.versionName;
  const combinedVersions = versions.length > 0 ? versions : versionList || [];

  return (
    <MenuPanel anchorRect={anchorRect} anchorElement={anchor} isOpen={menuOpen} onClose={() => onMenuClose?.()}>
      <>
        <div className="flex-shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/12 via-surface/60 to-transparent px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Project actions</p>
              <p className="mt-1 truncate text-sm font-semibold text-emphasis">{gameUrl}</p>
            </div>
            <button
              type="button"
              onClick={() => onMenuClose?.()}
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-primary hover:text-primary"
            >
              Close
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Pick what you want to do with this experience.</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain scroll-smooth px-4 pb-5 pt-4">
          <div className="space-y-1.5">
            {actions.map((action) => {
              if (action.render) {
                return <div key={action.key}>{action.render}</div>;
              }
              if (action.type === 'sessions') {
                const isExpanded = showSessions;
                const sessionCountLabel = loadingSessions ? '--' : `${sessions.length} saved`;
                return (
                  <div key={action.key}>
                    <MenuItem
                      icon={User}
                      label={action.label}
                      description={action.description}
                      onClick={() => setShowSessions((prev) => !prev)}
                      trailing={
                        <span className="rounded-full bg-border/60 p-1 text-muted">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      }
                      variant={isExpanded ? 'primary' : 'default'}
                      disabled={!canListSessions}
                    />
                    {isExpanded ? (
                      <div className="mt-2 space-y-3">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted">
                          <span>{sessionCountLabel}</span>
                          <button
                            type="button"
                            onClick={handleRefreshSessions}
                            disabled={loadingSessions}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <RefreshCcw className={clsx('h-3.5 w-3.5', loadingSessions && 'animate-spin text-primary')} aria-hidden="true" />
                            Refresh
                          </button>
                        </div>
                        {loadingSessions ? (
                          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/80 px-4 py-5 text-sm text-muted">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading sessions
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="rounded-2xl border border-border/60 bg-surface/80 px-4 py-5 text-sm text-muted">
                            No saved sessions yet.
                          </div>
                        ) : (
                          sessions.map((sessionItem) => {
                            const isCurrent = sessionItem.sessionID === activeSessionID;
                            const updatedLabel = formatSessionUpdatedLabel(sessionItem);
                            return (
                              <button
                                key={sessionItem.sessionID}
                                type="button"
                                onClick={() => handleSessionSelect(sessionItem.sessionID)}
                                className={clsx(
                                  'flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200',
                                  isCurrent
                                    ? 'border-primary/60 bg-primary/10 text-primary'
                                    : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10'
                                )}
                              >
                                <span>
                                  <span className="block text-sm font-semibold leading-tight">{formatSessionName(sessionItem)}</span>
                                  <span className="mt-1 block text-[11px] text-muted">Updated {updatedLabel}</span>
                                </span>
                                {isCurrent ? (
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                    Current
                                  </span>
                                ) : null}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              }

              if (action.type === 'versions') {
                const isExpanded = showVersions;
                return (
                  <div key={action.key}>
                    <MenuItem
                      icon={Layers}
                      label={action.label}
                      description={action.description}
                      onClick={() => setShowVersions((prev) => !prev)}
                      trailing={
                        <span className="rounded-full bg-border/60 p-1 text-muted">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      }
                      variant={isExpanded ? 'primary' : 'default'}
                    />
                    {isExpanded ? (
                      <div className="mt-2 space-y-2">
                        {combinedVersions.map((versionItem) => {
                          const isCurrent = activeVersionName
                            ? versionItem.versionName === activeVersionName
                            : versionItem.isActive;
                          return (
                            <button
                              key={versionItem.versionName}
                              type="button"
                              onClick={() => handleSetVersion(versionItem.versionName, versionItem.gameID)}
                              className={clsx(
                                'flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-sm transition-all duration-200',
                                isCurrent
                                  ? 'border-primary/60 bg-primary/10 text-primary'
                                  : 'border-border/60 bg-surface/80 text-emphasis hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10'
                              )}
                            >
                              <span className="truncate">{versionItem.versionName}</span>
                              {isCurrent ? (
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                                  Active
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <MenuItem
                  key={action.key}
                  icon={action.icon}
                  label={action.label}
                  description={action.description}
                  onClick={() => {
                    action.onSelect?.();
                  }}
                  trailing={action.trailing}
                  isActive={action.isActive}
                  variant={action.variant}
                />
              );
            })}
          </div>
          {shareAvailable ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emphasis">
                <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Collaboration</span>
              </div>
              <ShareButton gameID={gameID} onClose={() => onMenuClose?.()} />
            </div>
          ) : null}
        </div>
      </>
    </MenuPanel>
  );
}
