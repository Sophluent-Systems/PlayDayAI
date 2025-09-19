"use client";

import React, { Suspense, useState } from "react";
import { CacheProvider } from "@emotion/react";
import { createEmotionCache } from "@src/client/createEmotionCache";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "@src/client/apptheme";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "react-query";
import { AlertProvider } from "@src/client/components/standard/AlertProvider";
import { StateProvider } from "@src/client/stateprovider";
import { ConfigProvider } from "@src/client/configprovider";

export default function Providers({ children, isSandbox }) {
  const [emotionCache] = useState(() => createEmotionCache());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <JotaiProvider>
            <QueryClientProvider client={queryClient}>
              <ConfigProvider>
                <AlertProvider>
                  <Suspense fallback={null}>
                    <StateProvider isSandbox={isSandbox}>
                      {children}
                    </StateProvider>
                  </Suspense>
                </AlertProvider>
              </ConfigProvider>
            </QueryClientProvider>
        </JotaiProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

