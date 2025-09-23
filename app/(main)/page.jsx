'use client';

import React, { useContext, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  LayoutDashboard,
  Plus,
  Rocket,
  Sparkles,
  Star,
  StarOff,
  Users,
  Wand2,
  GaugeCircle,
  ShieldCheck,
  Workflow,
  BookOpen,
  Play,
  MonitorUp,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetGamesList, callCreateNewGame, callUpdateGameInfo } from '@src/client/gameplay';
import { ThemeToggle } from '@src/client/components/ui/themetoggle';
import { GameMenuDropdown } from '@src/client/components/gamemenudropdown';

const heroHighlights = [
  {
    title: 'Design visually, iterate instantly',
    description: 'Compose branching narratives, rich prompts, and game logic with our visual editor.',
    icon: Wand2,
  },
  {
    title: 'Launch to every device',
    description: 'Deliver playable AI experiences optimised for phones, tablets, and desktops.',
    icon: MonitorUp,
  },
  {
    title: 'Collaborate and learn together',
    description: 'Share prototypes with your team, gather analytics, and fine-tune with rapid feedback.',
    icon: Users,
  },
];

const capabilityTiles = [
  {
    title: 'Adaptive AI Storylines',
    description: 'Blend deterministic structure with dynamic AI responses for cinematic storytelling in minutes.',
    icon: Workflow,
  },
  {
    title: 'Responsible AI Guardrails',
    description: 'Govern content with automated review loops, audience policies, and moderation logging.',
    icon: ShieldCheck,
  },
  {
    title: 'Insightful Analytics',
    description: 'Understand player sentiment, drop-off moments, and branching performance with ready-to-use dashboards.',
    icon: GaugeCircle,
  },
  {
    title: 'Shared Knowledge Base',
    description: 'Learn from curated best-practices and remix templates contributed by the Play Day.AI community.',
    icon: BookOpen,
  },
]

const quickNavLinks = [
  {
    label: 'My experiences',
    description: 'Jump to the projects you are building right now.',
    href: '#my-games',
  },
  {
    label: 'Featured gallery',
    description: 'Browse standout worlds from the community.',
    href: '#featured-games',
  },
  {
    label: 'Community lab',
    description: 'Explore the latest experiments to remix.',
    href: '#community',
  },
];

function RequireAccount({ children }) {
  const { loading, account } = useContext(stateManager);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="glass-panel w-full max-w-md text-center">
          <p className="text-lg font-medium text-emphasis">Loading your workspace…</p>
          <p className="mt-2 text-sm text-muted">We are syncing your projects and preferences.</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="glass-panel w-full max-w-lg text-center">
          <h1 className="text-3xl font-semibold text-emphasis">Sign in to continue</h1>
          <p className="mt-3 text-muted">You need to be signed in to access your games. Please refresh or sign in again.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Modal({ open, onClose, title, children, footer }) {
  const modalContent = open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur">
      <div className="glass-panel relative w-full max-w-lg">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted transition-colors hover:text-emphasis"
        >
          ✕
        </button>
        {title ? <h2 className="text-2xl font-semibold text-emphasis">{title}</h2> : null}
        <div className="mt-5 space-y-4 text-muted">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  ) : null;

  if (!open) {
    return null;
  }

  return createPortal(modalContent, document.body);
}

function PrimaryButton({ children, icon: Icon, onClick, type = 'button', className, disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function SecondaryButton({ children, icon: Icon, onClick, className, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-emphasis transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
function GameCard({
  game,
  accent,
  onPlay,
  onResume,
  onOpenMenu,
  menuOpen,
  menuAnchor,
  onToggleFeatured,
  canFeature,
  moveFeatured,
  isFeatured,
  featuredOrder,
  children,
}) {
  const accentClass = accent || 'from-primary/15 via-surface to-surface';

  return (
    <article className="group relative h-full overflow-hidden rounded-3xl border border-border/70 bg-surface/90 p-6 shadow-soft transition-transform duration-300 hover:-translate-y-1 hover:shadow-glow">
      <div className={clsx('absolute inset-x-4 top-0 h-24 rounded-b-[80%] bg-gradient-to-br blur-3xl transition-opacity duration-500 group-hover:opacity-100', accentClass)} />
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="tag mb-3 bg-primary/10 text-xs font-semibold uppercase tracking-wide text-primary">{game.category ?? 'AI Experience'}</div>
              <h3 className="text-2xl font-semibold text-emphasis">{game.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm text-muted">{game.description || 'Crafted AI interactions ready to play.'}</p>
            </div>
            <button
              type="button"
              ref={menuAnchor}
              onClick={onOpenMenu}
              className="rounded-full border border-border/60 bg-surface/60 p-2 text-muted transition-colors hover:text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open actions</span>
            </button>
          </div>
          {canFeature ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1', isFeatured ? 'border-primary/50 bg-primary/10 text-primary font-medium' : 'border-border')}>
                {isFeatured ? <Star className="h-3.5 w-3.5" /> : <StarOff className="h-3.5 w-3.5" />}
                <span>{isFeatured ? 'Featured' : 'Not featured'}</span>
              </span>
              {isFeatured ? <span className="rounded-full bg-border/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">Order #{featuredOrder}</span> : null}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveFeatured && moveFeatured('up')}
                  className="rounded-full border border-border/60 bg-surface/70 p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                  disabled={!moveFeatured}
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Move featured up</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveFeatured && moveFeatured('down')}
                  className="rounded-full border border-border/60 bg-surface/70 p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                  disabled={!moveFeatured}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Move featured down</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleFeatured}
                  className="rounded-full border border-border/60 bg-surface/70 p-1 text-muted transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  {isFeatured ? <StarOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Star className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span className="sr-only">Toggle featured</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <PrimaryButton icon={Play} onClick={onPlay} className="shadow-none">
            Play now
          </PrimaryButton>
          {onResume ? (
            <SecondaryButton icon={ArrowRight} onClick={onResume}>
              Resume session
            </SecondaryButton>
          ) : null}
        </div>
      </div>
      {children}
    </article>
  );
}

function SectionHeader({ eyebrow, title, description, cta }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      {eyebrow ? <span className="tag mb-4 bg-primary/10 text-primary">{eyebrow}</span> : null}
      <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
      {description ? <p className="mt-3 text-base text-muted sm:text-lg">{description}</p> : null}
      {cta ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{cta}</div> : null}
    </div>
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
  const heroTitle = firstName ? 'Hi ' + firstName : 'Create living AI experiences';
  const heroSubtitle = firstName ? 'Jump back in and launch something unforgettable.' : 'Build, iterate, and ship immersive AI adventures in minutes.';
  const [games, setGames] = useState([]);
  const [featuredGames, setFeaturedGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [communityGames, setCommunityGames] = useState([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameUrl, setNewGameUrl] = useState('');
  const [showCommunity, setShowCommunity] = useState(false);
  const [activeMenu, setActiveMenu] = useState({});
  const menuRefs = useRef({});

  const isAdmin = accountHasRole ? accountHasRole('admin') : false;
  const isCreator = isAdmin || (accountHasRole ? accountHasRole('creator') : false);

  useEffect(() => {
    async function fetchGames() {
      const response = await callGetGamesList();
      if (!response) {
        return;
      }
      const featured = [];
      const mine = [];
      const others = [];
      response.forEach((game) => {
        if (game.featuredIndex && game.featuredIndex > 0) {
          featured.push(game);
        }
        if (account && game.creatorAccountID === account.accountID) {
          mine.push(game);
        } else {
          others.push(game);
        }
      });

      featured.sort((a, b) => (a.featuredIndex || 0) - (b.featuredIndex || 0));
      setFeaturedGames(featured);
      setMyGames(mine);
      setCommunityGames(others);
      setGames(response);
    }

    if (!loading && account) {
      fetchGames();
    }
  }, [loading, account]);
  const handleOpenMenu = (gameUrl) => (event) => {
    event.stopPropagation();
    const current = activeMenu[gameUrl];
    setActiveMenu((prev) => ({ ...prev, [gameUrl]: !current }));
    if (!menuRefs.current[gameUrl]) {
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
    const versionQuery = version && version.versionName ? '?versionName=' + encodeURIComponent(version.versionName) : '';
    const connector = versionQuery ? '&' : '?';
    router.push('/play/' + gameUrl + versionQuery + connector + 'sessionID=' + newSession.sessionID);
  };

  const handleToggleFeatured = async (game) => {
    if (!isAdmin) {
      return;
    }
    const wasFeatured = game.featuredIndex && game.featuredIndex > 0;
    let updatedFeatured = [...featuredGames];

    if (wasFeatured) {
      updatedFeatured = updatedFeatured.filter((item) => item.gameID !== game.gameID);
      await callUpdateGameInfo({ gameID: game.gameID, featuredIndex: 0 });
      let indexCounter = 1;
      for (const item of updatedFeatured) {
        item.featuredIndex = indexCounter;
        indexCounter += 1;
        await callUpdateGameInfo({ gameID: item.gameID, featuredIndex: item.featuredIndex });
      }
    } else {
      const newIndex = updatedFeatured.length + 1;
      await callUpdateGameInfo({ gameID: game.gameID, featuredIndex: newIndex });
      updatedFeatured.push({ ...game, featuredIndex: newIndex });
    }

    updatedFeatured.sort((a, b) => (a.featuredIndex || 0) - (b.featuredIndex || 0));
    setFeaturedGames(updatedFeatured);
  };

  const handleMoveFeatured = (game, direction) => async () => {
    if (!isAdmin) {
      return;
    }

    const currentIndex = featuredGames.findIndex((item) => item.gameID === game.gameID);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= featuredGames.length) {
      return;
    }

    const reordered = [...featuredGames];
    const item = reordered[currentIndex];
    reordered[currentIndex] = reordered[targetIndex];
    reordered[targetIndex] = item;

    let indexCounter = 1;
    for (const gameItem of reordered) {
      gameItem.featuredIndex = indexCounter;
      indexCounter += 1;
      await callUpdateGameInfo({ gameID: gameItem.gameID, featuredIndex: gameItem.featuredIndex });
    }

    setFeaturedGames([...reordered]);
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

  return (
    <RequireAccount>
      <main className="relative overflow-hidden pb-24">
        <div className="absolute inset-0 -z-10 bg-mesh-gradient opacity-60" aria-hidden="true" />
        <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="tag bg-primary/10 text-primary">Play Day.AI Studio</span>
              <h1 className="mt-3 text-4xl font-semibold text-emphasis sm:text-5xl">
                {heroTitle}
              </h1>
              <p className="mt-2 max-w-2xl text-base text-muted sm:text-lg">
                {heroSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isCreator ? (
                <PrimaryButton icon={Plus} onClick={() => setAddDialogOpen(true)}>
                  New experience
                </PrimaryButton>
              ) : null}
            </div>
          </header>
          <section className="mt-10 grid gap-6 lg">
            <div className="glass-panel relative overflow-hidden p-8">
              <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-tr from-primary/20 via-accent/10 to-secondary/10 blur-3xl md:block" aria-hidden="true" />
              <h2 className="text-2xl font-semibold text-emphasis sm:text-3xl">Ship faster with a unified studio</h2>
              <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
                Bring structured story beats and adaptive AI into one canvas. Launch tests in minutes, gather feedback, and iterate without losing momentum.
              </p>
              <dl className="mt-8 grid gap-4 sm:grid-cols-3">
                {heroHighlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border/70 bg-surface/80 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <dt className="mt-3 text-sm font-semibold text-emphasis">{item.title}</dt>
                    <dd className="mt-1 text-xs text-muted sm:text-sm">{item.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section id="my-games" className="mt-16">
            <SectionHeader
              eyebrow="Your studio"
              title="Continue crafting your universes"
              description="Resume the experiences you are actively designing."
              cta={isCreator ? (
                <PrimaryButton icon={Plus} onClick={() => setAddDialogOpen(true)}>
                  Create new project
                </PrimaryButton>
              ) : null}
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {myGames.length === 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <p>You have not created any games yet. Start with a fresh canvas or remix a template.</p>
                </div>
              ) : (
                myGames.map((game) => (
                  <GameCard
                    key={game.gameID}
                    game={game}
                    accent="from-secondary/20 via-surface to-surface"
                    onPlay={() => handlePlay(game.url)}
                    onResume={startNewGameSession ? () => handleResume(game.url) : null}
                    onOpenMenu={handleOpenMenu(game.url)}
                    menuOpen={!!activeMenu[game.url]}
                    menuAnchor={(node) => {
                      if (node && menuRefs.current[game.url] !== node) {
                        menuRefs.current[game.url] = node;
                      }
                    }}
                    onToggleFeatured={() => handleToggleFeatured(game)}
                    canFeature={isAdmin}
                    isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    featuredOrder={game.featuredIndex}
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
                      isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    />
                  </GameCard>
                ))
              )}
            </div>
          </section>
          <section id="featured-games" className="mt-16">
            <SectionHeader
              eyebrow="Featured"
              title="Showcase moments from the community"
              description="See the community's latest standout worlds."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredGames.length === 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <p>No featured games yet. Mark a project as featured to highlight it here.</p>
                </div>
              ) : (
                featuredGames.map((game) => (
                  <GameCard
                    key={game.gameID}
                    game={game}
                    accent="from-primary/20 via-surface to-surface"
                    onPlay={() => handlePlay(game.url)}
                    onResume={startNewGameSession ? () => handleResume(game.url) : null}
                    onOpenMenu={handleOpenMenu(game.url)}
                    menuOpen={!!activeMenu[game.url]}
                    menuAnchor={(node) => {
                      if (node && menuRefs.current[game.url] !== node) {
                        menuRefs.current[game.url] = node;
                      }
                    }}
                    onToggleFeatured={() => handleToggleFeatured(game)}
                    canFeature={isAdmin}
                    isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    featuredOrder={game.featuredIndex}
                    moveFeatured={(direction) => handleMoveFeatured(game, direction)}
                  >
                    <GameMenuDropdown
                      onMenuClose={() => closeMenu(game.url)}
                      anchor={activeMenu[game.url] ? menuRefs.current[game.url] : null}
                      gameUrl={game.url}
                      gameID={game.gameID}
                      allowEditOptions
                      includePlayOption
                      onToggleFeatured={() => handleToggleFeatured(game)}
                      isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    />
                  </GameCard>
                ))
              )}
            </div>
          </section>


          <section id="community" className="mt-20">
            <SectionHeader
              eyebrow="Community"
              title="Discover what other creators are building"
              description="Play, remix, and learn from the latest experiments shipping right now."
              cta={communityGames.length > 6 ? (
                <SecondaryButton icon={ArrowRight} onClick={() => setShowCommunity((prev) => !prev)}>
                  {showCommunity ? 'Show fewer' : 'Show more'}
                </SecondaryButton>
              ) : null}
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {communityGames.length === 0 ? (
                <div className="glass-panel p-8 text-center text-muted">
                  <p>No community projects available yet. Check back soon!</p>
                </div>
              ) : (
                (showCommunity ? communityGames : communityGames.slice(0, 6)).map((game) => (
                  <GameCard
                    key={game.gameID}
                    game={game}
                    accent="from-accent/20 via-surface to-surface"
                    onPlay={() => handlePlay(game.url)}
                    onResume={null}
                    onOpenMenu={handleOpenMenu(game.url)}
                    menuOpen={!!activeMenu[game.url]}
                    menuAnchor={(node) => {
                      if (node && menuRefs.current[game.url] !== node) {
                        menuRefs.current[game.url] = node;
                      }
                    }}
                    onToggleFeatured={() => handleToggleFeatured(game)}
                    canFeature={isAdmin}
                    isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    featuredOrder={game.featuredIndex}
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
                      isFeatured={game.featuredIndex && game.featuredIndex > 0}
                    />
                  </GameCard>
                ))
              )}
            </div>
          </section>

          <section className="mt-16">
            <SectionHeader
              eyebrow="Capabilities"
              title="Everything you need to orchestrate unforgettable AI journeys"
              description="Design, deploy, and iterate with confidence using workflows built for AI-native experiences."
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {capabilityTiles.map((tile) => (
                <div key={tile.title} className="glass-panel relative overflow-hidden p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <tile.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-emphasis">{tile.title}</h3>
                  <p className="mt-3 text-sm text-muted">{tile.description}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="mt-20">
            <div className="glass-panel flex flex-col items-center gap-6 px-8 py-12 text-center sm:flex-row sm:text-left">
              <div className="sm:w-2/3">
                <h3 className="text-2xl font-semibold text-emphasis sm:text-3xl">Bring your next AI experience to life</h3>
                <p className="mt-3 text-muted">
                  From narrative adventures to adaptive simulations, Play Day.AI gives you the systems to ship compelling AI-driven games with confidence.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <PrimaryButton icon={Sparkles} onClick={() => router.push('/play')}>
                  Start building
                </PrimaryButton>
                <SecondaryButton icon={ArrowRight} onClick={() => router.push('/static/about')}>
                  Explore resources
                </SecondaryButton>
              </div>
            </div>
          </section>

          <footer className="mt-20 grid gap-4 text-sm text-muted sm:grid-cols-2 md:grid-cols-4">
            <Link href="https://docs.google.com/document/d/1FtpERx7EtV0420Gl2h4MGUh1O9lwjccS3S4Owai5yE8" target="_blank" rel="noopener" className="transition-colors hover:text-primary">
              Getting started guide
            </Link>
            <Link href="https://discord.gg/6St8WtpZWt" target="_blank" rel="noopener" className="transition-colors hover:text-primary">
              Discord community
            </Link>
            <Link href="/static/privacy" className="transition-colors hover:text-primary">
              Privacy policy
            </Link>
            <Link href="/static/terms" className="transition-colors hover:text-primary">
              Terms of use
            </Link>
            <Link href="/static/about" className="transition-colors hover:text-primary">
              About Play Day.AI
            </Link>
            <Link href="https://github.com/tomlangan/GameGPT" className="transition-colors hover:text-primary">
              GitHub
            </Link>
            <p className="sm:col-span-2 md:col-span-4">© {new Date().getFullYear()} Play Day.AI. Crafted for modern storytellers.</p>
          </footer>
        </div>

        <Modal
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          title="Create a new project"
          footer={[
            <SecondaryButton key="cancel" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </SecondaryButton>,
            <PrimaryButton key="create" onClick={handleCreateGame} disabled={!canAddGame()}>
              Create project
            </PrimaryButton>,
          ]}
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="new-game-title" className="block text-sm font-medium text-emphasis">
                Project title
              </label>
              <input
                id="new-game-title"
                value={newGameTitle}
                onChange={(event) => setNewGameTitle(event.target.value)}
                placeholder="e.g. Neon City Heist"
                className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="new-game-url" className="block text-sm font-medium text-emphasis">
                Project URL slug
              </label>
              <input
                id="new-game-url"
                value={newGameUrl}
                onChange={(event) => setNewGameUrl(event.target.value)}
                placeholder="my-neon-heist"
                className="mt-2 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
              />
              <p className="mt-2 text-xs text-muted">Letters, numbers, dashes, and underscores only.</p>
            </div>
          </div>
        </Modal>
      </main>
    </RequireAccount>
  );
}
