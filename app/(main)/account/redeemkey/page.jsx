'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  TextField,
  Box,
} from '@mui/material';
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

  useEffect(() => {
    if (accountLoaded && codeParam) {
      redeemCode(codeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountLoaded, codeParam, redeemCode]);

  useEffect(() => {
    if (hasServicePerms('service_basicAccess')) {
      navigateTo('/');
    }
  }, [account, hasServicePerms, navigateTo]);

  const redeemCode = useCallback(async (codeToRedeem) => {
    setInProgress(true);
    const response = await callRedeemCode(codeToRedeem);
    console.log('Redeem code response: ', response);
    if (response && response.status == 'success') {
      alert('Code redeemed successfully!');
      await forceAccountRefresh();
      navigateTo('/');
    } else if (response && response.status == 'already_redeemed') {
      alert('This code has already been redeemed.');
      await forceAccountRefresh();
      setInProgress(false);
    } else if (response && response.status == 'wrong_account') {
      alert('This code is not for your account.');
      setInProgress(false);
    } else if (response && response.status == 'expired') {
      alert('This code has expired.');
      setInProgress(false);
    } else if (response && response.status == 'not_found') {
      alert('The code was not found. Check that it was entered correctly and try again.');
      setInProgress(false);
    } else {
      alert('Something went wrong redeeming the code.');
      setInProgress(false);
    }
  }, [forceAccountRefresh, navigateTo]);

  async function requestAccess() {
    if (nullUndefinedOrEmpty(account.preferences.accessRequestStatus)) {
      let newAccount = { ...account };
      newAccount.preferences = { ...account.preferences, accessRequestStatus: 'requested', accessRequestDate: new Date() };
      updateSignedInAccount(newAccount);
    }
    setAccessRequested(true);
  }

  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
        <InfoBubble>
          {children}
        </InfoBubble>
      </StandardContentArea>
    );
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title={'Reedem a Key'}>
        <StandardContentArea>
          {(loading || !account)
            ? renderWithFormatting(<h1>Loading...</h1>)
            : (
              <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 400, flexDirection: 'column', margin: 5 }}>
                <TextField label={'Access Code'} value={codeToUse} sx={{ margin: 5 }} onChange={(event) => setCodeToUse(event.target.value)} disabled={inProgress} />
                <Button variant="contained" width={30} sx={{ margin: 5 }} onClick={() => redeemCode(codeToUse)} disabled={inProgress}>Redeem code</Button>
                <Button variant="contained" width={30} sx={{ margin: 5 }} onClick={() => requestAccess()} disabled={inProgress || accessRequested}>
                  {accessRequested ? 'Access requested' : 'Request Access'}
                </Button>
              </Box>
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
