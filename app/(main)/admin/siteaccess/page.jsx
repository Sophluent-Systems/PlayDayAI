'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { stateManager } from '@src/client/statemanager';
import { useConfig } from '@src/client/configprovider';
import { callGetSiteRoleAccess, callSetCoarseSiteRoleAccess } from '@src/client/permissions';
import { GlassCard } from '@src/client/components/ui/card';
import { PrimaryButton, SecondaryButton } from '@src/client/components/ui/button';
import { StatusPanel } from '@src/client/components/ui/statuspanel';
import { Toast } from '@src/client/components/ui/feedback';
import { Modal } from '@src/client/components/ui/modal';
import { Shield, Lock, Users2, Globe, Loader2 } from 'lucide-react';

const ACCESS_OPTIONS = [
  {
    value: 'invite-only',
    label: 'Invite only',
    description: "Only invited users can view or create within the workspace.",
    icon: Lock,
    tone: 'warning',
  },
  {
    value: 'invite-apps',
    label: 'Open to view',
    description: 'Anyone can explore experiences, but app creation requires an invite.',
    icon: Users2,
    tone: 'neutral',
  },
  {
    value: 'open',
    label: 'Fully open',
    description: 'The workspace is discoverable. Anyone can view and create content.',
    icon: Globe,
    tone: 'success',
  },
];

export default function Home() {
  const router = useRouter();
  const { Constants } = useConfig();
  const { loading, account, accountHasRole } = React.useContext(stateManager);

  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [accessControl, setAccessControl] = useState('invite-apps');
  const [pendingChoice, setPendingChoice] = useState(null);
  const [hoveredOption, setHoveredOption] = useState(null);
  const [toast, setToast] = useState({ open: false, tone: 'info', message: '' });

  useEffect(() => {
    if (!loading && account && !accountHasRole('admin')) {
      router.replace('/');
    }
  }, [loading, account, accountHasRole, router]);

  useEffect(() => {
    const populateCurrentPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const siteAccess = await callGetSiteRoleAccess();
        if (siteAccess.guest?.includes('service_editMode')) {
          setAccessControl('open');
        } else if (siteAccess.guest?.includes('service_basicAccess')) {
          setAccessControl('invite-apps');
        } else {
          setAccessControl('invite-only');
        }
      } catch (error) {
        console.error('Failed to load site roles', error);
        setToast({ open: true, tone: 'error', message: 'Unable to load site permissions.' });
      } finally {
        setLoadingPermissions(false);
      }
    };

    populateCurrentPermissions();
  }, []);

  const handleAccessControlChange = (value) => {
    if (value === accessControl) {
      return;
    }
    setPendingChoice(value);
  };

  const confirmAccessControlChange = async () => {
    if (!pendingChoice) {
      return;
    }
    try {
      await callSetCoarseSiteRoleAccess(pendingChoice);
      setAccessControl(pendingChoice);
      setToast({ open: true, tone: 'success', message: 'Workspace access updated.' });
    } catch (error) {
      console.error('Failed to update site access', error);
      setToast({ open: true, tone: 'error', message: 'Could not update site access. Try again.' });
    } finally {
      setPendingChoice(null);
    }
  };

  const activeOption = ACCESS_OPTIONS.find((option) => option.value === (hoveredOption ?? accessControl));

  return (
    <RequireAuthentication>
      <DefaultLayout title="Site Access Control (ADMIN)">
        <StandardContentArea className="bg-transparent px-0">
          <div className="space-y-8">
            <GlassCard>
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Shield className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-3">
                    <p className="text-sm uppercase tracking-[0.35em] text-muted">Governance</p>
                    <h1 className="text-2xl font-semibold text-emphasis">Control who can access PlayDay</h1>
                    <p className="text-sm text-muted">
                      Configure the visibility of your workspace and who can prototype new ideas. Changes take effect immediately.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>

            {loadingPermissions ? (
              <StatusPanel
                icon={Loader2}
                iconClassName="animate-spin"
                title="Loading current policy"
                description="We are fetching the existing access configuration."
              />
            ) : (
              <GlassCard>
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-emphasis">Choose your access level</h2>
                    <p className="mt-2 text-sm text-muted">
                      Select the mode that matches how open you want PlayDay to be inside your organization.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {ACCESS_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                      const isSelected = accessControl === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleAccessControlChange(value)}
                          onMouseEnter={() => setHoveredOption(value)}
                          onMouseLeave={() => setHoveredOption(null)}
                          className={`group relative flex h-full flex-col gap-4 rounded-3xl border px-6 py-8 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                            isSelected
                              ? 'border-primary/60 bg-primary/10 shadow-[0_25px_55px_-35px_rgba(99,102,241,0.55)]'
                              : 'border-border/60 bg-surface/80 hover:border-primary/40 hover:bg-primary/5'
                          }`}
                        >
                          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
                            isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                          }`}>
                            <Icon className="h-6 w-6" aria-hidden="true" />
                          </span>
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-emphasis">{label}</p>
                            <p className="text-sm text-muted">{description}</p>
                          </div>
                          {isSelected ? (
                            <span className="absolute right-6 top-6 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                              Active
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <StatusPanel
                    icon={activeOption?.icon}
                    title={activeOption?.label ?? ''}
                    description={activeOption?.description ?? ''}
                    tone={activeOption?.tone ?? 'neutral'}
                    className="border-dashed"
                  />

                  <div className="flex justify-end">
                    <SecondaryButton disabled>Changes save automatically</SecondaryButton>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </StandardContentArea>

        <Modal
          open={Boolean(pendingChoice)}
          onClose={() => setPendingChoice(null)}
          title="Update site access?"
          description="This change updates visibility for everyone instantly."
          footer={[
            <SecondaryButton key="cancel" onClick={() => setPendingChoice(null)}>
              Cancel
            </SecondaryButton>,
            <PrimaryButton key="confirm" onClick={confirmAccessControlChange}>
              Confirm
            </PrimaryButton>,
          ]}
        >
          <p className="text-sm text-muted">
            {ACCESS_OPTIONS.find((option) => option.value === pendingChoice)?.description}
          </p>
        </Modal>

        <Toast open={toast.open} tone={toast.tone} message={toast.message} onClose={() => setToast((prev) => ({ ...prev, open: false }))} />
      </DefaultLayout>
    </RequireAuthentication>
  );
}

