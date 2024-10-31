import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '@src/client/apptheme';
import { UserProvider } from '@src/client/auth';
import { CssBaseline, Typography } from '@mui/material';
import '@styles/globals.css';
import { RecoilRoot, RecoilEnv  } from 'recoil';
import {  QueryClientProvider, QueryClient } from 'react-query';
import { AlertProvider } from '@src/client/components/standard/AlertProvider';
import { CacheProvider } from '@emotion/react';
import { createEmotionCache } from '@src/client/createEmotionCache';
import { StateProvider } from '@src/client/stateprovider';
import { ConfigProvider } from '@src/client/configprovider';

// Create a react-query client
const queryClient = new QueryClient();

// Client-side cache, shared for the whole session of the user in the browser.
const clientSideEmotionCache = createEmotionCache();

// Disable Recoil's duplicate atom key checks which throw warnings in development mode
RecoilEnv.RECOIL_DUPLICATE_ATOM_KEY_CHECKING_ENABLED = false;

export default function App({ Component, emotionCache = clientSideEmotionCache, pageProps }) {

  return (
    <>
          <CacheProvider value={emotionCache}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
                <RecoilRoot>
                  <UserProvider
                    audience={`${process.env.PROTOCOL}://${process.env.BASE_URL}/api`}
                    scope="play:games" // The scopes you created, separated by spaces
                  >
                    <QueryClientProvider client={queryClient}>
                      <ConfigProvider>
                        <AlertProvider>
                          <StateProvider isSandbox={process.env.SANDBOX}>

                              {/* The Component is the page that is being rendered */}
                              <Component {...pageProps} />

                          </StateProvider>
                        </AlertProvider>
                      </ConfigProvider> 
                    </QueryClientProvider>
                  </UserProvider>
                </RecoilRoot>
            </ThemeProvider>
        </CacheProvider>
  </>
  );
}
