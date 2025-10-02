'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { stateManager } from '@src/client/statemanager';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { callRedeemCode } from '@src/client/codes';
import { nullUndefinedOrEmpty } from '@src/common/objects';

function RedeemKeyContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams?.get('code') ?? '';
  const { loading, account, updateSignedInAccount, navigateTo, forceAccountRefresh, hasServicePerms } = React.useContext(stateManager);
  const [codeToUse, setCodeToUse] = useState(codeParam);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);

  useEffect(() => {
    setCodeToUse(codeParam);
  }, [codeParam]);

  useEffect(() => {
    if (!loading && account) {
      if (!accountLoaded) {
        setAccountLoaded(true);
      }
      setAccessRequested(!nullUndefinedOrEmpty(account.preferences.accessRequestStatus));
    }
  }, [loading, account, accountLoaded]);

  const redeemCode = useCallback(
    async (codeToRedeem) => {
      setInProgress(true);
      const response = await callRedeemCode(codeToRedeem);

      if (response?.status === 'success') {
        alert('Code redeemed successfully!');
        await forceAccountRefresh();
        navigateTo('/');
        return;
      }

      if (response?.status === 'already_redeemed') {
        alert('This code has already been redeemed.');
        await forceAccountRefresh();
      } else if (response?.status === 'wrong_account') {
        alert('This code is not for your account.');
      } else if (response?.status === 'expired') {
        alert('This code has expired.');
      } else if (response?.status === 'not_found') {
        alert('The code was not found. Check that it was entered correctly and try again.');
      } else {
        alert('Something went wrong redeeming the code.');
      }

      setInProgress(false);
    },
    [forceAccountRefresh, navigateTo]
  );

  useEffect(() => {
    if (accountLoaded && codeParam) {
      redeemCode(codeParam);
    }
  }, [accountLoaded, codeParam, redeemCode]);

  useEffect(() => {
    if (hasServicePerms('service_basicAccess')) {
      navigateTo('/');
    }
  }, [account, hasServicePerms, navigateTo]);

  async function requestAccess() {
    if (nullUndefinedOrEmpty(account.preferences.accessRequestStatus)) {
      const newAccount = {
        ...account,
        preferences: {
          ...account.preferences,
          accessRequestStatus: 'requested',
          accessRequestDate: new Date(),
        },
      };
      updateSignedInAccount(newAccount);
    }
    setAccessRequested(true);
  }

  const renderWithFormatting = (children) => (
    <StandardContentArea>
      <InfoBubble>{children}</InfoBubble>
    </StandardContentArea>
  );

  return (
    <RequireAuthentication>
      <DefaultLayout title="Redeem a Key">
        <StandardContentArea className="bg-transparent">
          {loading || !account ? (
            renderWithFormatting(<h1 className="text-lg font-semibold text-emphasis">Loading...</h1>)
          ) : (
            <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-3xl border border-border/60 bg-surface/80 p-8 shadow-soft">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-semibold text-emphasis">Unlock editor access</h2>
                <p className="text-sm text-muted">
                  Paste the access code shared with you. We’ll add the new permissions instantly once it’s validated.
                </p>
              </div>

              <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
                <span>Access code</span>
                <input
                  value={codeToUse}
                  onChange={(event) => setCodeToUse(event.target.value)}
                  disabled={inProgress}
                  placeholder="PLAYDAY-XXXX-XXXX"
                  className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => redeemCode(codeToUse)}
                  disabled={inProgress || !codeToUse.trim()}
                  className="button-primary w-full justify-center sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Redeem code
                </button>
                <button
                  type="button"
                  onClick={requestAccess}
                  disabled={inProgress || accessRequested}
                  className="button-secondary w-full justify-center sm:w-auto disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {accessRequested ? 'Access requested' : 'Request access'}
                </button>
              </div>
            </div>
          )}
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}

export default function RedeemKeyPage() {
  return (
    <Suspense fallback={<div />}>
      <RedeemKeyContent />
    </Suspense>
  );
}
