import { useEffect } from "react";
import Head from 'next/head';
import { Box } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useRecoilState } from 'recoil';
import { vhState } from '@src/client/states';

const useStyles = makeStyles()((theme) => ({
  container: {
    justifyContent: 'flex-start',
    alignItems: "center",
    backgroundColor: theme.palette.background.immersive,
  },
}));

export function OuterContainer(props) {
  const { classes } = useStyles();
  const { children, title } = props;
  const [vh, setVh] = useRecoilState(vhState);

  useEffect(() => {
    const setViewportHeight = () => setVh(window.innerHeight);
    
    // Set height on resize
    window.addEventListener('resize', setViewportHeight);
    
    // Set initial height
    setViewportHeight();

    // Cleanup listener on unmount
    return () => window.removeEventListener('resize', setViewportHeight);
  }, []);

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Play open-ended games" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        <Box 
          className={classes.container}
        >
            {children}
        </Box>
      </main>
    </div>
  );
}
