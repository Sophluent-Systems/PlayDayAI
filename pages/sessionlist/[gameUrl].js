import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { defaultAppTheme } from '@src/common/theme';
import { MenuItemList } from '@src/client/components/standard/menuitemlist';
import { callGetAllSessionsForGame } from '@src/client/editor';
import {  
  Typography, 
  ListItem,
  Box,
} from '@mui/material';
import { PrettyDate } from '@src/common/date';
import { CollapsiblePanelLayout } from '@src/client/components/standard/collapsiblepanellayout';
import SessionViewer from '@src/client/components/sessionviewer';
import GameMenu from '@src/client/components/gamemenu';
import { useRecoilState } from 'recoil';
import { vhState } from '@src/client/states';
import { stateManager } from '@src/client/statemanager';
import { VersionSelector } from '@src/client/components/versionselector';
import { defaultGetServerSideProps } from '@src/client/prerender'
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme) => ({
 container: {
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      justifyContent: 'center',
      marginTop: theme.spacing(1),
      backgroundColor: theme.palette.background.main,
  },
}));


export default function Home(props) {
  const { classes } = useStyles();
  const router = useRouter();
  const { loading, game, account, versionList, version, session, gamePermissions, editMode } = React.useContext(stateManager);
  const [vh, setVh] = useRecoilState(vhState);
  const [sessions, setSessions] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  
  
function printSessionItem(session, index) {
  const accountName = session?.account?.email ? session.account.email : session.accountID;
  const assignedName = session.assignedName ? session.assignedName : null;
  return (
    <ListItem key={index} sx={{ padding: '8px 16px' }}> {/* Replace InfoBubble with ListItem and add padding */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {assignedName ? (
            <Typography
            variant="body1" // Change the variant to adjust font size
            color="inherit"
            >
            {assignedName}
            </Typography>
          ): null}
          {assignedName ? (
            <Typography
              variant="body2" // Change the variant to adjust font size
              color="textSecondary"
              style={{ marginTop: 1 }}
            >
               User: {accountName}
            </Typography>
          ) : (
          <Typography
            variant="body1" // Change the variant to adjust font size
            color="inherit"
          >
            User: {accountName}
          </Typography>
          )}
          <Typography
            variant="body2" // Change the variant to adjust font size
            color="textSecondary"
            style={{ marginTop: 1 }}
          >
            Last played: {PrettyDate(session.latestUpdate)}
          </Typography>
          <Typography
            variant="body2" // Change the variant to adjust font size
            color="textSecondary"
            style={{ marginTop: 1 }}
          >
            Version: {session.versionInfo.versionName}
          </Typography>
        </div>
      </div>
    </ListItem>
  );
}

useEffect(() => {
  async function fetchGameSessions() {
    try {
      const sessionList = await callGetAllSessionsForGame(game.gameID, version.versionID);
      setSessions(sessionList);
      const newMenuItems = sessionList ? sessionList.map((session, index) => printSessionItem(session, index)) : [];
      setMenuItems(newMenuItems);
    } catch (error) {
      console.error('Error fetching game sessions:', error);
    }
  }
  if (version) {
      fetchGameSessions();
  }
}, [version]);

const handleMenuItemSelected = (index) => {
  setSelectedSession(sessions[index]);
};


function renderWithFormatting(children) {
  return (
    <StandardContentArea>
        <InfoBubble>
          {children}
        </InfoBubble>
    </StandardContentArea>
  );
}

console.log("sessions", sessions ? sessions : "no sessions");
console.log("selectedSession", selectedSession ? selectedSession : "no selected session");

const contentComponent = () =>
  (<DefaultLayout>
        {sessions ? (
        selectedSession ? (
          <StandardContentArea>
            <SessionViewer theme={game?.theme ? game.theme : defaultAppTheme} game={game} sessionID={selectedSession.sessionID} editMode={editMode} />
          </StandardContentArea>
        ) : (
          renderWithFormatting(<h1>Select a session from the menu to the left</h1>)
        )
      ) : (
        version ? renderWithFormatting(<h1>Loading game sessions...</h1>) : renderWithFormatting(<h1>Select a game version on the left</h1>) 
      )}

  </DefaultLayout>);

const panels = [
  {
    content:
    <DefaultLayout>
      <StandardContentArea>
        <VersionSelector />,
      </StandardContentArea>
    </DefaultLayout>,
    width: 250,
    label: 'Versions',
    defaultOpen: false
  },
  {
    content: <DefaultLayout><StandardContentArea><MenuItemList menuItems={menuItems} onMenuItemSelected={handleMenuItemSelected} autoSelect /></StandardContentArea></DefaultLayout>,
    width: 250,
    label: 'Session List',
    defaultOpen: true
  },
  {
    content: contentComponent(),
    label: "Viewer",
    defaultOpen: true,
    lockedOpen: true
  },
];

  return (
  <RequireAuthentication>
    <DefaultLayout title="Session Viewer">
    <Box 
      sx={{
        height: `${vh}px`,
        maxHeight: `${vh}px`,
        width: '100%',
      }}
    >
       {(loading || !game || !account || !gamePermissions) ? renderWithFormatting(<h1>Loading...</h1>) 
            : (!gamePermissions.includes('game_modifyPermissions') ?
              renderWithFormatting(<h1>You are not authorized to view sessions for this game.</h1>)
              : (!editMode) ?
              renderWithFormatting(<h1>You must be in edit mode to use this feature.</h1>)
              : (
            <CollapsiblePanelLayout 
                theme={defaultAppTheme}
                panels={panels}
                persistKey={"sessionViewer"}
            />
      ))}
        <GameMenu 
                url={game} 
                theme={defaultAppTheme}
                allowEditOptions  
                includePlayOption
            />
    </Box>
    </DefaultLayout>
  </RequireAuthentication> 
  );
}



export const getServerSideProps = defaultGetServerSideProps;