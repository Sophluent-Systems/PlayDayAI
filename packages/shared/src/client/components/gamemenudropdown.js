"use client";

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  BookmarkMinus,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Eye,
  Layers,
  Palette,
  Play,
  Share2,
  Wrench,
  GraduationCap,
} from 'lucide-react';
import { stateManager } from '@src/client/statemanager';
import { callGetAccountPermissionsForGame } from '@src/client/permissions';
import { callListGameVersions } from '@src/client/editor';
import { ShareButton } from '@src/client/components/sharebutton';
const MENU_WIDTH = 280;

function MenuPanel({ anchorRect, isOpen, children, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (!isOpen) {
        return;
      }
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }

    function handleKey(event) {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anchorRect) {
    return null;
  }

  const top = anchorRect.bottom + 12;
  const left = Math.max(16, anchorRect.left + anchorRect.width - MENU_WIDTH);

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[280px] rounded-3xl border border-border/70 bg-surface shadow-2xl shadow-black/20"
      style={{ top, left }}
    >
      {children}
    </div>
  );
}

function MenuItem({ icon: Icon, label, description, onClick, disabled, trailing, isActive }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-primary/10',
        isActive ? 'bg-primary/10 text-primary' : 'text-emphasis'
      )}
    >
      <span className={clsx('mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border', isActive ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-surface/80 text-muted')}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
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
    gamePermissions,
    switchVersionByName,
    navigateTo,
    editMode,
    hasServicePerms,
  } = useContext(stateManager);
  const [gamePermissionsToUse, setGamePermissionsToUse] = useState(null);
  const [versions, setVersions] = useState([]);
  const [anchorRect, setAnchorRect] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const isAdmin = hasServicePerms ? hasServicePerms('service_modifyGlobalPermissions') : false;
  const menuOpen = Boolean(anchor);

  useEffect(() => {
    if (!menuOpen) {
      setShowVersions(false);
    }
  }, [menuOpen]);

  const updateAnchorRect = React.useCallback(() => {
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
    async function loadPermissions() {
      if (!account || !gameUrl) {
        return;
      }
      if (gameUrl === game?.url) {
        setGamePermissionsToUse(gamePermissions);
        return;
      }
      try {
        const permissions = await callGetAccountPermissionsForGame(account.accountID, null, gameUrl);
        setGamePermissionsToUse(permissions);
      } catch (error) {
        console.error('Failed to load game permissions', error);
      }
    }

    if (!loading && account && menuOpen) {
      loadPermissions();
    }
  }, [loading, account, gameUrl, game, gamePermissions, menuOpen]);

  useEffect(() => {
    async function loadVersions() {
      if (!allowEditOptions || !editMode) {
        return;
      }
      if (!gamePermissionsToUse) {
        return;
      }
      const canView = gamePermissionsToUse.includes('game_viewSource') || gamePermissionsToUse.includes('game_edit');
      if (!canView) {
        return;
      }
      try {
        const list = await callListGameVersions(null, gameUrl, false);
        if (list) {
          setVersions(list);
        }
      } catch (error) {
        console.error('Failed to load versions for game menu', error);
      }
    }

    if (menuOpen) {
      loadVersions();
    }
  }, [menuOpen, allowEditOptions, editMode, gamePermissionsToUse, gameUrl]);

  const handleNavigation = (relativePath) => {
    const switchingGames = gameUrl !== game?.url;
    navigateTo(relativePath, gameUrl, switchingGames);
    onMenuClose?.();
  };

  const handleSetVersion = (newVersionName, sourceGameID) => {
    const switchingGames = gameUrl !== game?.url;
    if (switchingGames) {
      handleNavigation('/play');
    }
    switchVersionByName(newVersionName, sourceGameID || gameID);
    setShowVersions(false);
    onMenuClose?.();
  };

  const actions = useMemo(() => {
    if (!menuOpen || !gamePermissionsToUse) {
      return [];
    }

    const items = [];

    if (includePlayOption && gamePermissionsToUse.includes('game_play')) {
      items.push({
        key: 'play',
        label: 'Play now',
        description: 'Open the live experience in a new tab.',
        icon: Play,
        onSelect: () => handleNavigation('/play'),
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
        description: isFeatured ? 'Hide this project from the homepage spotlight.' : 'Highlight this project for all creators.',
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
  }, [menuOpen, gamePermissionsToUse, includePlayOption, allowEditOptions, editMode, versions.length, versionList, isAdmin, isFeatured, onToggleFeatured, gameID, customMenuItems, handleNavigation]);

  useEffect(() => {
    if (actions && onMenuUpdated) {
      onMenuUpdated(actions);
    }
  }, [actions, onMenuUpdated]);

  const shareAvailable = allowEditOptions && editMode && gamePermissionsToUse && gamePermissionsToUse.includes('game_modifyPermissions');

  return (
    <MenuPanel anchorRect={anchorRect} isOpen={menuOpen} onClose={() => onMenuClose?.()}>
      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Project actions</span>
          <button
            type="button"
            onClick={() => onMenuClose?.()}
            className="rounded-full bg-surface/80 px-2 py-1 text-xs text-muted transition-colors hover:text-emphasis"
          >
            Close
          </button>
        </div>
        <div className="space-y-1">
          {actions.map((action) => {
            if (action.render) {
              return <div key={action.key}>{action.render}</div>;
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
                  />
                  {isExpanded ? (
                    <div className="mt-1 space-y-1 rounded-2xl bg-surface/70 p-2">
                      {(versions.length > 0 ? versions : versionList || []).map((versionItem) => (
                        <button
                          key={versionItem.versionName}
                          type="button"
                          onClick={() => handleSetVersion(versionItem.versionName, versionItem.gameID)}
                          className="w-full rounded-xl px-3 py-2 text-left text-sm text-emphasis transition-colors hover:bg-primary/10"
                        >
                          {versionItem.versionName}
                        </button>
                      ))}
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
              />
            );
          })}
        </div>
        {shareAvailable ? (
          <div className="mt-4 rounded-2xl border border-border/70 bg-surface/80 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emphasis">
              <Share2 className="h-4 w-4 text-primary" />
              <span>Collaboration</span>
            </div>
            <ShareButton gameID={gameID} onClose={() => onMenuClose?.()} />
          </div>
        ) : null}
      </div>
    </MenuPanel>
  );
}
