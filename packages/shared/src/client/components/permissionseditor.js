"use client";

import { useContext, useEffect, useMemo, useState } from 'react';
import { Crown, MailPlus, Play, ShieldCheck, Trash2, Layers } from 'lucide-react';
import { useConfig } from '@src/client/configprovider';
import { stateManager } from '@src/client/statemanager';
import { callLookupAccount } from '@src/client/account';
import { callSetGameRolesForAccount, callSetGameSharingSettings } from '@src/client/permissions';

const permissionOptions = {
  game_player: {
    label: 'App user',
    description: 'Can play the experience only.',
  },
  game_sourceViewer: {
    label: 'Source viewer',
    description: 'Can review the graph and prompt settings.',
  },
  game_editor: {
    label: 'Editor',
    description: 'Can edit content, prompts, and settings.',
  },
  game_owner: {
    label: 'Owner',
    description: 'Full control including deletion.',
  },
};

const ACCESS_HIERARCHY = {
  admin: ['admin'],
  creator: ['admin', 'creator'],
  consumer: ['admin', 'creator', 'consumer'],
  guest: ['admin', 'creator', 'consumer', 'guest'],
};

const roleCards = [
  {
    key: 'game_editor',
    title: 'Editors',
    description: 'Maintain the project and adjust gameplay.',
    accent: 'from-primary/20 via-transparent to-transparent',
    icon: ShieldCheck,
  },
  {
    key: 'game_sourceViewer',
    title: 'Source viewers',
    description: 'Review the branching graph and prompt configuration.',
    accent: 'from-secondary/20 via-transparent to-transparent',
    icon: Layers,
  },
  {
    key: 'game_player',
    title: 'App users',
    description: 'Play published versions of the experience.',
    accent: 'from-accent/20 via-transparent to-transparent',
    icon: Play,
  },
];

const roleBadges = {
  game_player: 'bg-primary/10 text-primary',
  game_sourceViewer: 'bg-secondary/10 text-secondary',
  game_editor: 'bg-accent/10 text-accent',
  game_owner: 'bg-emphasis/10 text-emphasis',
};

const rolePriority = {
  game_player: 0,
  game_sourceViewer: 1,
  game_editor: 2,
  game_owner: 3,
};

function leastRestrictive(groupOrArray) {
  if (!groupOrArray) {
    return 'individuals';
  }
  if (!Array.isArray(groupOrArray)) {
    return groupOrArray;
  }
  if (groupOrArray.length === 0) {
    return 'individuals';
  }
  if (groupOrArray.includes('guest')) {
    return 'guest';
  }
  if (groupOrArray.includes('consumer')) {
    return 'consumer';
  }
  if (groupOrArray.includes('creator')) {
    return 'creator';
  }
  if (groupOrArray.includes('admin')) {
    return 'admin';
  }
  return 'individuals';
}

function isMoreRestrictive(existingGroup, newGroup) {
  const ordering = ['admin', 'creator', 'consumer', 'guest', 'individuals'];
  const existing = ordering.indexOf(leastRestrictive(existingGroup));
  const proposed = ordering.indexOf(Array.isArray(newGroup) ? leastRestrictive(newGroup) : newGroup);
  if (existing === -1) {
    return false;
  }
  if (proposed === -1) {
    return false;
  }
  return proposed > existing;
}

export const PermissionsEditor = ({ gameID, startingPermissions, onPermissionsChange }) => {
  const { Constants } = useConfig();
  const { account } = useContext(stateManager);
  const [permissions, setPermissions] = useState(startingPermissions);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPermissions(startingPermissions);
  }, [startingPermissions]);

  const accounts = permissions?.accounts || {};
  const groups = permissions?.groups?.roles || {};

  const groupOptions = useMemo(() => {
    const defaults = [
      { value: 'individuals', label: 'Individuals only' },
      { value: 'guest', label: 'Guest' },
      { value: 'consumer', label: 'Consumer' },
      { value: 'creator', label: 'Creator' },
    ];
    if (!Constants?.userRoleDisplayNames) {
      return defaults;
    }
    return [
      { value: 'individuals', label: 'Individuals only' },
      ...Object.keys(Constants.userRoleDisplayNames)
        .filter((role) => role !== 'admin')
        .map((role) => ({ value: role, label: Constants.userRoleDisplayNames[role] })),
    ];
  }, [Constants]);

  const updatePermissionsState = (nextPermissions) => {
    setPermissions(nextPermissions);
    onPermissionsChange(nextPermissions);
  };

  const clonePermissions = () => ({
    accounts: { ...(permissions?.accounts || {}) },
    groups: { roles: { ...(permissions?.groups?.roles || {}) } },
  });

  const applyGroupCascade = async (option, newGroupValue) => {
    const next = clonePermissions();
    if (!next.groups.roles) {
      next.groups.roles = {};
    }

    if (newGroupValue === 'individuals') {
      next.groups.roles[option] = [];
      if (option === 'game_player') {
        next.groups.roles.game_sourceViewer = [];
        next.groups.roles.game_editor = [];
      } else if (option === 'game_sourceViewer') {
        next.groups.roles.game_editor = [];
      }
    } else {
      const applied = ACCESS_HIERARCHY[newGroupValue] || [];
      next.groups.roles[option] = applied;

      if (option === 'game_editor') {
        const sourceViewerGroup = next.groups.roles.game_sourceViewer?.[0];
        const playerGroup = next.groups.roles.game_player?.[0];
        if (!sourceViewerGroup || !isMoreRestrictive(sourceViewerGroup, applied)) {
          next.groups.roles.game_sourceViewer = applied;
        }
        if (!playerGroup || !isMoreRestrictive(playerGroup, applied)) {
          next.groups.roles.game_player = applied;
        }
      } else if (option === 'game_sourceViewer') {
        const editorGroup = next.groups.roles.game_editor?.[0];
        if (editorGroup && isMoreRestrictive(editorGroup, newGroupValue)) {
          next.groups.roles.game_editor = applied;
        }
        const playerGroup = next.groups.roles.game_player?.[0];
        if (!playerGroup || !isMoreRestrictive(playerGroup, applied)) {
          next.groups.roles.game_player = applied;
        }
      } else if (option === 'game_player') {
        const sourceViewerGroup = next.groups.roles.game_sourceViewer?.[0];
        const editorGroup = next.groups.roles.game_editor?.[0];
        if (sourceViewerGroup && isMoreRestrictive(sourceViewerGroup, newGroupValue)) {
          next.groups.roles.game_sourceViewer = applied;
        }
        if (editorGroup && isMoreRestrictive(editorGroup, newGroupValue)) {
          next.groups.roles.game_editor = applied;
        }
      }
    }

    await callSetGameSharingSettings(gameID, next.groups);
    updatePermissionsState(next);
  };

  const handleAddEmail = async () => {
    setError(null);
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setError('Enter an email address to invite.');
      return;
    }

    const existing = Object.values(accounts).some((entry) => (entry.email || '').toLowerCase() === email);
    if (existing) {
      setError('This account already has access.');
      return;
    }

    setSaving(true);
    try {
      const accountInfo = await callLookupAccount(email);
      if (!accountInfo) {
        setError('No Play Day.AI account found for that email yet.');
        setSaving(false);
        return;
      }
      const defaultRole = 'game_player';
      await callSetGameRolesForAccount(accountInfo.accountID, gameID, [defaultRole], []);
      const next = clonePermissions();
      next.accounts[accountInfo.accountID] = {
        roles: [defaultRole],
        email,
      };
      updatePermissionsState(next);
      setNewEmail('');
    } catch (err) {
      console.error('Failed to add collaborator', err);
      setError('Unable to add this collaborator right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeAccountRole = async (accountID, newRole) => {
    const next = clonePermissions();
    const previousRole = next.accounts[accountID]?.roles?.[0];
    if (!previousRole || previousRole === newRole) {
      return;
    }
    try {
      await callSetGameRolesForAccount(accountID, gameID, [newRole], [previousRole]);
      next.accounts[accountID].roles = [newRole];
      updatePermissionsState(next);
    } catch (err) {
      console.error('Failed to update role', err);
      setError('Could not update this collaborator.');
    }
  };

  const handleRemoveAccount = async (accountID) => {
    const previousRole = accounts[accountID]?.roles?.[0];
    try {
      await callSetGameRolesForAccount(accountID, gameID, [], previousRole ? [previousRole] : []);
      const next = clonePermissions();
      delete next.accounts[accountID];
      updatePermissionsState(next);
    } catch (err) {
      console.error('Failed to remove collaborator', err);
      setError('Unable to remove this collaborator.');
    }
  };

  const countIndividualsForRole = (roleKey) => {
    return Object.values(accounts).reduce((count, entry) => {
      const roles = entry.roles || [];
      const highest = Math.max(...roles.map((role) => rolePriority[role] ?? -1), -1);
      return highest >= (rolePriority[roleKey] ?? 0) ? count + 1 : count;
    }, 0);
  };

  const overviewStats = roleCards.map((card) => ({
    ...card,
    groupValue: leastRestrictive(groups[card.key] || []),
    individualCount: countIndividualsForRole(card.key),
  }));

  const accountRows = useMemo(() => {
    return Object.entries(accounts).map(([accountID, data]) => ({
      accountID,
      email: data.email || 'unknown',
      role: data.roles?.[0] || 'game_player',
    }));
  }, [accounts]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {overviewStats.map((card) => (
          <div key={card.key} className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-6 shadow-soft">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-emphasis">{card.title}</div>
                <p className="mt-2 text-xs text-muted">{card.description}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                <card.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <div className="relative mt-5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted">Group access</label>
              <select
                value={card.groupValue}
                onChange={(event) => applyGroupCascade(card.key, event.target.value)}
                className="mt-2 w-full rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-emphasis focus:border-primary focus:outline-none"
              >
                {groupOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>
                  {card.groupValue === 'individuals'
                    ? 'Specific people only'
                    : 'Shared with ' + card.groupValue + ' role'}
                </span>
                <span>{card.individualCount} individuals</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-border/60 bg-surface p-6 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-emphasis">People with access</h3>
            <p className="text-sm text-muted">Assign granular roles to teammates and playtesters.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Crown className="h-4 w-4 text-primary" />
            <span>Your role: {permissionOptions[accounts[account?.accountID]?.roles?.[0] || 'game_player']?.label || 'App user'}</span>
          </div>
        </div>

        {accountRows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border/70 p-6 text-center text-sm text-muted">
            No additional collaborators yet. Invite teammates below to share editing or play access.
          </div>
        ) : (
          <div className="mt-6 divide-y divide-border/60">
            {accountRows.map((row) => (
              <div key={row.accountID} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[180px] flex-1">
                  <p className="text-sm font-medium text-emphasis">{row.email}</p>
                  <span className={'mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ' + (roleBadges[row.role] || 'bg-border/60 text-muted')}>
                    {permissionOptions[row.role]?.label || 'Unknown'}
                  </span>
                </div>
                <select
                  value={row.role}
                  onChange={(event) => handleChangeAccountRole(row.accountID, event.target.value)}
                  disabled={account?.accountID === row.accountID}
                  className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-emphasis focus:border-primary focus:outline-none"
                >
                  {Object.entries(permissionOptions).map(([value, option]) => (
                    <option value={value} key={value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveAccount(row.accountID)}
                  disabled={account?.accountID === row.accountID}
                  className="rounded-full border border-border/70 p-2 text-muted transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Remove {row.email}</span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-surface/80 p-4">
          <label htmlFor="invite-email" className="text-sm font-medium text-emphasis">
            Invite someone new
          </label>
          <p className="mt-1 text-xs text-muted">Collaborators need a Play Day.AI account before they can be added.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="invite-email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="name@example.com"
              className="flex-1 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-emphasis focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddEmail}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MailPlus className="h-4 w-4" aria-hidden="true" />
              Invite
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
        </div>
      </div>
    </div>
  );
};
