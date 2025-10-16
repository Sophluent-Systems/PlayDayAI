'use client';


import { useLegacyRouter } from '@src/client/useLegacyRouter';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { callListGameVersions, callGetVersionInfoForEdit } from '@src/client/editor';
import { callgetGameInfoByUrl, callGetSessionInfo } from '@src/client/gameplay';
import { account, editModeState, gameState, versionListState, versionState, sessionState, loadingState, globalTemporaryStateState, accessTokenState, optimisticAccountState } from '@src/client/states';
import { useAtom } from 'jotai';
import { defaultAppTheme } from '@src/common/theme';
import { callGetAccountInfo, callUpdateAccountInfo } from '@src/client/account';
import { callGetAccountPermissionsForGame } from '@src/client/permissions';
import { useUser } from "@src/client/auth";
import { useQuery, useQueryClient } from 'react-query';
import { callStartNewGame } from '@src/client/gameplay';
import { useConfig } from '@src/client/configprovider';
import { analyticsReportEvent } from "@src/client/analytics";
import { isEqual, debounce } from 'lodash';
import { nullUndefinedOrEmpty } from '../common/objects';

const ROUTES_WITH_GAME_URL = new Set([
    'play',
    'editdetails',
    'editgameversions',
    'editpermissions',
    'sessionlist',
    'trainingdata',
]);

const ROUTE_TITLE_PREFIX = {
    play: 'Play',
    editdetails: 'Edit Details',
    editgameversions: 'Game Versions',
    editpermissions: 'Permissions',
    sessionlist: 'Sessions',
    trainingdata: 'Training Data',
    account: 'Account',
    admin: 'Admin',
    test: 'Test',
};

const DEFAULT_APP_TITLE = 'Play Day.AI';


export function topLevelStateController(props) {
    const { Constants } = useConfig();
    const router = useLegacyRouter();
    const redirectToAuthRoute = useCallback((path) => {
        const target = path.startsWith('/') ? path : `/${path}`;
        if (typeof window !== 'undefined') {
            window.location.href = target;
        } else {
            router.push(target);
        }
    }, [router]);

    const auth0 = useUser();
    const { gameUrl, versionName, sessionID } = router.query;
    const [loading, setLoading] = useState(true);
    const [optimisticAccount, setOptimisticAccount] = useState(null);
    const [localAccount, setLocalAccount] = useAtom(account);
    const [accessToken, setAccessToken] = useAtom(accessTokenState);
    const [editMode, setEditMode] = useAtom(editModeState);
    const [game, setGame] = useAtom(gameState);
    const [versionList, setVersionList] = useAtom(versionListState);
    const [version, setVersion] = useAtom(versionState);
    const [session, setSession] = useAtom(sessionState);
    const [gamePermissions, setGamePermissions] = useState(null);
    const [globalTemporaryState, setGlobalTemporaryState] = useAtom(globalTemporaryStateState);
    const [gameDataLoading, setGameDataLoading] = useState(true);
    const routeChangeUnderwayRef = useRef(false);
    const loadingRef = useRef(true);
    const previousGameUrlRef = useRef(gameUrl);
    const previousEditModeRef = useRef(editMode);
    const queryClient = useQueryClient();
    const { isSandbox } = props;
    const [accountLoading, setAccountLoading] = useState(true);
    const accountQuery = useQuery('account', callGetAccountInfo, {
        onSuccess: (data) => {
          if (data) {
            if (!isEqual(data.account, localAccount)) {
              setLocalAccount(data.account);
              setOptimisticAccount(data.account);
            }
            if (!isEqual(data.accessToken, accessToken)) {
              setAccessToken(data.accessToken);
            }
          } else {
            setLocalAccount(null);
            setAccessToken(null);
            setOptimisticAccount(null);
          }
        },
        onError: (error) => {
          console.error("Failed to get account info: ", error);
        },
        refetchInterval: 30000, // Increase polling interval to reduce unnecessary requests
      });

    useEffect(() => {
        setAccountLoading(accountQuery.isLoading);
    }, [accountQuery.isLoading]);

    const updatePermissionsForGame = useCallback(async (gameID) => {
        Constants.debug.logPermissions && console.log("updatePermissionsForGame: ", gameID, localAccount?.accountID);
        if (localAccount && gameID) {
            try {
                const newGamePermissions = await callGetAccountPermissionsForGame(localAccount.accountID, gameID);
                setGamePermissions(newGamePermissions);
            } catch (error) {
                console.error('Failed to fetch permissions for game:', error);
                setGamePermissions(null);
            }
        } else if (!gameID) {
            setGamePermissions(null);
        }
    }, [Constants.debug.logPermissions, localAccount]);
    useEffect(() => {
        const handleBeforeUnload = (event) => {
          // Your logic for handling reload goes here
          Constants.debug.logStateManager && console.log("Toplevelstatecontroller: Browser reloading");
          
          setLoading(true);
          setAccountLoading(true);
          setGameDataLoading(true);
        };
      
        window.addEventListener('beforeunload', handleBeforeUnload);
      
        // Cleanup function to remove the event listener
        return () => {
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      }, []);

    const accountHasRole = useCallback((role) => {
        if (nullUndefinedOrEmpty(role)) {
            throw new Error("Empy role supplied to hasRole");
        }

        return localAccount && localAccount.roles?.userRoles?.includes(role);
    }, [localAccount]);

    const hasServicePerms = useCallback((permissions) => {

        if (nullUndefinedOrEmpty(permissions)) {
            throw new Error("Empy permissions supplied to hasServicePermissions");
        }

        return localAccount && localAccount.roles?.servicePermissions?.includes(permissions);
    }, [localAccount]);

    useEffect(() => {
        if (game && localAccount) {
            updatePermissionsForGame(game.gameID);
        }
        if (localAccount) {
            const newEditMode = hasServicePerms("service_editMode") && localAccount?.preferences?.editMode;
            setEditMode(!!newEditMode);

            if (localAccount && !localAccount?.roles?.userRoles) {
                redirectToAuthRoute(`/auth/logout?returnTo=${encodeURIComponent(process.env.APP_NEXT_PUBLIC_BASE_URL)}`);
            } else if (localAccount && !hasServicePerms("service_basicAccess")) {
                console.log("GUEST: Redirecting to redeem key page");
                navigateTo('/account/redeemkey');
            }
        } else {
            setEditMode(false);
        }
    }, [game, hasServicePerms, localAccount, navigateTo, redirectToAuthRoute, updatePermissionsForGame]);

    const debouncedUpdateAccount = useRef(
        debounce(async (updatedAccount) => {
          try {
            await callUpdateAccountInfo(updatedAccount);
            queryClient.invalidateQueries('account');
            // After successful update, sync the localAccount with optimisticAccount
            setLocalAccount(updatedAccount);
          } catch (error) {
            console.error('Failed to update account:', error);
            // Revert optimistic update
            setOptimisticAccount(localAccount);
          }
        }, 2000)
    ).current;

    const gameInfoRequestIdRef = useRef(0);
    const versionListRequestIdRef = useRef(0);
    const versionListMetaRef = useRef({ gameID: null, editMode: null });

    const updateUrl = useCallback((props) => {
        const { navigationPath, mode, newGameUrl, clearParams, newSessionID, newVersionName } = props ?? {};
        const { query, pathname } = router;

        const finalMode = typeof mode === "undefined" ? "replace" : mode;

        const currentPath = pathname.split("?")[0] || pathname || "/";
        const currentQuery = clearParams ? {} : { ...query };

        let basePath = navigationPath ? navigationPath : currentPath;
        if (!basePath.startsWith("/")) {
            basePath = `/${basePath}`;
        }

        const baseSegments = basePath.split("/").filter(Boolean);
        const baseRoot = baseSegments[0];
        const fallbackGameUrl = typeof query.gameUrl !== "undefined" ? query.gameUrl : gameUrl;
        const desiredGameUrl = newGameUrl === null
            ? undefined
            : typeof newGameUrl !== "undefined"
                ? newGameUrl
                : fallbackGameUrl;

        if (ROUTES_WITH_GAME_URL.has(baseRoot)) {
            if (desiredGameUrl) {
                if (baseSegments.length === 1) {
                    baseSegments.push(desiredGameUrl);
                } else {
                    baseSegments[1] = desiredGameUrl;
                }
            } else {
                baseSegments.splice(1);
            }
        }

        const finalPath = `/${baseSegments.join("/")}`;

        const nextQuery = { ...currentQuery };

        if (newVersionName === null) {
            delete nextQuery.versionName;
        } else if (typeof newVersionName !== "undefined") {
            nextQuery.versionName = newVersionName;
        }

        if (newSessionID === null || (!newSessionID && nextQuery.versionName !== versionName)) {
            delete nextQuery.sessionID;
        } else if (typeof newSessionID !== "undefined") {
            nextQuery.sessionID = newSessionID;
        }

        if (newGameUrl === null) {
            delete nextQuery.gameUrl;
        } else if (typeof newGameUrl !== "undefined") {
            nextQuery.gameUrl = newGameUrl;
        }
        if (ROUTES_WITH_GAME_URL.has(baseRoot)) {
            delete nextQuery.gameUrl;
        }

        const searchParams = new URLSearchParams();
        Object.entries(nextQuery).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach((entry) => searchParams.append(key, entry));
            } else {
                searchParams.set(key, value);
            }
        });

        const search = searchParams.toString();
        const href = search.length > 0 ? `${finalPath}?${search}` : finalPath;

        if (href !== router.asPath) {
            if (finalMode === "push" || pathname !== finalPath) {
                router.push(href);
            } else {
                router.replace(href);
            }
            routeChangeUnderwayRef.current = true;
        }
    }, [gameUrl, router, sessionID, versionName]);

    const navigateTo = useCallback((relativeUrl, newGameUrl=undefined, clearParams=false) => {
        Constants.debug.logStateManager && console.log("navigateTo: ", relativeUrl, newGameUrl, clearParams);
        const params = {
            navigationPath: relativeUrl,
            mode: "push",
            ...(clearParams ? { newGameUrl: null, newVersionName: null, newSessionID: null } : {}),
        };
        if (typeof newGameUrl !== "undefined") {
            params.newGameUrl = newGameUrl;
        }
        updateUrl(params);
    }, [updateUrl, Constants.debug.logStateManager]);

    const refreshGameVersionList = useCallback(async (gameID=undefined, options = {}) => {
        const targetGameID = gameID ?? game?.gameID;
        Constants.debug.logStateManager && console.log("refreshGameVersionList: gameID=", targetGameID, " editMode=", editMode);

        if (!targetGameID) {
            setVersionList(null);
            versionListMetaRef.current = { gameID: null, editMode: null };
            return null;
        }

        const force = options.force === true;
        const lastMeta = versionListMetaRef.current;
        if (!force && lastMeta.gameID === targetGameID && lastMeta.editMode === editMode && versionList?.length) {
            return versionList;
        }

        const requestId = ++versionListRequestIdRef.current;
        try {
            const newVersionList = await callListGameVersions(targetGameID, null, false);
            if (versionListRequestIdRef.current !== requestId) {
                return null;
            }
            versionListMetaRef.current = { gameID: targetGameID, editMode };
            setVersionList(newVersionList);
            return newVersionList;
        } catch (error) {
            console.error('Error fetching game versions:', error);
            if (versionListRequestIdRef.current === requestId) {
                versionListMetaRef.current = { gameID: null, editMode: null };
                setVersionList(null);
            }
            return null;
        }
    }, [Constants.debug.logStateManager, editMode, game?.gameID, setVersionList, versionList]);

    const updateGameInfo = useCallback(async (forceRefresh=false) => {
        Constants.debug.logStateManager && console.log("updateGameInfo: ", gameUrl, game, forceRefresh);
        if (!gameUrl) {
            setGame(null);
            setGamePermissions(null);
            return;
        }

        if (!forceRefresh && game?.url === gameUrl) {
            return;
        }

        const requestId = ++gameInfoRequestIdRef.current;

        try {
            const data = await callgetGameInfoByUrl(gameUrl, "play");
            if (gameInfoRequestIdRef.current !== requestId) {
                return;
            }

            const gameInfo = data ? { ...data } : null;
            if (gameInfo) {
                if (!gameInfo.theme) {
                    gameInfo.theme = defaultAppTheme;
                }

                setGame(gameInfo);
                await updatePermissionsForGame(gameInfo.gameID);
                await refreshGameVersionList(gameInfo.gameID, { force: true });

                let newVersionName = versionName;
                let newSessionID = sessionID;
                if (version && (version.gameID !== gameInfo.gameID)) {
                    newVersionName = null;
                }
                if (session && (!newVersionName || (session.versionInfo?.versionID !== version?.versionID))) {
                    newSessionID = null;
                }

                if (newVersionName !== versionName || newSessionID !== sessionID) {
                    Constants.debug.logStateManager && console.log("updateGameInfo: switching version/session: ", newVersionName, newSessionID);
                    updateUrl({ newVersionName, newSessionID });
                }
            } else {
                setGame(null);
                setGamePermissions(null);
                setVersionList(null);
                setVersion(null);
                setSession(null);
            }
        } catch (error) {
            if (gameInfoRequestIdRef.current === requestId) {
                console.error('Error fetching game info:', error);
                router.replace('/');
            }
        }
    }, [Constants.debug.logStateManager, defaultAppTheme, game?.url, gameUrl, refreshGameVersionList, router, session, sessionID, updatePermissionsForGame, updateUrl, version, versionName]);

    const switchGameByUrl = useCallback((newGameUrl) => {
        Constants.debug.logStateManager && console.log("switchGameByUrl: ", gameUrl, game, newGameUrl);
        if (newGameUrl !== game?.url) {
            updateUrl({ newGameUrl, newVersionName: null, newSessionID: null });
        }
    }, [Constants.debug.logStateManager, game, gameUrl, updateUrl]);

    const updateVersion = useCallback(async (forceRefresh=false, gameID=null) => {
        Constants.debug.logStateManager && console.log("updateVersion name=", versionName, " forceRefresh=", forceRefresh);
        const targetGameID = gameID ?? game?.gameID;
        if (!targetGameID) {
            setVersion(null);
            return;
        }

        let currentVersionList = versionList;
        let requiresLookupRefresh = false;
        if (versionName && currentVersionList && currentVersionList.length > 0) {
            requiresLookupRefresh = !currentVersionList.some((entry) => entry.versionName === versionName);
        }

        if (forceRefresh || !currentVersionList || currentVersionList.length === 0 || requiresLookupRefresh) {
            currentVersionList = await refreshGameVersionList(targetGameID, { force: true });
            if (!currentVersionList) {
                return;
            }
        }

        if (versionName) {
            let newVersion = null;
            if (editMode) {
                newVersion = await callGetVersionInfoForEdit(targetGameID, versionName);
            } else {
                newVersion = currentVersionList.find((v) => v.versionName === versionName) ?? null;
            }
            setVersion(newVersion);
        } else {
            setVersion(null);
        }
    }, [Constants.debug.logStateManager, editMode, game?.gameID, refreshGameVersionList, setVersion, versionList, versionName]);

    const switchVersionByName = useCallback((newVersionName, gameID=null) => {
        Constants.debug.logStateManager && console.log("switchVersionByName: ", newVersionName, gameID);
        if (newVersionName !== version?.versionName) {
            updateUrl({ newVersionName, newSessionID: null });
        }
    }, [Constants.debug.logStateManager, updateUrl, version?.versionName]);

    const updateSignedInAccount = useCallback((newAccount) => {
        Constants.debug.logStateManager && console.log("updateSignedInAccount ", newAccount?.accountID);
        setOptimisticAccount(newAccount);
        debouncedUpdateAccount(newAccount);
    }, [Constants.debug.logStateManager, debouncedUpdateAccount]);

    const updateSession = useCallback(async (gameID=undefined) => {
        const targetGameID = gameID ?? game?.gameID;
        Constants.debug.logStateManager && console.log("updateSession id=", sessionID, " gameID=", targetGameID);

        if (!sessionID || !targetGameID) {
            if (!sessionID) {
                setSession(null);
            }
            return;
        }

        try {
            const newSession = await callGetSessionInfo(targetGameID, sessionID);
            if (sessionID !== session?.sessionID || session?.latestUpdate !== newSession?.latestUpdate) {
                Constants.debug.logStateManager && console.log("updateSession: newSession=", newSession);
                setSession(newSession?.session ? newSession.session : null);
            }
        } catch (error) {
            console.error('Failed to fetch session info:', error);
        }
    }, [Constants.debug.logStateManager, game?.gameID, session?.latestUpdate, session?.sessionID, sessionID]);

    const switchSessionID = useCallback((newSessionID) => {
        Constants.debug.logStateManager && console.log("switchSessionID: ", newSessionID, game?.gameID);
        if (newSessionID !== sessionID) {
            updateUrl({ newSessionID });
        }
    }, [Constants.debug.logStateManager, sessionID, updateUrl, game?.gameID]);

    const startNewGameSession = useCallback(async (url=null, versionOverride=null) => {
        Constants.debug.logStateManager && console.log("startNewGameSession: ", url, versionName, versionOverride);
        const urlToUse = url ?? game?.url;
        const versionToUse = versionOverride ?? versionName ?? version?.versionName;

        let newSession;
        try {
            newSession = await callStartNewGame(urlToUse, versionToUse);
        } catch (error) {
            console.error('Error starting new game session:', error);
        }

        if (!newSession) {
            alert("Failed to start new game session -- the game creator might not have published any games");
            router.push('/');
            return null;
        }

        switchSessionID(newSession.sessionID);

        const versionRecord = versionOverride
            ? versionList?.find((item) => item.versionName === versionOverride)
            : version;
        const targetVersionID = versionRecord?.versionID ?? version?.versionID ?? null;

        analyticsReportEvent('new_session', {
            event_category: 'App',
            event_label: 'Start new session',
            gameID: game?.gameID,
            versionID: targetVersionID,
            sessionID: newSession.sessionID,
        });

        return newSession;
    }, [Constants.debug.logStateManager, analyticsReportEvent, game?.gameID, router, switchSessionID, version, versionList, versionName]);

    const setAccountPreference = useCallback((key, value) => {
        Constants.debug.logStateManager && console.log("setAccountPreference: ", key, value);
        if (!localAccount) {
            return;
        }
        const nextPreferences = { ...(localAccount.preferences || {}) };
        nextPreferences[key] = value;
        const newAccount = { ...localAccount, preferences: nextPreferences };
        setOptimisticAccount(newAccount);
        debouncedUpdateAccount(newAccount);
    }, [Constants.debug.logStateManager, debouncedUpdateAccount, localAccount]);

    const updateGlobalTemporaryStateSetting = useCallback((key, value) => {
        setGlobalTemporaryState((previous) => ({ ...(previous || {}), [key]: value }));
    }, [setGlobalTemporaryState]);

    const refreshAccessToken = useCallback(() => {
        Constants.debug.logStateManager && console.log("refreshAccessToken");
        redirectToAuthRoute(`/auth/login?returnTo=${encodeURIComponent(router.asPath)}`);
    }, [Constants.debug.logStateManager, redirectToAuthRoute, router.asPath]);

    const forceAccountRefresh = useCallback(async () => {
        await accountQuery.refetch();
    }, [accountQuery]);

    useEffect(() => {
        // Don't update any account info until at least a stub's been created
        // on the server
        Constants.debug.logStateManager && console.log("useEffect[account] account==null", localAccount==null, " accountQuery.isFetched=", accountQuery.isFetched);

        if (localAccount) {
            analyticsReportEvent('set_user_id', { user_id: localAccount.accountID });
        }

    }, [Constants.debug.logStateManager, analyticsReportEvent, accountQuery.isFetched, localAccount]);

    useEffect(() => {
        const nextLoading = gameDataLoading || accountLoading;
        if (loadingRef.current !== nextLoading) {
            loadingRef.current = nextLoading;
            setLoading(nextLoading);
        }
    }, [accountLoading, gameDataLoading]);

    useEffect(() => {
        if (!isSandbox) {
            if (!auth0.isLoading && !auth0.user) {
                refreshAccessToken();
            }
            if (!accountQuery.isLoading && accountQuery.status === "error") {
                redirectToAuthRoute(`/auth/logout?returnTo=${encodeURIComponent(process.env.APP_NEXT_PUBLIC_BASE_URL)}`);
            }
        }
    }, [accountQuery.isLoading, accountQuery.status, auth0.isLoading, auth0.user, isSandbox, redirectToAuthRoute, refreshAccessToken]);

    useEffect(() => {
        if (routeChangeUnderwayRef.current) {
            return;
        }

        if (!router.isReady) {
            return;
        }

        const pathSegments = router.pathname.split('/').filter(Boolean);
        const requiresGameUrl = pathSegments.length > 0 && ROUTES_WITH_GAME_URL.has(pathSegments[0]);

        if (!requiresGameUrl || !gameUrl) {
            Constants.debug.logStateManager && console.log("NO GAME URL - all go null");
            setGame(null);
            setGamePermissions(null);
            setVersionList(null);
            setVersion(null);
            setSession(null);
            setGameDataLoading(false);
        } else {
            const gameUrlChanged = previousGameUrlRef.current !== gameUrl;
            const editModeChanged = previousEditModeRef.current !== editMode;

            if (gameUrlChanged || !game || game.url !== gameUrl) {
                Constants.debug.logStateManager && console.log("SWITCHING GAME BY URL game=", game, " ==> gameUrl=", gameUrl);
                setGameDataLoading(true);
                updateGameInfo(true);
            } else if (editModeChanged) {
                refreshGameVersionList(game?.gameID, { force: true });
            }
        }

        previousGameUrlRef.current = gameUrl;
        previousEditModeRef.current = editMode;
    }, [editMode, game, gameUrl, refreshGameVersionList, router.isReady, router.pathname, updateGameInfo]);

    useEffect(() => {
        if (!gameUrl || !game) {
            return;
        }

        Constants.debug.logStateManager && console.log("useEffect: [versionName] ", versionName, version?.versionName);

        let cancelled = false;
        const doVersionLoad = async () => {
            await updateVersion(false, game.gameID);
            if (!sessionID && !cancelled) {
                setGameDataLoading(false);
            }
        };

        doVersionLoad();

        return () => {
            cancelled = true;
        };
    }, [game, gameUrl, sessionID, updateVersion, version?.versionName, versionName]);

    useEffect(() => {
        if (!gameUrl || !game) {
            if (!sessionID) {
                setGameDataLoading(false);
            }
            return;
        }

        Constants.debug.logStateManager && console.log("useEffect: [sessionID] ", sessionID, session?.sessionID);

        let cancelled = false;
        const doSessionLoad = async () => {
            await updateSession(game.gameID);
            if (!cancelled) {
                setGameDataLoading(false);
            }
        };

        doSessionLoad();

        return () => {
            cancelled = true;
        };
    }, [game, gameUrl, session?.sessionID, sessionID, updateSession]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const pathSegments = router.pathname.split('/').filter(Boolean);
        const [rootSegment] = pathSegments;
        const actionPrefix = rootSegment ? ROUTE_TITLE_PREFIX[rootSegment] ?? null : null;

        let nextTitle = DEFAULT_APP_TITLE;
        if (actionPrefix && ROUTES_WITH_GAME_URL.has(rootSegment ?? '')) {
            nextTitle = game?.title ? `${game.title} – ${actionPrefix} | ${DEFAULT_APP_TITLE}` : `${actionPrefix} | ${DEFAULT_APP_TITLE}`;
        } else if (actionPrefix) {
            nextTitle = `${actionPrefix} | ${DEFAULT_APP_TITLE}`;
        } else if (game?.title) {
            nextTitle = `${game.title} | ${DEFAULT_APP_TITLE}`;
        }

        if (document.title !== nextTitle) {
            document.title = nextTitle;
        }
    }, [game?.title, router.pathname]);

    const stateValue = useMemo(() => ({
        account: optimisticAccount ?? localAccount,
        editMode,
        game,
        gamePermissions,
        versionList,
        version,
        session,
        loading,
        globalTemporaryState,
        accessToken,

        switchGameByUrl,
        refreshGameVersionList,
        updateVersion,
        switchVersionByName,
        updateSignedInAccount,
        updateSession,
        switchSessionID,
        navigateTo,
        setAccountPreference,
        updateGlobalTemporaryStateSetting,
        startNewGameSession,
        setEditMode,
        refreshAccessToken,
        forceAccountRefresh,
        accountHasRole,
        hasServicePerms,
    }), [
        accountHasRole,
        accessToken,
        editMode,
        forceAccountRefresh,
        game,
        gamePermissions,
        globalTemporaryState,
        hasServicePerms,
        loading,
        localAccount,
        navigateTo,
        optimisticAccount,
        refreshAccessToken,
        refreshGameVersionList,
        setAccountPreference,
        setEditMode,
        startNewGameSession,
        switchGameByUrl,
        switchSessionID,
        switchVersionByName,
        updateGlobalTemporaryStateSetting,
        updateSession,
        updateSignedInAccount,
        updateVersion,
        version,
        versionList,
        session,
    ]);

    return stateValue;
}
