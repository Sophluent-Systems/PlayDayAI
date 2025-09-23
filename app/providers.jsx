"use client";

import React, { Suspense, useMemo, useState } from "react";
import { CacheProvider } from "@emotion/react";
import { ThemeProvider as MuiThemeProvider, CssBaseline } from "@mui/material";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { createEmotionCache } from "@src/client/createEmotionCache";
import { createAppTheme } from "@src/client/apptheme";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "react-query";
import { AlertProvider } from "@src/client/components/standard/AlertProvider";
import { StateProvider } from "@src/client/stateprovider";
import { ConfigProvider } from "@src/client/configprovider";

function ThemedProviders({ children, isSandbox, queryClient }) {
  const { resolvedTheme } = useTheme();
  const muiTheme = useMemo(
    () => createAppTheme(resolvedTheme === "light" ? "light" : "dark"),
    [resolvedTheme]
  );

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider>
            <AlertProvider>
              <Suspense fallback={null}>
                <StateProvider isSandbox={isSandbox}>{children}</StateProvider>
              </Suspense>
            </AlertProvider>
          </ConfigProvider>
        </QueryClientProvider>
      </JotaiProvider>
    </MuiThemeProvider>
  );
}

export default function Providers({ children, isSandbox }) {
  const [emotionCache] = useState(() => createEmotionCache());
  const [queryClient] = useState(() => new QueryClient());

  return (
    <CacheProvider value={emotionCache}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ThemedProviders isSandbox={isSandbox} queryClient={queryClient}>
          {children}
        </ThemedProviders>
      </NextThemesProvider>
    </CacheProvider>
  );
}
