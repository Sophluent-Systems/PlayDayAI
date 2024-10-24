import React, { useState, useEffect } from 'react';
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
import Title  from '@src/client/components/standard/title';
import { useRouter } from 'next/router';
import { callRedeemCode } from '@src/client/codes';
import { defaultGetServerSideProps } from '@src/client/prerender'
import { nullUndefinedOrEmpty } from '@src/common/objects';

export default function Home(props) {
  const router = useRouter();
  const { code } = router.query;
  const { loading, account, updateSignedInAccount, navigateTo, forceAccountRefresh, hasServicePerms } = React.useContext(stateManager);
  const [codeToUse, setCodeToUse] = useState(code);
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [inProgress, setInProgress] = useState(false);
  const [accessRequested, setAccessRequested] = useState(false);

  useEffect(() => {
    if (!loading && account) {
      if (!accountLoaded) {
        setAccountLoaded(true);
      }
      setAccessRequested(!nullUndefinedOrEmpty(account.preferences.accessRequestStatus))
    }
  }, [loading, account]);

  useEffect(() => {
    if (accountLoaded && code) {
      setCodeToUse(code);
      redeemCode(code);
    }
  }, [accountLoaded, code]);

  useEffect(() => {
    if (hasServicePerms("service_basicAccess")) {
      navigateTo('/')
    }
  }, [account]);
  
  async function redeemCode(codeToRedeem) {
    setInProgress(true);
    const response = await callRedeemCode(codeToRedeem);
    console.log("Redeem code response: ", response);
    if (response && response.status == 'success') {
      alert("Code redeemed successfully!");
      await forceAccountRefresh();
      navigateTo('/');
    } else if (response && response.status == "already_redeemed") {
      alert("This code has already been redeemed.");
      await forceAccountRefresh(); // just in case it belonged to this account
      setInProgress(false);
    } else if (response && response.status == "wrong_account") {
      alert("This code is not for your account.");
      setInProgress(false);
    } else if (response && response.status == "expired") {
      alert("This code has expired.");
      setInProgress(false);
    } else if (response && response.status == "not_found") {
      alert("The code was not found. Check that it was entered correctly and try again.");
      setInProgress(false);
    } else {
      alert("Something went wrong redeeming the code.");
      setInProgress(false);
    }
  }

  async function requestAccess() {
    if (nullUndefinedOrEmpty(account.preferences.accessRequestStatus)) {
      let newAccount = {...account};
      newAccount.preferences = {...account.preferences, accessRequestStatus: "requested", accessRequestDate: new Date()}
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
  

  return (<RequireAuthentication>
    <DefaultLayout  title={"Reedem a Key"}>
      <StandardContentArea> 
      {(loading || !account) ? renderWithFormatting(<h1>Loading...</h1>) 
      : (
          <Box sx={{ display: 'flex', flexGrow: 1, minWidth: 400, flexDirection: 'column', margin: 5 }}>
              <TextField label={"Access Code"} value={codeToUse} sx={{margin:5}} onChange={(event) => setCodeToUse(event.target.value)} disabled={inProgress} />
              <Button variant="contained" width={30} sx={{margin:5}} onClick={() => redeemCode(codeToUse)} disabled={inProgress} >Redeem code</Button>
              <Button variant="contained" width={30} sx={{margin:5}} onClick={() => requestAccess()} disabled={inProgress || accessRequested} >{accessRequested ? "Access requested" : "Request Access"}</Button>
          </Box>
      )}
      </StandardContentArea>
    </DefaultLayout>
  </RequireAuthentication> 
  );
}

export const getServerSideProps = defaultGetServerSideProps;