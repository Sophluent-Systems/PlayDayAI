import React from 'react';
import { OuterContainer } from './outercontainer';
import { InfoBubble } from './infobubble';
import { StandardContentArea } from './standardcontentarea';
import  { defaultAppTheme } from '@src/common/theme';
import { stateManager } from '@src/client/statemanager';

export function RequireAuthentication(props) {
  const { loading, account } = React.useContext(stateManager);
  const { children, theme } = props;
  

  function renderWithFormatting(children) {
    return (
      <OuterContainer title="Play Day.AI" theme={theme ? theme : defaultAppTheme}>
        <StandardContentArea>
            <InfoBubble>
              {children}
            </InfoBubble>
        </StandardContentArea>
      </OuterContainer>
    );
  }

  function renderContent() {
    if (loading || !account) {
      return renderWithFormatting(<h1>Loading...</h1>);
    } else {
      return children;
    }
  }

  return (
    <React.Fragment>
      {renderContent()}
    </React.Fragment>
  );
}

