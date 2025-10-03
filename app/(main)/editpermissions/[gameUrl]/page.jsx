'use client';

import React, { memo } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { defaultAppTheme } from '@src/common/theme';
import { stateManager } from '@src/client/statemanager';
import GameMenu from '@src/client/components/gamemenu';
import { AddAndEditGameUsers } from '@src/client/components/addandeditgameusers';
import { Loader2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { StatusPanel } from '@src/client/components/ui/statuspanel';

function Home() {
  const { loading, account, game, gamePermissions } = React.useContext(stateManager);

  const title = !game ? 'Loading permissions' : `${game.title} permissions`;
  const isLoading = loading || !game || !account || !gamePermissions;
  const unauthorized = !isLoading && !gamePermissions?.includes('game_modifyPermissions');

  return (
    <RequireAuthentication>
      <DefaultLayout title={title} theme={defaultAppTheme}>
        <StandardContentArea className="bg-transparent px-0">
          <div className="relative w-full max-w-4xl">
            {game ? <GameMenu theme={defaultAppTheme} allowEditOptions placement="floating" /> : null}

            <div className="space-y-8 pt-4">
              <header className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col gap-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Users className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="space-y-3">
                      <p className="text-sm uppercase tracking-[0.35em] text-muted">Permissions</p>
                      <h1 className="text-2xl font-semibold text-emphasis">
                        Manage who can collaborate on this experience
                      </h1>
                      <p className="text-sm text-muted">
                        Assign editor access, invite new teammates, and keep ownership aligned with your workflow. All
                        changes apply instantly.
                      </p>
                    </div>
                  </div>
                </div>
              </header>

              {isLoading ? (
                <StatusPanel
                  icon={Loader2}
                  iconClassName="animate-spin"
                  title="Checking permissions"
                  description="We are syncing your account details and access list. This only takes a moment."
                  tone="neutral"
                />
              ) : unauthorized ? (
                <StatusPanel
                  icon={ShieldAlert}
                  title="You don't have access to edit permissions"
                  description="Only owners or collaborators with the permissions admin role can update access. Ask the account owner to grant you access if you believe this is an error."
                  tone="warning"
                />
              ) : (
                <div className="glass-panel rounded-3xl border border-border/60 bg-surface/95 p-8 shadow-2xl backdrop-blur-xl">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-semibold text-emphasis">Collaborators</h2>
                      <p className="mt-2 text-sm text-muted">
                        Invite teammates by email or adjust roles for existing collaborators. Changes are saved automatically.
                      </p>
                    </div>
                    <AddAndEditGameUsers gameID={game?.gameID} />
                    <StatusPanel
                      icon={ShieldCheck}
                      title="Tip: keep your app secure"
                      description="Remove access for anyone who no longer needs it. Updates take effect immediately for all sessions."
                      tone="success"
                      className="border-dashed"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}

export default memo(Home);
