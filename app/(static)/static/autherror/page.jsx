'use client';

import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';


export default function AuthError(props) {

  return (
  <DefaultLayout>
    <StandardContentArea>
      <InfoBubble>
      <h1><a href="/">You are not allowed to access that.  Click here to go back.</a></h1>
      </InfoBubble>
    </StandardContentArea>
  </DefaultLayout>);
}


