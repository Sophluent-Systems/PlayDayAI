import { InfoBubble } from './infobubble';
import { DefaultLayout } from './defaultlayout';
import { StandardContentArea } from './standardcontentarea';


export function LoadingScreen(props) {
  
  return (
    <DefaultLayout logoBanner={true}>
      <StandardContentArea>
        <InfoBubble>
            <h1>Loading...</h1>
        </InfoBubble>
      </StandardContentArea>
    </DefaultLayout>
  );
}
