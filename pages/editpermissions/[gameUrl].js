import { useRouter } from 'next/router';
import React, { memo, useState, useEffect } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { defaultAppTheme } from '@src/common/theme';
import { makeStyles } from 'tss-react/mui';
import {
  Box,
} from '@mui/material';
import Title from '@src/client/components/standard/title';
import { AddAndEditGameUsers } from '@src/client/components/addandeditgameusers';
import { useRecoilState } from 'recoil';
import { vhState } from '@src/client/states';
import { stateManager } from '@src/client/statemanager';
import GameMenu from '@src/client/components/gamemenu';
import { defaultGetServerSideProps } from '@src/client/prerender'

const useStyles = makeStyles()((theme, pageTheme) => {
  const {
    colors,
    fonts,
  } = pageTheme;
  return ({
  inputField: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  scenarioStyle: {
    padding: '8px',
    marginBottom: '8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: colors.inputAreaTextEntryBackgroundColor, 
  },
})});


function Home(props) {
  const { loading, account, game, gamePermissions } = React.useContext(stateManager);
  const [vh, setVh] = useRecoilState(vhState);
  const router = useRouter();



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
      <DefaultLayout title={!game ? "Loading" : `${game.title} permissions`} theme={defaultAppTheme}>
      <StandardContentArea>
            {(loading  || !game || !account || !gamePermissions) ? renderWithFormatting(<h1>Loading...</h1>) 
            : (!gamePermissions.includes('game_modifyPermissions') ?
              renderWithFormatting(<h1>You are not authorized to edit this app's permissions.</h1>)
              : (
                <Box sx={{flex: 1, width: '100%', height: '100%', alignContent: 'flex-start', justifyContent: 'center'}}>
                  <AddAndEditGameUsers
                    gameID={game.gameID}
                  />
                </Box>
              ))}
          <GameMenu 
                  url={game} 
                  theme={defaultAppTheme}
                  allowEditOptions  
              />
      </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication> 
  );

}

export default memo(Home);

export const getServerSideProps = defaultGetServerSideProps;