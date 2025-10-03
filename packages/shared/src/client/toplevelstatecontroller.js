'use client';


import { useLegacyRouter } from '@src/client/useLegacyRouter';
import { useState, useEffect, useRef } from 'react';
import { callListGameVersions, callGetVersionInfoForEdit } from '@src/client/editor';
import { callgetGameInfoByUrl, callGetSessionInfo } from '@src/client/gameplay';
import { account, editModeState, gameState, versionListState, versionState, sessionState, loadingState, globalTemporaryStateState, accessTokenState, optimisticAccountState } from '@src/client/states';
import { useAtom } from 'jotai';
import { defaultAppTheme } from '@src/common/theme';
import { callGetAccountInfo, callUpdateAccountInfo } from '@src/client/account';
import { callGetAccountPermissionsForGame } from '@src/client/permissions';
import { useUser } from "@src/client/auth";
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { callStartNewGame } from '@src/client/gameplay';
import { useConfig } from '@src/client/configprovider';
import { analyticsReportEvent} from "@src/client/analytics";
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


export function topLevelStateController(props) {
    const { Constants } = useConfig();
    const router = useLegacyRouter();
    const redirectToAuthRoute = (path) => {
        const target = path.startsWith('/') ? path : `/${path}`;
        if (typeof window !== 'undefined') {
            window.location.href = target;
        } else {
            router.push(target);
        }
    };

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

      async function updatePermissionsForGame(gameID) {
        Constants.debug.logPermissions && console.log("updatePermissionsForGame: ", gameID, localAccount?.accountID)
        if (localAccount && gameID) {
            const newGamePermissions = await callGetAccountPermissionsForGame(localAccount.accountID, gameID);
            setGamePermissions(newGamePermissions);
        }
    }    
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

    const accountHasRole = (role) => {
        if (nullUndefinedOrEmpty(role)) {
            throw new Error("Empy role supplied to hasRole");
        }

        return localAccount && localAccount.roles?.userRoles?.includes(role);
    }

    const hasServicePerms = (permissions) => {

        if (nullUndefinedOrEmpty(permissions)) {
            throw new Error("Empy permissions supplied to hasServicePermissions");
        }

        return localAccount && localAccount.roles?.servicePermissions?.includes(permissions);
    }

    useEffect(() => {
        if (game && localAccount) {
            updatePermissionsForGame(game.gameID);
        }
        if (localAccount) {
            let newEditMode = hasServicePerms("service_editMode") && localAccount?.preferences?.editMode;
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
    }, [game, localAccount]);

    if (accountQuery.isLoading != accountLoading) { 
        setAccountLoading(accountQuery.isLoading);
    }

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

    async function updateGameInfo(forceRefresh=false) {
        Constants.debug.logStateManager && console.log("updateGameInfo: ", gameUrl, game, forceRefresh);
        if (forceRefresh || gameUrl != game?.url) {
            try {
                let data = null;
                if (gameUrl) {
                    data = await callgetGameInfoByUrl(gameUrl, "play"); 
                }
                setGame(data);
                if (data) {
                    const gameInfo = {...data};
                    if (!gameInfo.theme) {
                        gameInfo.theme = defaultAppTheme;
                    }
                    updatePermissionsForGame(gameInfo.gameID)
                    refreshGameVersionList(gameInfo.gameID);
                    //
                    // Ensure the version and session match the game
                    //
                    let newVersionName = versionName;
                    let newSessionID = sessionID;
                    if (version && (version.gameID != gameInfo.gameID)) {
                        newVersionName = null;
                    } 
                    if (session && (!newVersionName || (session.versionInfo?.versionID != version.versionID))) {
                        newSessionID = null;
                    }
                    if (newVersionName != versionName || newSessionID != sessionID) {
                        Constants.debug.logStateManager && console.log("updateGameInfo: newVersionName=", newVersionName, " versionName=", versionName, " newSessionID=", newSessionID, " sessionID=", sessionID, " session.versionID=", session?.versionID, " version.versionID=", version?.versionID)
                        Constants.debug.logStateManager && console.log("updateGameInfo: switching version/session: ", newVersionName, newSessionID)
                        updateUrl({ newVersionName: newVersionName, newSessionID: newSessionID });
                    }
                }
            } catch (error) {
                console.error('Error fetching game info:', error);
                router.replace('/');
            };
      } else {
        Constants.debug.logStateManager && console.log("switchGameByUrl: no change")
      }
    }

    async function switchGameByUrl(newGameUrl, forceRefresh=false) {
        Constants.debug.logStateManager && console.log("switchGameByUrl: ", gameUrl, game, forceRefresh);
        if (newGameUrl != game?.url) {
            updateUrl({ newGameUrl: newGameUrl, newVersionName: null, newSessionID: null });
        }
    }

    async function refreshGameVersionList(gameID=undefined) {   
        Constants.debug.logStateManager && console.log("refreshGameVersionList: gameID=", gameID, " editMode=", editMode);
        if (gameID || game) {
            try {

                const newVersionList = await callListGameVersions(gameID ? gameID : game.gameID, null, false);
                setVersionList(newVersionList);   
                return newVersionList;
            } catch (error) {
                console.error('Error fetching game versions:', error);
            }
        } else {
            setVersionList();
            return null;
        }
    }

    async function updateVersion(forceRefresh=false, gameID=null) {
        Constants.debug.logStateManager && console.log("updateVersion name=", versionName);
        const gameIDtoUse = gameID ? gameID : game?.gameID;
        if (gameIDtoUse) {
            let currentVersionList = versionList;
            if (forceRefresh) {
                currentVersionList = await refreshGameVersionList(gameIDtoUse);
                if (!currentVersionList) {
                    router.push('/');
                }
            }
            if (versionName) {
                let newVersion = null;
                if (editMode) {
                    newVersion = await callGetVersionInfoForEdit(gameIDtoUse, versionName);
                } else {
                    newVersion = currentVersionList.find(v => v.versionName === versionName);
                }
                setVersion(newVersion);
            } else {
                setVersion(null);
            }
        } 
    }

    async function switchVersionByName(newVersionName, gameID=null) {
        Constants.debug.logStateManager && console.log("switchVersionByName: ", newVersionName, gameID);
        if (newVersionName != version?.versionName) {
            updateUrl({ newVersionName: newVersionName, newSessionID: null });
        }
    }

    function updateSignedInAccount(newAccount) { 
        Constants.debug.logStateManager && console.log("updateSignedInAccount ", newAccount?.accountID)
        setOptimisticAccount(newAccount);
        debouncedUpdateAccount(newAccount);
    }

    async function updateSession(gameID=undefined) {
        Constants.debug.logStateManager && console.log("updateSession id=", sessionID, " gameID=", gameID);
        let newSession = null;
        if (sessionID) {
            newSession = await callGetSessionInfo(gameID ? gameID : game?.gameID, sessionID);
        } else {
            Constants.debug.logStateManager && console.log("updateSession: no sessionID: ", typeof sessionID);
        }
        if (sessionID != session?.sessionID || session?.latestUpdate != newSession?.latestUpdate) {
            Constants.debug.logStateManager && console.log("updateSession: newSession=", newSession)
            setSession(newSession?.session ? newSession.session : null);
        } else {
            Constants.debug.logStateManager && console.log("updateSession: no change - same timestamp")
        }
    }

    async function switchSessionID(newSessionID, gameID=undefined) {
        Constants.debug.logStateManager && console.log("switchSessionID: ", newSessionID, gameID);
        if (newSessionID != sessionID) {
            updateUrl({ newSessionID: newSessionID });
        }
    }

    async function startNewGameSession(url=null, versionOverride=null) {
        Constants.debug.logStateManager && console.log("startNewGameSession: ", url, versionName, versionOverride);
        const urlToUse = url ? url : game?.url;
        const versionToUse = versionOverride ?? versionName ?? version?.versionName;

        console.log("Starting new game for version=", versionToUse);

        let newSession;
        try {
            newSession = await callStartNewGame(urlToUse, versionToUse);
        } catch (error) {
            console.error('Error starting new game session:', error);
        };

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
            sessionID: newSession.sessionID
          });

        return newSession;
    }

    function updateUrl(props) {
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
    }

    function navigateTo(relativeUrl, newGameUrl=undefined, clearParams=false) {
        Constants.debug.logStateManager && console.log("navigateTo: ", relativeUrl, newGameUrl, clearParams)
        let params = {
            navigationPath: relativeUrl, 
            mode: "push", 
        }
        if (clearParams) {
            params.newGameUrl = null;
            params.newVersionName = null;
            params.newSessionID = null;
        }
        if (typeof newGameUrl !== "undefined") {
            params.newGameUrl = newGameUrl;
        }
        updateUrl(params);
    }

    function setAccountPreference(key, value) {
      Constants.debug.logStateManager && console.log("setAccountPreference: ", key, value)
      if (!localAccount) {
        return;
      }
      const nextPreferences = { ...(localAccount.preferences || {}) };
      nextPreferences[key] = value;
      const newAccount = { ...localAccount, preferences: nextPreferences };
      setOptimisticAccount(newAccount);
      debouncedUpdateAccount(newAccount);
    }

    function updateGlobalTemporaryStateSetting(key, value) {
        let newGlobalTemporaryState = {...globalTemporaryState};
        newGlobalTemporaryState[key] = value;
        setGlobalTemporaryState(newGlobalTemporaryState);
    }

    function refreshAccessToken(forceLogin=false) {
        Constants.debug.logStateManager && console.log("refreshAccessToken")
        redirectToAuthRoute(`/auth/login?returnTo=${encodeURIComponent(router.asPath)}`);
    }


    async function forceAccountRefresh() {
        await accountQuery.refetch();
    }

    useEffect(() => {
        // Don't update any account info until at least a stub's been created
        // on the server
        Constants.debug.logStateManager && console.log("useEffect[account] account==null", localAccount==null, " accountQuery.isFetched=", accountQuery.isFetched)
        
        if (localAccount) {
            analyticsReportEvent('set_user_id', { user_id: localAccount.accountID });
        }

    }, [localAccount]);

    
    useEffect(() => {
        const handleRouteChangeStart = (url) => {
            Constants.debug.logStateManager && console.log(`=================> Route change to ${url} started`);
          routeChangeUnderwayRef.current = true;
          // You can set some state here to indicate loading is true
        };
    
        const handleRouteChangeComplete = async (url) => {
            Constants.debug.logStateManager && console.log(`<================ Route change to ${url} completed`);
            routeChangeUnderwayRef.current = false;
            // 
            // If no change in game, version, or session, then refresh the data to
            // make sure nothing changed under the covers
            //
            console.log("+++++++++++++ handleRouteChangeComplete router.isReady=", router.isReady)
        }
        
        const handleRouteChangeError = (error, url, shallow) => {
            console.log(`x=================x Route change to ${url} failed`);
            routeChangeUnderwayRef.current = false;
            // Handle the route change error (e.g., by setting error state or logging)
        };
    
        router.events.on('routeChangeStart', handleRouteChangeStart);
        router.events.on('routeChangeComplete', handleRouteChangeComplete);
        router.events.on('routeChangeError', handleRouteChangeError); // Assuming you want to stop loading on error too
    
        return () => {
          router.events.off('routeChangeStart', handleRouteChangeStart);
          router.events.off('routeChangeComplete', handleRouteChangeComplete);
          router.events.off('routeChangeError', handleRouteChangeError);
        };
      }, [router.events]);

    useEffect(() => {
        if (!gameDataLoading && !accountLoading) {
            loadingRef.current = false;
            setLoading(false);
        } else {
            loadingRef.current = true;
            setLoading(true);
        }
    }, [gameDataLoading, accountLoading]);

    useEffect(() => {
        if (!isSandbox) {
            if (!auth0.isLoading && !auth0.user) {
                refreshAccessToken(true);
            }
            if (!accountQuery.isLoading && accountQuery.status == "error") {
                // Construct the root URL
                redirectToAuthRoute(`/auth/logout?returnTo=${encodeURIComponent(process.env.APP_NEXT_PUBLIC_BASE_URL)}`);
            }
        }
    }, [auth0.isLoading, accountQuery.status]);

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
            Constants.debug.logStateManager && console.log("setGameDataLoading(false) 2");
            setGameDataLoading(false);
        } else if (!game || (game.url !== gameUrl)) {
            Constants.debug.logStateManager && console.log("SWITCHING GAME BY URL game=", game, " ==> gameUrl=", gameUrl);
            updateGameInfo();
        }
    }, [gameUrl, router.isReady, router.pathname, game]);
       

    useEffect(() => {
        refreshGameVersionList();
        
        updateGameInfo(true);
        
        if (!version && !versionName && !sessionID) {
            Constants.debug.logStateManager && console.log("setGameDataLoading(false) 3")
            setGameDataLoading(false);
        }
    }, [gameUrl, editMode]);

    useEffect(() => {
        Constants.debug.logStateManager && console.log("useEffect: [versionName] ", versionName, version?.versionName)
        async function doVersionLoad() {
            await updateVersion(true, gameUrl ? game?.gameID : null);
            if (!sessionID) {
                Constants.debug.logStateManager && console.log("setGameDataLoading(false) 4")
                setGameDataLoading(false);
            }
        }

        doVersionLoad();    
    }, [versionName, game]);

    useEffect(() => {
        Constants.debug.logStateManager && console.log("useEffect: [sessionID] ", sessionID, session?.sessionID)
        async function doSessionLoad() {
            await updateSession(gameUrl ? game?.gameID : null);
            
            Constants.debug.logStateManager && console.log("setGameDataLoading(false) 5")
            setGameDataLoading(false);
        }
        
        doSessionLoad();
    }, [sessionID, game]);

    return { 
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
      };
}
