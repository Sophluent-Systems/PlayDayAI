"use client";

import React, { Suspense, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { stateManager } from "@src/client/statemanager";

function ThemeSynchronizer() {
  const context = useContext(stateManager);
  const account = context?.account;
  const setAccountPreference = context?.setAccountPreference;
  const { theme, setTheme } = useTheme();
  const lastSyncedSettingRef = useRef(theme ?? "system");
  const appliedAccountRef = useRef(null);
  const preferredSetting = account?.preferences?.themeMode ?? "system";
  const accountID = account?.accountID ?? null;

  useEffect(() => {
    const currentSetting = theme ?? "system";

    if (!accountID) {
      appliedAccountRef.current = null;
      lastSyncedSettingRef.current = currentSetting;
      return;
    }

    if (appliedAccountRef.current !== accountID) {
      appliedAccountRef.current = accountID;
      lastSyncedSettingRef.current = preferredSetting;
      if (currentSetting !== preferredSetting) {
        setTheme(preferredSetting);
      }
      return;
    }

    if (preferredSetting !== currentSetting && preferredSetting !== lastSyncedSettingRef.current) {
      lastSyncedSettingRef.current = preferredSetting;
      setTheme(preferredSetting);
    }
  }, [accountID, preferredSetting, theme, setTheme]);

  useEffect(() => {
    if (!accountID) {
      return;
    }

    const currentSetting = theme ?? "system";
    if (lastSyncedSettingRef.current === currentSetting) {
      return;
    }

    lastSyncedSettingRef.current = currentSetting;
    setAccountPreference?.("themeMode", currentSetting);
  }, [theme, accountID, setAccountPreference]);

  return null;
}

function ThemedProviders({ children, isSandbox, queryClient }) {
  const { resolvedTheme } = useTheme();
  const [muiMode, setMuiMode] = useState("dark");

  useEffect(() => {
    if (!resolvedTheme) {
      return;
    }

    setMuiMode(resolvedTheme === "light" ? "light" : "dark");
  }, [resolvedTheme]);

  const muiTheme = useMemo(() => createAppTheme(muiMode), [muiMode]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <JotaiProvider>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider>
            <AlertProvider>
              <Suspense fallback={null}>
                <StateProvider isSandbox={isSandbox}>
                  <ThemeSynchronizer />
                  {children}
                </StateProvider>
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
