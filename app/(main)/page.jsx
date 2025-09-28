'use client';

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BookmarkMinus,
  BookmarkPlus,
  History,
  LayoutDashboard,
  ListFilter,
  PenSquare,
  Play,
  Plus,
  Sparkles,
  Star,
  Layers,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetGamesList, callCreateNewGame, callUpdateGameInfo } from '@src/client/gameplay';
import { ThemeToggle } from '@src/client/components/ui/themetoggle';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown';


function hexToRgb(value) {
  if (!value) {
    return null;
  }
  let hex = value.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (hex.length < 6) {
    return null;
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }
  return { r, g, b };
}

function withAlpha(color, alpha) {
  if (!color) {
    return `rgba(99, 102, 241, ${alpha})`;
  }
  if (color.startsWith('#')) {
    const rgb = hexToRgb(color);
    if (!rgb) {
      return `rgba(99, 102, 241, ${alpha})`;
    }
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
  const rgbMatch = color.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const channels = rgbMatch[1]
      .split(',')
      .slice(0, 3)
      .map((part) => parseInt(part.trim(), 10));
    if (channels.length === 3 && channels.every((channel) => !Number.isNaN(channel))) {
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
    }
  }
  return color;
}

function resolveGamePalette(game) {
  const themeColors = game?.theme?.colors || {};
  const primary = themeColors.buttonColor || themeColors.messageBackgroundColor || '#6366f1';
  const secondary = themeColors.messageTextColor || themeColors.audioVisualizationColor || '#22d3ee';
  return {
    gradient: `linear-gradient(140deg, ${withAlpha(primary, 0.2)} 0%, ${withAlpha(secondary, 0.08)} 100%)`,
    border: withAlpha(primary, 0.35),
    badge: withAlpha(primary, 0.16),
    glow: withAlpha(primary, 0.22),
  };
}

function RequireAccount({ children }) {
  const { loading, account } = useContext(stateManager);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="glass-panel w-full max-w-md text-center">
          <p className="text-lg font-semibold text-emphasis">Loading your workspace...</p>
          <p className="mt-2 text-sm text-muted">
            We are syncing your projects and saved sessions so everything is ready to go.
          </p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="glass-panel w-full max-w-lg text-center">
          <h1 className="text-3xl font-semibold text-emphasis">Sign in to continue</h1>
          <p className="mt-3 text-sm text-muted">
            You need to be signed in to access your projects. Please refresh or sign in again.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Modal({ open, onClose, title, description, children, footer }) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-surface/95 p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            {title ? <h2 className="text-2xl font-semibold text-emphasis">{title}</h2> : null}
            {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-primary hover:text-primary"
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>
        <div className="mt-6 space-y-5 text-sm text-muted">{children}</div>
        {footer ? <div className="mt-8 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

function PrimaryButton({ children, icon: Icon, onClick, type = 'button', className, disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(99,102,241,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_35px_-12px_rgba(99,102,241,0.75)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function SecondaryButton({ children, icon: Icon, onClick, type = 'button', className, disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-emphasis transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="glass-panel flex flex-col items-center justify-center gap-4 text-center sm:col-span-full">
      <Sparkles className="h-8 w-8 text-primary" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-emphasis">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

function AddProjectCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[280px] flex-col justify-between rounded-3xl border-2 border-dashed border-border/80 bg-surface/60 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-surface"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
        <Plus className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-2 pt-4">
        <h3 className="text-xl font-semibold text-emphasis">Create a new experience</h3>
        <p className="text-sm text-muted">
          Start from an empty canvas or duplicate a template. Shape prompts, logic, and visuals in minutes.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 pt-6 text-sm font-semibold text-primary">
        Start a project
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  );
}
function GameCard({
  game,
  palette,
  onPlay,
  onResume,
  onOpenMenu,
  menuOpen,
  menuAnchor,
  isFeatured,
  featuredOrder,
  canFeature,
  onToggleFeatured,
  moveFeatured,
  children,
}) {
  const [featuredMenuOpen, setFeaturedMenuOpen] = useState(false);
  const featuredMenuButtonRef = useRef(null);
  const featuredMenuContentRef = useRef(null);
  const [featuredMenuPosition, setFeaturedMenuPosition] = useState(null);

  const updateFeaturedMenuPosition = useCallback(() => {
    if (!featuredMenuButtonRef.current) {
      return;
    }
    const rect = featuredMenuButtonRef.current.getBoundingClientRect();
    const width = 256;
    const gutter = 16;
    const offset = 8;
    let left = rect.left + rect.width - width;
    left = Math.max(gutter, Math.min(window.innerWidth - width - gutter, left));
    const top = rect.bottom + offset;
    setFeaturedMenuPosition({
      top: top + window.scrollY,
      left: left + window.scrollX,
    });
  }, []);

  useEffect(() => {
    if (!featuredMenuOpen) {
      return undefined;
    }

    updateFeaturedMenuPosition();

    function handleClick(event) {
      if (
        featuredMenuContentRef.current &&
        !featuredMenuContentRef.current.contains(event.target) &&
        !featuredMenuButtonRef.current?.contains(event.target)
      ) {
        setFeaturedMenuOpen(false);
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        setFeaturedMenuOpen(false);
      }
    }

    const handleViewportChange = () => {
      updateFeaturedMenuPosition();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [featuredMenuOpen, updateFeaturedMenuPosition]);

  useEffect(() => {
    if (!canFeature) {
      setFeaturedMenuOpen(false);
    }
  }, [canFeature]);

  const category = game.category || 'AI experience';
  const description = game.description || 'Bring your story to life with adaptive AI-driven play.';
  const updatedLabel = (() => {
    if (!game.updatedAt) {
      return null;
    }
    const parsed = new Date(game.updatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleDateString();
  })();

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-surface/90 shadow-[0_25px_45px_-20px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_55px_-18px_rgba(99,102,241,0.45)]"
      style={{ borderColor: palette.border, backgroundImage: palette.gradient }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: palette.gradient }}
        aria-hidden="true"
      />
      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emphasis"
              style={{ backgroundColor: palette.badge }}
            >
              {category}
              {isFeatured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {featuredOrder ? `#${featuredOrder}` : 'Featured'}
                </span>
              ) : null}
            </span>
            <h3 className="text-2xl font-semibold leading-tight text-emphasis">{game.title}</h3>
            <p className="line-clamp-3 text-sm text-muted">{description}</p>
          </div>
          <div className="relative flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                ref={menuAnchor}
                onClick={onOpenMenu}
                className={clsx(
                  'rounded-full border bg-surface/80 p-2 text-muted transition-all duration-200 hover:text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  menuOpen ? 'border-primary/60 text-primary' : 'border-border/70'
                )}
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                aria-label="Project actions"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              </button>
              {canFeature ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFeaturedMenuOpen((prev) => !prev);
                  }}
                  ref={featuredMenuButtonRef}
                  className={clsx(
                    'rounded-full border border-border/70 bg-surface/80 p-2 text-muted transition-colors duration-200 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    featuredMenuOpen ? 'border-primary/60 text-primary' : isFeatured ? 'border-primary/30 text-primary' : null
                  )}
                  aria-haspopup="dialog"
                  aria-expanded={featuredMenuOpen}
                  aria-label={isFeatured ? 'Open featured controls (currently featured)' : 'Open featured controls'}
                >
                  {isFeatured ? (
                    <BookmarkMinus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
            {canFeature && featuredMenuOpen && featuredMenuPosition
              ? createPortal(
                  <div
                    ref={featuredMenuContentRef}
                    className="fixed z-50 w-64 rounded-2xl border border-border/70 bg-surface/95 p-4 text-left shadow-[0_24px_45px_-25px_rgba(15,23,42,0.45)]"
                    style={{ top: featuredMenuPosition.top, left: featuredMenuPosition.left }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Featured controls</span>
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', isFeatured ? 'bg-primary/15 text-primary' : 'bg-border/40 text-muted')}
                      >
                        {isFeatured ? 'Active' : 'Not featured'}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3 text-sm text-muted">
                      <p className="leading-relaxed">Highlight this experience on the home page spotlight.</p>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleFeatured?.();
                          setFeaturedMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-surface/80 px-3 py-2 text-left text-sm font-semibold text-emphasis transition-colors duration-200 hover:border-primary/40 hover:text-primary"
                      >
                        <span>{isFeatured ? 'Remove from featured' : 'Mark as featured'}</span>
                        {isFeatured ? (
                          <BookmarkMinus className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {isFeatured && moveFeatured ? (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Featured order</p>
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              const action = moveFeatured('up');
                              action?.();
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-surface/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-primary/40 hover:text-primary"
                            aria-label="Move featured project up"
                          >
                            <ChevronUp className="h-3 w-3" aria-hidden="true" />
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              const action = moveFeatured('down');
                              action?.();
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-surface/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:border-primary/40 hover:text-primary"
                            aria-label="Move featured project down"
                          >
                            Down
                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>,
                  document.body
                )
              : null}
          </div>
        </div>

        <div className="mt-6 flex flex-1 flex-col justify-end gap-4 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <PrimaryButton icon={Play} onClick={onPlay}>
              Play now
            </PrimaryButton>
          </div>
        </div>
      </div>
      {children}
    </article>
  );
}
export default function HomePage() {
  const router = useRouter();
  const {
    account,
    loading,
    startNewGameSession,
    version,
    accountHasRole,
  } = useContext(stateManager);
  const firstName = account?.displayName?.split(' ')[0];
  const heroTitle = firstName ? `Welcome back, ${firstName}` : 'Design and ship living AI experiences';
  const heroSubtitle = firstName
    ? 'Pick up where you left off or launch a fresh playtest.'
    : 'Prototype branching stories, orchestrate prompts, and collect feedback in one workspace.';

  const [games, setGames] = useState([]);
  const [featuredGames, setFeaturedGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [communityGames, setCommunityGames] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameUrl, setNewGameUrl] = useState('');
  const [activeMenu, setActiveMenu] = useState({});
  const menuRefs = useRef({});

  const isAdmin = accountHasRole ? accountHasRole('admin') : false;
  const isCreator = isAdmin || (accountHasRole ? accountHasRole('creator') : false);
  const accountID = account?.accountID ?? null;

  const fetchGames = useCallback(async () => {
    const response = await callGetGamesList();
    if (!response) {
      return;
    }

    const normalized = response.map((item) => ({ ...item }));
    const featured = [];
    const mine = [];
    const others = [];

    normalized.forEach((game) => {
      if (game.featuredIndex && game.featuredIndex > 0) {
        featured.push({ ...game });
      }
      if (accountID && game.creatorAccountID === accountID) {
        mine.push(game);
      } else {
        others.push(game);
      }
    });

    featured.sort((a, b) => (a.featuredIndex || 0) - (b.featuredIndex || 0));

    setFeaturedGames(featured);
    setMyGames(mine);
    setCommunityGames(others);
    setGames(normalized);
  }, [accountID]);

  const applyFeaturedUpdates = useCallback(
    (updates) => {
      if (!updates || updates.size === 0) {
        return;
      }

      const applyToCollection = (setCollection) => {
        setCollection((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            const update = updates.get(item.gameID);
            if (!update) {
              return item;
            }
            changed = true;
            return { ...item, ...update };
          });
          return changed ? next : prev;
        });
      };

      applyToCollection(setGames);
      applyToCollection(setMyGames);
      applyToCollection(setCommunityGames);
    },
    [setGames, setMyGames, setCommunityGames]
  );

  const reindexFeaturedList = (list) => {
    const updates = new Map();
    const normalizedList = list.map((item, index) => {
      const desiredIndex = index + 1;
      if (item.featuredIndex === desiredIndex) {
        return item;
      }
      const nextItem = { ...item, featuredIndex: desiredIndex };
      updates.set(nextItem.gameID, { featuredIndex: desiredIndex });
      return nextItem;
    });
    return { normalized: normalizedList, updates };
  };

  const buildFeaturedToggle = (currentFeatured, targetGame) => {
    const updates = new Map();
    const workingList = currentFeatured.map((item) => ({ ...item }));
    const existingIndex = workingList.findIndex((item) => item.gameID === targetGame.gameID);

    if (existingIndex >= 0) {
      workingList.splice(existingIndex, 1);
      updates.set(targetGame.gameID, { featuredIndex: 0 });
    } else {
      const nextIndex = workingList.length + 1;
      const nextGame = { ...targetGame, featuredIndex: nextIndex };
      workingList.push(nextGame);
      updates.set(targetGame.gameID, { featuredIndex: nextIndex });
    }

    workingList.sort((a, b) => (a.featuredIndex || 0) - (b.featuredIndex || 0));
    const { normalized, updates: reindexedUpdates } = reindexFeaturedList(workingList);
    reindexedUpdates.forEach((value, key) => updates.set(key, value));

    return { nextFeatured: normalized, updates };
  };

  useEffect(() => {
    if (!loading && accountID) {
      fetchGames();
    }
  }, [loading, accountID, fetchGames]);

  const handleOpenMenu = (gameUrl) => (event) => {
    event.stopPropagation();
    setActiveMenu((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        next[key] = false;
      });
      next[gameUrl] = !prev[gameUrl];
      return next;
    });
    if (event?.currentTarget) {
      menuRefs.current[gameUrl] = event.currentTarget;
    }
  };

  const closeMenu = (gameUrl) => {
    setActiveMenu((prev) => ({ ...prev, [gameUrl]: false }));
  };

  const handlePlay = (gameUrl) => {
    router.push('/play/' + gameUrl);
  };

  const handleResume = async (gameUrl) => {
    if (!startNewGameSession) {
      return;
    }
    const newSession = await startNewGameSession();
    const versionQuery =
      version && version.versionName ? '?versionName=' + encodeURIComponent(version.versionName) : '';
    const connector = versionQuery ? '&' : '?';
    router.push('/play/' + gameUrl + versionQuery + connector + 'sessionID=' + newSession.sessionID);
  };

  const handleToggleFeatured = async (game) => {
    if (!isAdmin) {
      return;
    }

    const { nextFeatured, updates } = buildFeaturedToggle(featuredGames, game);

    if (updates.size === 0) {
      return;
    }

    setFeaturedGames(nextFeatured);
    applyFeaturedUpdates(updates);

    try {
      await Promise.all(
        Array.from(updates.entries()).map(([gameID, data]) =>
          callUpdateGameInfo({ gameID, featuredIndex: data.featuredIndex ?? 0 })
        )
      );
    } catch (error) {
      console.error('Failed to toggle featured game', error);
      await fetchGames();
    }
  };

  const handleMoveFeatured = (game, direction) => async () => {
    if (!isAdmin) {
      return;
    }
    const currentIndex = featuredGames.findIndex((item) => item.gameID === game.gameID);
    if (currentIndex === -1) {
      return;
    }
    const offset = direction === 'up' ? -1 : 1;
    const swapIndex = currentIndex + offset;
    if (swapIndex < 0 || swapIndex >= featuredGames.length) {
      return;
    }

    const reordered = featuredGames.map((item) => ({ ...item }));
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(swapIndex, 0, moved);

    const { normalized, updates } = reindexFeaturedList(reordered);
    if (updates.size === 0) {
      return;
    }

    setFeaturedGames(normalized);
    applyFeaturedUpdates(updates);

    try {
      await Promise.all(
        Array.from(updates.entries()).map(([gameID, data]) =>
          callUpdateGameInfo({ gameID, featuredIndex: data.featuredIndex ?? 0 })
        )
      );
    } catch (error) {
      console.error('Failed to reorder featured games', error);
      await fetchGames();
    }
  };

  const canAddGame = () => {
    const urlPattern = /^(?!.*\/\/)[a-zA-Z0-9-_]+$/;
    return newGameTitle.trim().length > 0 && urlPattern.test(newGameUrl);
  };

  const handleCreateGame = async () => {
    if (!canAddGame()) {
      return;
    }
    const title = newGameTitle.trim();
    const url = newGameUrl.trim();
    await callCreateNewGame(title, url);
    setAddDialogOpen(false);
    setNewGameTitle('');
    setNewGameUrl('');
    router.push('/editgameversions/' + url);
  };

  const hasPersonalProjects = myGames.length > 0;
  const hasFeaturedProjects = featuredGames.length > 0;
  const hasCommunityProjects = communityGames.length > 0;

  const snapshotStats = [
    { label: 'Total projects', value: games.length },
    { label: 'Featured projects', value: featuredGames.length },
    { label: 'Shared with you', value: communityGames.length },
  ];

  const renderGameCard = (game, options = {}) => {
    const palette = resolveGamePalette(game);
    const isFeatured = options.isFeatured ?? Boolean(game.featuredIndex && game.featuredIndex > 0);
    const listKey = options.listKey ?? game.gameID;

    return (
      <GameCard
        key={listKey}
        game={game}
        palette={palette}
        onPlay={() => handlePlay(game.url)}
        onResume={startNewGameSession ? () => handleResume(game.url) : null}
        onOpenMenu={handleOpenMenu(game.url)}
        menuOpen={!!activeMenu[game.url]}
        menuAnchor={(node) => {
          if (node) {
            menuRefs.current[game.url] = node;
          }
        }}
        isFeatured={isFeatured}
        featuredOrder={game.featuredIndex}
        canFeature={isAdmin}
        onToggleFeatured={() => handleToggleFeatured(game)}
        moveFeatured={isAdmin ? (direction) => handleMoveFeatured(game, direction) : null}
      >
        <GameMenuDropdown
          onMenuClose={() => closeMenu(game.url)}
          anchor={activeMenu[game.url] ? menuRefs.current[game.url] : null}
          gameUrl={game.url}
          gameID={game.gameID}
          allowEditOptions
          includePlayOption
          onToggleFeatured={() => handleToggleFeatured(game)}
          isFeatured={isFeatured}
        />
      </GameCard>
    );
  };

  return (
    <RequireAccount>
      <main className="relative overflow-hidden pb-24">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-primary/12 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-12 sm:px-8 lg:px-10">
          <header className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                Play Day.AI workspace
              </span>
              <div className="pointer-events-auto">
                <ThemeToggle className="border border-border/60 bg-surface/80 px-2 py-1" />
              </div>
            </div>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-12">
              <div className="space-y-6">
                <h1 className="text-4xl font-semibold tracking-tight text-emphasis sm:text-5xl">{heroTitle}</h1>
                <p className="max-w-xl text-lg text-muted sm:text-xl">{heroSubtitle}</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <PrimaryButton icon={Sparkles} onClick={() => setAddDialogOpen(true)}>
                    Create project
                  </PrimaryButton>
                  {hasFeaturedProjects ? (
                    <button
                      type="button"
                      onClick={() => {
                        const node = document.getElementById('featured');
                        if (node) {
                          node.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-emphasis"
                    >
                      Browse featured
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <section id="workspace" className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-emphasis">Your projects</h2>
                <p className="text-sm text-muted">Stay focused on the experiences you're actively shaping.</p>
              </div>
              {isCreator && hasPersonalProjects ? (
                <SecondaryButton icon={Plus} onClick={() => setAddDialogOpen(true)}>
                  New project
                </SecondaryButton>
              ) : null}
            </div>
            {!hasPersonalProjects ? (
              <EmptyState
                title="No projects yet"
                description="Start a new concept or ask a teammate to share one with you."
                action={
                  isCreator ? (
                    <PrimaryButton icon={Sparkles} onClick={() => setAddDialogOpen(true)}>
                      Create your first project
                    </PrimaryButton>
                  ) : null
                }
              />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {isCreator ? <AddProjectCard onClick={() => setAddDialogOpen(true)} /> : null}
                {myGames.map((game) => renderGameCard(game, { listKey: `mine-${game.gameID}` }))}
              </div>
            )}
          </section>

          {hasFeaturedProjects ? (
            <section id="featured" className="space-y-6">
              <div>
                <h2 className="text-3xl font-semibold text-emphasis">Featured</h2>
                <p className="text-sm text-muted">Quick access to the builds ready for a spotlight.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredGames.map((game) => renderGameCard(game, { isFeatured: true, listKey: `featured-${game.gameID}` }))}
              </div>
            </section>
          ) : null}

          {hasCommunityProjects ? (
            <section id="community" className="space-y-6">
              <div>
                <h2 className="text-3xl font-semibold text-emphasis">Shared with you</h2>
                <p className="text-sm text-muted">Explore experiences other teams have made available.</p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {communityGames.map((game) => renderGameCard(game, { listKey: `community-${game.gameID}` }))}
              </div>
            </section>
          ) : null}

          <Modal
            open={addDialogOpen}
            onClose={() => setAddDialogOpen(false)}
            title="Create a new project"
            description="Name your experience and choose a short URL. You can edit everything later."
            footer={[
              <SecondaryButton key="cancel" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </SecondaryButton>,
              <PrimaryButton key="create" onClick={handleCreateGame} disabled={!canAddGame()}>
                Create project
              </PrimaryButton>,
            ]}
          >
            <div className="grid gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="new-game-title" className="text-sm font-semibold text-emphasis">
                  Project title
                </label>
                <input
                  id="new-game-title"
                  value={newGameTitle}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNewGameTitle(value);
                    if (!newGameUrl && value) {
                      setNewGameUrl(
                        value
                          .toLowerCase()
                          .replace(/[^a-z0-9-_]/g, '-')
                          .replace(/-+/g, '-')
                          .replace(/^-|-$/g, '')
                      );
                    }
                  }}
                  placeholder="e.g. Neon City Heist"
                  className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="new-game-url" className="text-sm font-semibold text-emphasis">
                  Project URL slug
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
                  <span className="text-sm text-muted">playday.ai/</span>
                  <input
                    id="new-game-url"
                    value={newGameUrl}
                    onChange={(event) => setNewGameUrl(event.target.value)}
                    placeholder="my-neon-heist"
                    className="flex-1 bg-transparent text-sm text-emphasis focus:outline-none"
                  />
                </div>
                <p className="text-xs text-muted">Letters, numbers, dashes, and underscores only.</p>
              </div>
            </div>
          </Modal>
        </div>
      </main>
    </RequireAccount>
  );
}
