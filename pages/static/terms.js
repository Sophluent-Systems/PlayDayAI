import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { defaultGetServerSideProps } from '@src/client/prerender'


export default function Terms(props) {

  return (
  <DefaultLayout>
    <StandardContentArea>
      <h1>Terms of Use</h1>
    </StandardContentArea>
  </DefaultLayout>);
}

export const getServerSideProps = defaultGetServerSideProps;