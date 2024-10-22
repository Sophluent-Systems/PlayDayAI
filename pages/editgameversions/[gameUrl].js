import React, { useState, useEffect } from 'react';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { defaultAppTheme } from '@src/common/theme';
import { CollapsiblePanelLayout } from '@src/client/components/standard/collapsiblepanellayout';
import VersionEditor from '@src/client/components/versioneditor/versioneditor';
import GameMenu from '@src/client/components/gamemenu';
import ChatBot from '@src/client/components/chatbot';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { OuterContainer } from '@src/client/components/standard/outercontainer';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { stateManager } from '@src/client/statemanager';
import { EditorPreferencesCheck } from '@src/client/components/editorpreferencescheck';
import { defaultGetServerSideProps } from '@src/client/prerender';

export default function Home(props) {
  const [panels, setPanels] = useState([]); // [left, middle, right]
  const { loading, game, versionList, version, setAccountPreference, editMode } = React.useContext(stateManager);
  const [themeToUse, setThemeToUse] = useState(defaultAppTheme);

  useEffect(() => {
    // turn on edit mode by defualt when editing
    if (!loading && !editMode) {
      setAccountPreference("editMode", true);
    }
  }, [loading]);

function renderWithFormatting(children) {
  return (
    <StandardContentArea>
        <InfoBubble>
          {children}
        </InfoBubble>
    </StandardContentArea>
  );
}

useEffect(() => {

  let newThemeToUse = game ? (game.theme ? game.theme : defaultAppTheme) : defaultAppTheme;
  setThemeToUse(newThemeToUse);
}, [game]);


useEffect(() => {
    const liveDebugComponent =
      (
        <DefaultLayout theme={themeToUse}>
            {(loading || !game || !version) ? 

              renderWithFormatting(<h1>No version selected yet</h1>
            
            ) : (
            
                <ChatBot url={game?.url} title={game?.title} theme={themeToUse} key={game?.url}  />

            )}
        </DefaultLayout>
      );

    const editorComponent = 
      (
          <DefaultLayout>
              {(!loading && versionList) ? (
                  <VersionEditor  />
            ) : (
              loading ? renderWithFormatting(<h1>Loading game versions...</h1>) : renderWithFormatting(<h1>Select "Add Version" from the dropdown above</h1>)
            )}
            
        </DefaultLayout>);


      const newPanels = [
        {
          content: editorComponent,
          label: 'Edit',
          defaultOpen: true
        },
        {
          content: liveDebugComponent,
          label: 'Play',
          defaultOpen: false
        },
      ];

      setPanels(newPanels);
  }, [version, versionList, game, loading]);

  return (
    <RequireAuthentication>
    <OuterContainer title="Play Day.AI" theme={defaultAppTheme}>
        <CollapsiblePanelLayout 
            key={'panels-' + game?.url}
            theme={defaultAppTheme}
            panels={panels}
            persistKey="editGameVersions"
        />
        <GameMenu 
              key={'menu-' + game?.url}
              url={game} 
              theme={defaultAppTheme}
              allowEditOptions  
              includePlayOption
          />
      </OuterContainer>
      <EditorPreferencesCheck />
    </RequireAuthentication> 
  );
}



export const getServerSideProps = defaultGetServerSideProps;
