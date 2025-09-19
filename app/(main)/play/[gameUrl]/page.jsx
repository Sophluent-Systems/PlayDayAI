'use client';

import React, { memo, useEffect, useState } from 'react';
import ChatBot from '@src/client/components/chatbot';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { defaultAppTheme } from '@src/common/theme';
import { useRouter } from 'next/router';
import { stateManager } from '@src/client/statemanager';
import GameMenu  from '@src/client/components/gamemenu';
import { MenuItemList } from '@src/client/components/standard/menuitemlist';
import { CollapsiblePanelLayout } from '@src/client/components/standard/collapsiblepanellayout';
import { VersionSelector } from '@src/client/components/versionselector';
import { callGetAllSessionsForGame } from '@src/client/editor';
import { PrettyDate } from '@src/common/date';
import { 
  Typography, 
  ListItem,
} from '@mui/material';
import { ContextMenu } from '@src/client/components/standard/contextmenu';
import { callDeleteGameSession, callRenameSession } from '@src/client/gameplay';
import { TextDialog } from '@src/client/components/standard/textdialog';


function Home(props) {
  const router = useRouter();
  const { account, loading, game, versionList, version, session,setAccountPreference, switchVersionByName, gamePermissions, editMode, switchSessionID } = React.useContext(stateManager);
  const [sessions, setSessions] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [renameSession, setRenameSession] = useState(undefined);

  const themeToUse = game ? (game.theme ? game.theme : defaultAppTheme) : defaultAppTheme;
  
  useEffect(() => {
    if (game && account && versionList && versionList.length > 0 && !version) {
        // if game.primaryVersion exists and is in the versionList, use that
        if (game.primaryVersion && versionList.find(v => v.versionName === game.primaryVersion)) {
          switchVersionByName(game.primaryVersion);
          return;
        }
        
        // Otherwise find the most recently updated version
        let sortedVersions = [...versionList];
        sortedVersions.sort((a, b) => new Date(b.lastUpdatedDate) - new Date(a.lastUpdatedDate));
        // if no published version, find the first unpublished version
        switchVersionByName(sortedVersions[0].versionName);
    }
  }, [account, versionList, game]);

  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
          <InfoBubble>
            {children}
          </InfoBubble>
      </StandardContentArea>
    );
  }


  async function refreshGameSessions() {
    try {
      const sessionList = await callGetAllSessionsForGame(game.gameID, version.versionID, account.accountID);
      setSessions(sessionList);
      const newMenuItems = sessionList ? sessionList.map((session, index) => printSessionItem(session, index)) : [];
      setMenuItems(newMenuItems);
    } catch (error) {
      console.error('Error fetching game sessions:', error);
    }
  }

async function handleDeleteSession(sessionID) {
  console.log("Delete session: ", sessionID);
  await callDeleteGameSession(sessionID);
  refreshGameSessions();
}

const handleRenameUpdated = async (newText) => {
  if (newText && newText != renameSession.assignedName) {
    console.log("Rename session: ", renameSession.assignedName, " to ", newText);
    await callRenameSession(game.gameID, renameSession.sessionID, newText);
    refreshGameSessions();
  }
  setRenameSession(undefined);
}

function beginRename(session) {
  console.log("Begin rename: ", session)
  setRenameSession(session);
}


function generateMenuItems(session, index) {
  let menuItems = [{onClick: () => handleDeleteSession(session.sessionID), label: "Delete"},
                   { onClick: () => beginRename(session), label: "Rename"}];

  return menuItems;
}
  
function printSessionItem(session, index) {
  const accountName = session?.account?.email ? session.account.email : session.accountID;
  const assignedName = session.assignedName ? session.assignedName : null;
  return (
    <ListItem key={index} sx={{ padding: '8px 16px' }}> 
      <ContextMenu menuItems={generateMenuItems(session, index)}>
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
      </ContextMenu>
    </ListItem>
  );
}
  
  useEffect(() => {
    if (version && account) {
        refreshGameSessions();
    }
  }, [version, account]);
  

  const handleMenuItemSelected = (index) => {
    if (sessions[index].sessionID != session?.sessionID) {
      switchSessionID(sessions[index].sessionID);
    }
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

  function contentComponent() {
    return <ChatBot url={game?.url} title={game?.title} theme={themeToUse} session={session} version={version} versionList={versionList} />;
  }


  const panels = editMode ?  [
    {
      content: 
      <DefaultLayout>
        <StandardContentArea>
          <VersionSelector />,
        </StandardContentArea>
      </DefaultLayout>,
      width: 200,
      label: 'Versions',
      defaultOpen: false
    },
    {
      content: <DefaultLayout theme={defaultAppTheme}><StandardContentArea><MenuItemList menuItems={menuItems} onMenuItemSelected={handleMenuItemSelected} autoSelect /></StandardContentArea></DefaultLayout>,
      width: 200,
      label: 'Sessions',
      defaultOpen: false
    },
    {
      content: contentComponent(),
      label: 'Play',
      defaultOpen: true,
      lockedOpen: true
    },
  ] : [];


  return (
    <RequireAuthentication>
    <DefaultLayout>
         {(loading || !account || !gamePermissions) ? renderWithFormatting(<h1>Loading...</h1>) 
          : (!gamePermissions.includes('game_play')) ?
             renderWithFormatting(<h1>You are not authorized to play this game.</h1>)
            : (
              editMode ? 
              <CollapsiblePanelLayout theme={defaultAppTheme} panels={panels} persistKey={"play"} />
              :
              contentComponent()
        )}
        <GameMenu 
              url={game} 
              theme={defaultAppTheme}
              allowEditOptions
              includePlayOption
          />
        <TextDialog shown={renameSession != undefined} label="New save name" currentText={renameSession?.assignedName} onNewText={handleRenameUpdated} />
    </DefaultLayout>
  </RequireAuthentication> 
  );
}

export default memo(Home);

