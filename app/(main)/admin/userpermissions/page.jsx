'use client';

import React, { useState, useEffect, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { stateManager } from '@src/client/statemanager';
import { useConfig } from '@src/client/configprovider';
import {
  callSetAccountRoles,
  callgetAccountRolesAndBasicPermissions,
} from '@src/client/permissions';
import { TwoColumnSelector } from '@src/client/components/standard/twocolumnselector';
import { StatusPanel } from '@src/client/components/ui/statuspanel';
import { PrimaryButton, SecondaryButton } from '@src/client/components/ui/button';
import { Toast, InlineAlert } from '@src/client/components/ui/feedback';
import { Modal } from '@src/client/components/ui/modal';
import { Loader2, Mail, Shield, Undo2 } from 'lucide-react';

const EMAIL_DEBOUNCE_MS = 500;

function validateEmail(candidate) {
  const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return regex.test(candidate ?? '');
}

function RoleBadge({ label }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
      {label}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const { Constants } = useConfig();
  const { loading, account, accountHasRole } = useContext(stateManager);

  const [email, setEmail] = useState('');
  const [validEmail, setValidEmail] = useState(false);
  const [rolesGranted, setRolesGranted] = useState([]);
  const [rolesAvailable, setRolesAvailable] = useState([]);
  const [originalRolesGranted, setOriginalRolesGranted] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, tone: 'info', message: '' });

  useEffect(() => {
    if (!loading && account && !accountHasRole('admin')) {
      router.replace('/');
    }
  }, [loading, account, accountHasRole, router]);

  useEffect(() => {
    if (!email) {
      setValidEmail(false);
      setRolesGranted([]);
      setRolesAvailable([]);
      setOriginalRolesGranted([]);
      setHasChanges(false);
      return undefined;
    }

    const handler = window.setTimeout(() => {
      if (validateEmail(email)) {
        fetchRolesForEmail();
      } else {
        setValidEmail(false);
        setRolesGranted([]);
        setRolesAvailable([]);
        setOriginalRolesGranted([]);
        setHasChanges(false);
      }
    }, EMAIL_DEBOUNCE_MS);

    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const fetchRolesForEmail = async () => {
    setLoadingRoles(true);
    try {
      const roleData = await callgetAccountRolesAndBasicPermissions(null, email);
      const userRoles = roleData?.userRoles ?? [];
      setRolesGranted(userRoles);
      setOriginalRolesGranted(userRoles);
      setRolesAvailable(Constants.userRoles.filter((role) => !userRoles.includes(role)));
      setValidEmail(true);
      setHasChanges(false);
      setToast({ open: true, tone: 'success', message: 'Roles fetched successfully.' });
    } catch (error) {
      console.error('Error fetching roles:', error);
      setValidEmail(false);
      setRolesGranted([]);
      setRolesAvailable([]);
      setOriginalRolesGranted([]);
      setHasChanges(false);
      setToast({ open: true, tone: 'error', message: 'Failed to fetch roles. Check the address and try again.' });
    } finally {
      setLoadingRoles(false);
    }
  };

  const handleUpdateRoles = async (rolesToAdd, rolesToRemove) => {
    setRolesGranted((current) => {
      const base = new Set(current);
      if (Array.isArray(rolesToAdd)) {
        rolesToAdd.forEach((role) => base.add(role));
      }
      if (Array.isArray(rolesToRemove)) {
        rolesToRemove.forEach((role) => base.delete(role));
      }
      return Array.from(base);
    });

    setRolesAvailable((current) => {
      const base = new Set(current);
      if (Array.isArray(rolesToRemove)) {
        rolesToRemove.forEach((role) => base.add(role));
      }
      if (Array.isArray(rolesToAdd)) {
        rolesToAdd.forEach((role) => base.delete(role));
      }
      return Array.from(base);
    });

    setHasChanges(true);
    return true;
  };

  const handleSave = () => {
    const rolesToAdd = rolesGranted.filter((role) => !originalRolesGranted.includes(role));
    const rolesToRemove = originalRolesGranted.filter((role) => !rolesGranted.includes(role));

    if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
      setToast({ open: true, tone: 'info', message: 'No changes to save.' });
      return;
    }

    setConfirmDialogOpen(true);
  };

  const handleReset = () => {
    setRolesGranted(originalRolesGranted);
    setRolesAvailable(Constants.userRoles.filter((role) => !originalRolesGranted.includes(role)));
    setHasChanges(false);
  };

  const confirmRoleUpdate = async () => {
    const rolesToAdd = rolesGranted.filter((role) => !originalRolesGranted.includes(role));
    const rolesToRemove = originalRolesGranted.filter((role) => !rolesGranted.includes(role));

    setConfirmDialogOpen(false);
    setLoadingRoles(true);

    try {
      const roleData = await callSetAccountRoles(null, email, rolesToAdd, rolesToRemove);
      const updatedRoles = roleData?.userRoles ?? [];
      setRolesGranted(updatedRoles);
      setOriginalRolesGranted(updatedRoles);
      setRolesAvailable(Constants.userRoles.filter((role) => !updatedRoles.includes(role)));
      setHasChanges(false);
      setToast({ open: true, tone: 'success', message: "Roles updated successfully." });
    } catch (error) {
      console.error('Error updating roles:', error);
      setToast({ open: true, tone: 'error', message: 'Failed to update roles. Please try again.' });
    } finally {
      setLoadingRoles(false);
    }
  };

  const cancelRoleUpdate = () => {
    setConfirmDialogOpen(false);
  };

  const closeToast = () => {
    setToast((current) => ({ ...current, open: false }));
  };

  const rolesToAdd = rolesGranted.filter((role) => !originalRolesGranted.includes(role));
  const rolesToRemove = originalRolesGranted.filter((role) => !rolesGranted.includes(role));
  const emailIsMalformed = email.length > 0 && !validateEmail(email);

  return (
    <RequireAuthentication>
      <DefaultLayout title="User Permissions (ADMIN)">
        <StandardContentArea className="bg-transparent px-0">
          <div className="space-y-8">
            <header className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-3">
                    <p className="text-sm uppercase tracking-[0.35em] text-muted">Admin controls</p>
                    <h1 className="text-2xl font-semibold text-emphasis">Manage workspace roles</h1>
                    <p className="text-sm text-muted">
                      Look up any team member, adjust their global permissions, and keep access aligned with your governance
                      policies.
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-xl backdrop-blur-xl">
              <div className="space-y-5">
                <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
                  <span>Account email</span>
                  <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface px-4 py-3 focus-within:border-primary/60">
                    <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value.trim())}
                      placeholder="user@company.com"
                      className="flex-1 bg-transparent text-sm text-emphasis placeholder:text-muted focus:outline-none"
                      autoComplete="off"
                    />
                  </div>
                </label>

                <p className="text-xs text-muted">
                  Enter a valid email address to load the roles currently assigned to that account.
                </p>

                {emailIsMalformed ? (
                  <InlineAlert
                    tone="warning"
                    title="Email address looks incomplete"
                    description="Double-check the spelling and ensure it includes a domain before continuing."
                  />
                ) : null}
              </div>
            </div>

            {loadingRoles ? (
              <StatusPanel
                icon={Loader2}
                iconClassName="animate-spin"
                title="Syncing account roles"
                description="We are fetching the latest permissions for this user. Hang tight."
                tone="neutral"
              />
            ) : null}

            {validEmail && !loadingRoles ? (
              <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-xl backdrop-blur-xl">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-emphasis">Global roles</h2>
                    <p className="text-sm text-muted">
                      Move roles between the columns to grant or revoke access. Changes are staged until you save.
                    </p>
                  </div>

                  <TwoColumnSelector
                    columnAlabel="Roles granted"
                    columnAdata={rolesGranted}
                    columnBlabel="Roles available"
                    columnBdata={rolesAvailable}
                    onAsynchronouslyMoveItems={handleUpdateRoles}
                  />

                  <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-surface/80 p-4 text-sm text-muted">
                    <p className="font-medium text-emphasis">Review before saving</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted">Add</span>
                      {rolesToAdd.length > 0 ? rolesToAdd.map((role) => <RoleBadge key={`add-${role}`} label={role} />) : (
                        <span className="rounded-full bg-border/30 px-3 py-1 text-xs text-muted">None</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs uppercase tracking-[0.25em] text-muted">Remove</span>
                      {rolesToRemove.length > 0 ? (
                        rolesToRemove.map((role) => <RoleBadge key={`remove-${role}`} label={role} />)
                      ) : (
                        <span className="rounded-full bg-border/30 px-3 py-1 text-xs text-muted">None</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <SecondaryButton
                      icon={Undo2}
                      onClick={handleReset}
                      disabled={!hasChanges}
                    >
                      Reset
                    </SecondaryButton>
                    <PrimaryButton onClick={handleSave} disabled={!hasChanges}>
                      Save changes
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </StandardContentArea>

        <Modal
          open={confirmDialogOpen}
          onClose={cancelRoleUpdate}
          title="Confirm role update"
          description="Review the staged changes. Saved updates apply instantly."
          footer={[
            <SecondaryButton key="cancel" onClick={cancelRoleUpdate}>
              Cancel
            </SecondaryButton>,
            <PrimaryButton key="confirm" onClick={confirmRoleUpdate}>
              Confirm changes
            </PrimaryButton>,
          ]}
        >
          <div className="space-y-5 text-sm text-muted">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Roles to add</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rolesToAdd.length > 0 ? (
                  rolesToAdd.map((role) => <RoleBadge key={`modal-add-${role}`} label={role} />)
                ) : (
                  <span className="text-xs text-muted">None</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Roles to remove</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {rolesToRemove.length > 0 ? (
                  rolesToRemove.map((role) => <RoleBadge key={`modal-remove-${role}`} label={role} />)
                ) : (
                  <span className="text-xs text-muted">None</span>
                )}
              </div>
            </div>
          </div>
        </Modal>

        <Toast open={toast.open} tone={toast.tone} message={toast.message} onClose={closeToast} />
      </DefaultLayout>
    </RequireAuthentication>
  );
}
