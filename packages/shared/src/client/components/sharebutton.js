"use client";

import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useConfig } from '@src/client/configprovider';
import { callGetGamePermissionsForEditing } from '@src/client/permissions';
import { PermissionsEditor } from '@src/client/components/permissionseditor';

function ShareDialog({ open, title, onClose, children }) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur">
      <div className="relative w-full max-w-3xl rounded-3xl border border-border/70 bg-surface p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted hover:border-primary hover:text-primary"
        >
          Close
        </button>
        <div className="pr-16">
          <h2 className="text-2xl font-semibold text-emphasis">{title}</h2>
          <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export const ShareButton = ({ gameID, onClose }) => {
  const { Constants } = useConfig();
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState(null);
  const [sharingStatus, setSharingStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchPermissions() {
      try {
        setLoading(true);
        const newPermissions = await callGetGamePermissionsForEditing(gameID);
        if (newPermissions) {
          setPermissions(newPermissions);
          updateSharingStatus(newPermissions);
        }
      } catch (error) {
        console.error('Failed to load sharing settings', error);
      } finally {
        setLoading(false);
      }
    }

    if (gameID) {
      fetchPermissions();
    }
  }, [gameID]);

  const countAccountsWithRole = (accountPermissions, role) => {
    if (!accountPermissions) {
      return 0;
    }
    return Object.values(accountPermissions).reduce((count, entry) => {
      if (entry.roles?.includes(role)) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  const getGroupSharingString = (roles, postfix) => {
    if (!roles || roles.length === 0) {
      return 'Individuals only';
    }
    for (let i = Constants.userRoles.length - 1; i >= 0; i -= 1) {
      const role = Constants.userRoles[i];
      if (roles.includes(role)) {
        return Constants.userRoleDisplayNames[role] + postfix;
      }
    }
    return 'Individuals only';
  };

  const updateSharingStatus = (newPermissions) => {
    if (!newPermissions) {
      return;
    }
    const editorCount = countAccountsWithRole(newPermissions.accounts, 'game_owner') + countAccountsWithRole(newPermissions.accounts, 'game_editor');
    const sourceCount = editorCount + countAccountsWithRole(newPermissions.accounts, 'game_sourceViewer');
    const playerCount = sourceCount + countAccountsWithRole(newPermissions.accounts, 'game_player');

    const status = {
      edit: newPermissions.groups?.roles?.game_editor && newPermissions.groups.roles.game_editor.length > 0
        ? getGroupSharingString(newPermissions.groups.roles.game_editor, ' can edit')
        : editorCount + ' editors',
      view: newPermissions.groups?.roles?.game_sourceViewer && newPermissions.groups.roles.game_sourceViewer.length > 0
        ? getGroupSharingString(newPermissions.groups.roles.game_sourceViewer, ' can view source')
        : sourceCount + ' can view source',
      play: newPermissions.groups?.roles?.game_player && newPermissions.groups.roles.game_player.length > 0
        ? getGroupSharingString(newPermissions.groups.roles.game_player, ' can play')
        : playerCount + ' can play',
    };

    setSharingStatus(status);
  };

  const handlePermissionsChange = (nextPermissions) => {
    setPermissions(nextPermissions);
    updateSharingStatus(nextPermissions);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <div className="text-sm text-muted">
      <div className="rounded-2xl border border-border/70 bg-surface/80 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold text-emphasis">Sharing summary</span>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emphasis transition-colors hover:border-primary hover:text-primary"
          >
            Manage access
          </button>
        </div>
        {loading ? (
          <p className="mt-4 text-xs text-muted">Loading collaborators…</p>
        ) : sharingStatus ? (
          <dl className="mt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Editors</dt>
              <dd className="font-medium text-emphasis">{sharingStatus.edit}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Source viewers</dt>
              <dd className="font-medium text-emphasis">{sharingStatus.view}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Players</dt>
              <dd className="font-medium text-emphasis">{sharingStatus.play}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-xs text-muted">No collaborators yet.</p>
        )}
      </div>

      <ShareDialog open={open} title="Manage collaborators" onClose={handleClose}>
        {permissions ? (
          <PermissionsEditor
            gameID={gameID}
            startingPermissions={permissions}
            onPermissionsChange={handlePermissionsChange}
          />
        ) : (
          <p className="text-sm text-muted">Loading permissions…</p>
        )}
      </ShareDialog>
    </div>
  );
};
