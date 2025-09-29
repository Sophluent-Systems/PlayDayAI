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
  const [mounted, setMounted] = useState(false);
  const lastSyncedSettingRef = useRef(theme ?? "system");
  const appliedAccountRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  const preferredSetting = account?.preferences?.themeMode ?? "system";
  const lastProcessedPreferenceRef = useRef(preferredSetting);
  const pendingPreferenceRef = useRef(null);
  const accountID = account?.accountID ?? null;

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const currentSetting = theme ?? "system";
    const preferred = preferredSetting ?? "system";

    if (!accountID) {
      appliedAccountRef.current = null;
      pendingPreferenceRef.current = null;
      lastSyncedSettingRef.current = currentSetting;
      lastProcessedPreferenceRef.current = preferred;
      return;
    }

    if (appliedAccountRef.current !== accountID) {
      appliedAccountRef.current = accountID;
      pendingPreferenceRef.current = null;
      lastSyncedSettingRef.current = preferred;
      lastProcessedPreferenceRef.current = preferred;

      if (currentSetting !== preferred) {
        setTheme(preferred);
      }
      return;
    }

    if (pendingPreferenceRef.current && preferred === pendingPreferenceRef.current) {
      pendingPreferenceRef.current = null;
    }

    if (pendingPreferenceRef.current) {
      return;
    }

    if (preferred === lastProcessedPreferenceRef.current) {
      return;
    }

    lastProcessedPreferenceRef.current = preferred;

    if (preferred !== currentSetting) {
      lastSyncedSettingRef.current = preferred;
      setTheme(preferred);
    }
  }, [accountID, preferredSetting, theme, setTheme, mounted]);

  useEffect(() => {
    if (!accountID || !mounted) {
      return;
    }

    const currentSetting = theme ?? "system";
    if (lastSyncedSettingRef.current === currentSetting) {
      return;
    }

    lastSyncedSettingRef.current = currentSetting;
    pendingPreferenceRef.current = currentSetting;
    setAccountPreference?.("themeMode", currentSetting);
  }, [theme, accountID, setAccountPreference, mounted]);

  return null;
}

function ThemedProviders({ children, isSandbox, queryClient }) {
  const { resolvedTheme } = useTheme();
  const [muiMode, setMuiMode] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !resolvedTheme) {
      return;
    }

    setMuiMode(resolvedTheme === "light" ? "light" : "dark");
  }, [resolvedTheme, mounted]);

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
