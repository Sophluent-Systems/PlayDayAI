import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import ChatBotView from './chatbotview';
import { useRouter, useSearchParams } from 'next/navigation';
import { callGetMostRecentSave, callStateMachineContinuationRequest } from '@src/client/gameplay';
import { callRetryRecord } from '@src/client/editor';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { buildWebsocketUrl } from '@src/client/utils/wsUrl';
import { useConfig } from '@src/client/configprovider';
import { callSubmitMessageRating } from '@src/client/responseratings';
import { callGetRecordResultField } from '@src/client/editor';
import TextPreviewModal from './standard/textpreviewmodal';
import { useAlert } from './standard/useAlert';
import { normalizeTheme } from '@src/common/theme';
import { stateManager } from '@src/client/statemanager';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { useMessagesClient } from '../messagesClient';
import { callStateMachineHaltRequest } from '@src/client/gameplay';
import { FilteredMessageList } from './filteredmessagelist';
import { analyticsReportEvent} from "@src/client/analytics";
import { AudioManager } from '@src/client/audiomanager'
import { EditorPreferencesCheck } from '@src/client/components/editorpreferencescheck';

const reconnectThresholds = [
  {threshold: 10, delay: 1000}, // 1 sec
  {threshold: 20, delay: 5000},  // 5 sec
  {threshold: 30, delay: 100000}, // 1 min
  {threshold: 40, delay: 1000000}, // 10 min
]


function ChatBot(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { url, title, theme } = props;
  const {
    account,
    game,
    version,
    session,
    editMode,
    gamePermissions,
    refreshAccessToken,
    startNewGameSession,
    switchSessionID,
    accessToken,
  } = React.useContext(stateManager);
  const activeGameID = game?.gameID;
  const sessionIDFromParams = searchParams?.get('sessionID') ?? undefined;
  const versionName = searchParams?.get('versionName') ?? undefined;
  const sessionID = sessionIDFromParams ?? session?.sessionID ?? undefined;
  const loadedSessionID = useRef(null);
  const [processingUnderway, setProcessingUnderway] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const isReloadingRef = useRef(false);
  const [retryTimeout, setRetryTimeout] = useState(null);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [docPreviewText, setDocPreviewText] = useState("");
  const [maximumInputLength, setMaximumInputLength] = useState(Constants.defaults.userTokenLimit);
  const [conversational, setConversational] = useState(false);
  const [inputNodeInstanceID, setInputNodeInstanceID] = useState(null);
  const [scrollingMode, setScrollingMode] = useState(Constants.defaultScrollingMode);
  const stateMachineWebsocket = useRef(null);
  const preferredWsOptionsRef = useRef(null);
  const [supportedMediaTypes, setSupportedMediaTypes] = useState([]);
  const [supportedInputModes, setSupportedInputModes] = useState([]);
  const autoSendAudioOnSpeechEnd = Constants.audioRecordingDefaults?.autoSendOnSpeechEnd !== false;
  const scrollRef = useRef(null);
  const showAlert = useAlert();
  const themeToUse = useMemo(() => normalizeTheme(theme), [theme]);
  const messageClientSubscriptionRef = useRef(null);
  const messageUpdateHandlers = {
      replaceMessageList: (newMessages) => {
          if (scrollingMode == 'lineByLine' || scrollingMode == 'messageComplete') {
            scrollToBottom();
          }
      },
      newMessage: (message) => {
          if (scrollingMode == 'lineByLine') {
            scrollToBottom();
          }
      }, 
      updateMessage: (message) => {
          if (scrollingMode == 'lineByLine') {
            scrollToBottom();
          }
      },
      messageComplete: (message) => {
          if (scrollingMode == 'lineByLine' || scrollingMode == 'messageComplete') {
            scrollToBottom();
          }
      },
 };
 const { messages, subscribeMessageClient, clearMessageHistory, removeMessagesByRecordIDs } = useMessagesClient({handlers: messageUpdateHandlers, sessionID, autoConnect: false});
 const reconnectAttemptsRef = useRef(0);
 const reconnectUnderwayRef = useRef(false);
 const [supportsSuggestions, setSupportsSuggestions] = useState(false);
 const [audioState, setAudioState] = useState({});
 const audioControllerRef = useRef(null);
 const audioManagerRef = useRef(null);
 const debugSettings = editMode ? account.preferences?.debugSettings : null;
 const [messageFilter, setMessageFilter] = useState(Constants.defaultMessageFilter);

 function onAudioStateChange(newAudioState) {
    setAudioState(newAudioState);
 }

  useEffect(() => {
    const handleBeforeUnload = () => {
      Constants.debug.logSessionRestart && console.log("########################")
      Constants.debug.logSessionRestart && console.log("RELOADING");
      Constants.debug.logSessionRestart && console.log("########################")
      isReloadingRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    audioManagerRef.current = new AudioManager({onAudioStateChange});
    audioManagerRef.current.initialize({controller: audioControllerRef.current})

    Constants.debug.logAudioPlayback && console.log("ChatBot: useEffect navigator.audioSession=", navigator?.audioSession ? "exists" : "null");
    if (navigator && navigator.audioSession) {  
      Constants.debug.logAudioPlayback && console.log("ChatBot: registering audioSession state change handler");
      navigator.audioSession.onstatechange = () => {
        audioManagerRef.current.onAudioSessionStateChange(navigator.audioSession.state);
      }
    }

    return () => {
      // Clean up the event listener when the component is unmounted
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty dependency array means this effect runs once on mount and cleans up on unmount


  useEffect(() => {
    return () => {
      if (typeof messageClientSubscriptionRef.current === 'function') {
        messageClientSubscriptionRef.current();
        messageClientSubscriptionRef.current = null;
      }
      if (stateMachineWebsocket.current) {
        stateMachineWebsocket.current.close();
        stateMachineWebsocket.current = null;
      }
    };
  }, []);


  useEffect(() => {
    let timeoutId;

    // If retryTimeout is not null, not undefined, and not 0, set a timer
    if (retryTimeout) {
      console.log("retrying in ", retryTimeout, "ms");
      timeoutId = setTimeout(() => {
        console.log("Attemptying retry now...");
        sendContinuationRequest();
        setRetryTimeout(null);
      }, retryTimeout);
    }
  
    // Clear the timeout if the component unmounts or if retryTimeout changes
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [retryTimeout]);

  useEffect(() => {
    Constants.debug.logSessionRestart && console.log("ChatBot: useEffect sessionID=", sessionID);
    if (versionName && !sessionID && activeGameID) {
      findOrCreateGameSession();
    }
  }, [versionName, sessionID, activeGameID]);

  useEffect(() => {
    if (account) {
      
      const defaultFilters = [...Constants.defaultMessageFilter];

      if (!editMode) {
        setMessageFilter(defaultFilters);
      } else {
        setMessageFilter(account.preferences?.debugSettings ? account.preferences.debugSettings.messageFilters : defaultFilters);
      }
    }
  }, [account, editMode]);

  function updateFeatureSupports(versionInfo) {
    let supportsSuggestions = false;
    if (versionInfo?.stateMachineDescription?.nodes) {
      for (let j=0; j<versionInfo.stateMachineDescription.nodes.length; j++) {
        if (versionInfo.stateMachineDescription.nodes[j].nodeType == 'suggestions') {
          supportsSuggestions = true;
          break;
        }
      }
    }
    setSupportsSuggestions(supportsSuggestions);
  }

  function resetMediaPlaybackState() {
    audioManagerRef.current = new AudioManager({onAudioStateChange});
    audioManagerRef.current.initialize({controller: audioControllerRef.current, navigator})
  }

  useEffect(() => {    
    if (game && sessionID && session) {
      if (session.sessionID != loadedSessionID.current) {
        loadedSessionID.current = session.sessionID;
        subscribeForStateMachineUpdates().catch((error) => {
          console.warn("subscribeForStateMachineUpdates failed during session load", error);
        });

        resetMediaPlaybackState();

        analyticsReportEvent('play_session', {
          event_category: 'App',
          event_label: 'Play session',
          gameID: game?.gameID,    // Unique identifier for the game
          versionID: version?.versionID,  // Version of the game being played
          sessionID: session.sessionID   // Identifier for the user session
        });
      }
    } else if (!session || !sessionID) {
      loadedSessionID.current = null;
    }
  }, [game, version, session, sessionID]);


  useEffect(() => {
    if (account) {
   
      if (!nullUndefinedOrEmpty(account.preferences?.scrollingMode)) {
        setScrollingMode(account.preferences.scrollingMode);
      }
    }
  }, [account]);

  useEffect(() => {
    audioManagerRef.current.updateMessageList(messages);
  }, [messages]);


  function scrollToBottom() {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
         scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
  };
  
  async function findOrCreateGameSession() {

    try {
      if (!activeGameID) {
        console.warn('findOrCreateGameSession called without an active game');
        return;
      }

      const gameSaveSessionInfo = await callGetMostRecentSave(null, activeGameID, versionName);

      const savedSessionID = gameSaveSessionInfo?.session?.sessionID;
      Constants.debug.logSessionRestart && console.log("findOrCreateGameSession - previous SessionID=", savedSessionID);
      
      clearMessageHistory();

      if (savedSessionID) {
        //
        // Load the session we have
        //
        await switchSessionID(savedSessionID, activeGameID);
      } else {
        //
        // Start a new game session
        //
        await startNewGameSession();
      } 

    } catch (error) {
      console.log("error, ", error)
      showAlert(
        "Error loading game",
        error,
        account.preferences?.editMode ?
       [
            { text: "Go home", onPress: () => router.push("/") },
            { text: "Ignore", onPress: () => {} },
            { text: "Restart game", onPress: () => startNewGameSession()}
       ] 
       :
       // not edit mode
       [
          { text: "OK", onPress: () => router.push("/") }
       ]
      );
    }
  }


  function RetryOnError(timeout) {
    setProcessingUnderway(true);
    setRetryTimeout(timeout);
  }

  async function onHaltRequest() {
    await callStateMachineHaltRequest(sessionID);
  }

  async function sendContinuationRequest(ignoreSingleStepSetting = false) {
    if (isReloadingRef.current) {
      // nevermind
      return;
    }
    if (nullUndefinedOrEmpty(sessionID)) {
      console.error("sendContinuationRequest: sessionID is null or undefined", (new Error()).stack);
      throw new Error("sendContinuationRequest: sessionID is null or undefined");
    }
    const singleStep = ignoreSingleStepSetting ? false : (account.preferences?.debugSettings?.singleStep ? account.preferences.debugSettings.singleStep : false);
    console.log("sendContinuationRequest SingleStep: ", singleStep);
    if (!stateMachineWebsocket.current) {
      throw new Error("sendContinuationRequest: websocket connection not established");
    }
    try {
      await stateMachineWebsocket.current.sendCommand("command", {
        type: "continuation",
        accessToken,
        payload: {
          sessionID,
          singleStep,
        },
      });
    } catch (error) {
      console.error("Error sending continuation request over WebSocket: ", error);
      try {
        const fallbackResult = await callStateMachineContinuationRequest(sessionID, {
          continuation: true,
          singleStep,
          forceReassign: true,
        });

        const websocketInfo = fallbackResult?.websocket;
        if (websocketInfo?.host) {
          preferredWsOptionsRef.current = {
            wsHost: websocketInfo.host,
            wsPort: websocketInfo.port ?? undefined,
            protocol: websocketInfo.protocol,
            path: websocketInfo.path,
          };
          attemptWebsocketReconnect();
        }

        return fallbackResult;
      } catch (fallbackError) {
        console.error("Fallback REST continuation request failed: ", fallbackError);
        throw fallbackError;
      }
    }
  }

  async function attemptWebsocketReconnect() {

    if (reconnectUnderwayRef.current) {
      console.log("Reconnect already underway, ignoring this request");
      return;
    }
    reconnectUnderwayRef.current = true;
    reconnectAttemptsRef.current++;
    stateMachineWebsocket.current = null;
    setConnectionStatus('disconnected');
    setWaitingForInput(false);
    setProcessingUnderway(false);
    let reconnectDelayMS = null;
    // find the reconnect thresholdthat applies
    for (let i=0; i<reconnectThresholds.length; i++) {
      if (reconnectAttemptsRef.current <= reconnectThresholds[i].threshold) {
        reconnectDelayMS = reconnectThresholds[i].delay;
        break;
      }
    }
    if (!reconnectDelayMS) {
      console.log('Max reconnection attempts reached, not attempting to reconnect.');
      return;
    }

    console.log("Setting reconnect timeout to ", reconnectDelayMS, "ms");

    // Attempt to reconnect if under the max attempts
    setTimeout(async () => {
      console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current})`);
      if (sessionID && session) {
        subscribeForStateMachineUpdates().then(() => {
          console.log("Reconnection attempt successful");
          reconnectUnderwayRef.current = false;
          reconnectAttemptsRef.current = 0;
        }).catch(err => {
          console.log('Reconnection attempt failed, will retry:', err);
          reconnectUnderwayRef.current = false;
          attemptWebsocketReconnect();
        });
      } else {
        console.log("Not attempting to reconnect because sessionID or session is null");
        reconnectUnderwayRef.current = false;
        reconnectAttemptsRef.current = 0;
      }
    }, reconnectDelayMS);
  }


  async function subscribeForStateMachineUpdates() {

      const commandHandlers = {
        "initcomplete": (command, data) => {
          setProcessingUnderway(false);
          sendContinuationRequest();
        },
        "error": (command, data) => {
          console.log("ERROR: ", data);
          showAlert(
            "Error playing turn",
            data,
            account.preferences?.editMode ?
          [
                { text: "Go home", onPress: () => router.push("/") },
                { text: "Ignore", onPress: () => {} },
                { text: "Restart game", onPress: () => startNewGameSession()}
          ] 
          :
          // not edit mode
          [
              { text: "OK", onPress: () => router.push("/") }
          ]
          );
        },
        "networkError": (command, data) => {
          console.log("Network error: ", data);
          if (!isReloadingRef.current) {
            console.log("Network error - retrying in ", Constants.config.clientFailureRetryTime, "ms");
            RetryOnError(Constants.config.clientFailureRetryTime);
          } else {
            console.log("Server volley ERROR \"", data, "\" but we're reloading so ignoring");
          }
        },
        "retry": (command, data) => {
          console.log("Retrying command, retrying in ", data, "ms");
          RetryOnError(data);
        },
        "authError": (command, data) => {
          console.log("Auth error: ", data, " ... refreshing access token.");
          refreshAccessToken();
        },
        "continuationAccepted": (command, data) => {
          Constants.debug.logTaskSystem && console.log("Continuation accepted", data);
        },
        "userInputAccepted": (command, data) => {
          if (data?.sessionID !== sessionID) {
            return;
          }
          Constants.debug.logTaskSystem && console.log("User input accepted", data);
        },
        "userInputError": (command, data) => {
          if (data?.sessionID !== sessionID) {
            return;
          }
          console.error("User input error", data);
          setWaitingForInput(true);
          showAlert(
            "Problem receiving input",
            data?.message || "The server was unable to accept your input. Please try again.",
            [
              { text: "OK", onPress: () => {} },
            ]
          );
        },
        "statemachinestatusupdate": (command, data) => {
          Constants.debug.logTaskSystem && console.log("statemachinestatusupdate received", data);
          if (typeof data?.state != 'string') {
            throw new Error("statemachinestatusupdate: data is not a string: " + JSON.stringify(data));
          }
          if (sessionID != data.sessionID) {
            Constants.debug.logTaskSystem && console.log("Ignoring state machine status update for sessionID ", data.sessionID, " - expected ", sessionID);
            return;
          }
          switch(data.state) {
            case "started":
              Constants.debug.logTaskSystem && console.log("State machine started: entering processing state");
              setProcessingUnderway(true);
              setSupportedInputModes([]);
            break;
            case "waitingForExternalInput":
              Constants.debug.logTaskSystem && console.log("State machine waiting for input", data);
              if (data.nodeInstanceID) {
                setSupportedMediaTypes(data.waitingFor);
                setSupportedInputModes(Array.isArray(data.supportedModes) ? data.supportedModes : []);
                setInputNodeInstanceID(data.nodeInstanceID);
                setWaitingForInput(true);
              } else {
                setInputNodeInstanceID(null);
                setSupportedInputModes([]);
              }
              Constants.debug.logTaskSystem && console.log("waitingForInput flag set to true for media types", data.waitingFor);
              if (data.waitingFor.includes("text")) {
                if (data.maximumInputLength) {
                  Constants.debug.logTaskSystem && console.log("Setting maximumInputLength", data.maximumInputLength);
                  setMaximumInputLength(data.maximumInputLength);
                }
              }
              if (data.waitingFor.includes("audio")) {
                Constants.debug.logTaskSystem && console.log("Setting conversational flag to", data.conversational === true);
                setConversational(data.conversational === true);
              }
              break;
            case "stopped":
              Constants.debug.logTaskSystem && console.log("State machine stopped; clearing processing flag");
              setProcessingUnderway(false);
              setSupportedInputModes([]);
              if (scrollingMode == 'lineByLine' || scrollingMode == 'messageComplete') {
                scrollToBottom();
              }
              break;
            case "error":
              console.error("statemachinestatusupdate errordetails:", data)
              setSupportedInputModes([]);
              showAlert(
                    "Error playing turn",
                    data?.errorDetails ? `Error: ${data.errorDetails.message}${ account.preferences?.editMode ? "\n\n" + data.errorDetails.stack : ''}` : "Unknown error",
                    account.preferences?.editMode ?
                    [
                          { text: "Go home", onPress: () => router.push("/") },
                          { text: "Ignore", onPress: () => {} },
                          { text: "Restart game", onPress: () => startNewGameSession()}
                    ] 
                    :
                    // not edit mode
                    [
                        { text: "OK", onPress: () => router.push("/") }
                    ]
                  );
              break;
            }
        },
      };

      const connectionCallbacks = {
        onStatusChange: (status) => {
          setConnectionStatus(status);
          if (status !== 'connected') {
            setWaitingForInput(false);
            setProcessingUnderway(false);
          }
        },
        onNetworkError: (error) => {
          console.warn("WebSockets Network error: ", error);
        },
        onClosed: () => {
          console.warn("WebSockets closed");
          if (!isReloadingRef.current) {
            console.log("WebSockets closed - request retry");
            attemptWebsocketReconnect();
          } else {
            console.log("WebSockets closed but we're reloading so ignoring");
          }
        },
      };
        
      let websocket = stateMachineWebsocket.current;
      const newConnection = nullUndefinedOrEmpty(websocket);
      if (!newConnection) {
        console.log("Attempted to subscribe for state machine updates while already subscribed -- reusing connection");
        const existingStatus = websocket.connectionStatus ?? 'disconnected';
        setConnectionStatus(existingStatus);
        if (existingStatus !== 'connected') {
          setWaitingForInput(false);
          setProcessingUnderway(false);
        }
      } else {
        websocket = new WebSocketChannel();
        stateMachineWebsocket.current = websocket;
      }

      //
      // Set all callbacks
      //
      websocket.subscribe(commandHandlers);
      if (typeof messageClientSubscriptionRef.current === 'function') {
        messageClientSubscriptionRef.current();
      }
      const unsubscribe = subscribeMessageClient(websocket);
      messageClientSubscriptionRef.current = typeof unsubscribe === 'function' ? unsubscribe : null;
      websocket.setConnectionCallbacks(connectionCallbacks);

      if (newConnection) {
        const wsOptions = preferredWsOptionsRef.current ? {
          wsHost: preferredWsOptionsRef.current.wsHost,
          wsPort: preferredWsOptionsRef.current.wsPort,
          protocol: preferredWsOptionsRef.current.protocol,
          path: preferredWsOptionsRef.current.path,
        } : {};

        const url = buildWebsocketUrl(wsOptions);
        if (typeof websocket.updateConnectionStatus === 'function') {
          websocket.updateConnectionStatus('connecting');
        } else {
          websocket.connectionStatus = 'connecting';
        }
        setConnectionStatus('connecting');
        await websocket.connect({url});
        console.log("Connected to: ", url)
      }

      // Assume this process will kick the state machine into action
      // until we hear otherwise
      setProcessingUnderway(true);

      if (stateMachineWebsocket.current !== websocket) {
        setProcessingUnderway(false);
        const error = new Error("State machine websocket replaced before initialization completed");
        if (!reconnectUnderwayRef.current) {
          attemptWebsocketReconnect();
        }
        throw error;
      }

      if (websocket.connectionStatus !== 'connected') {
        setProcessingUnderway(false);
        const error = new Error(`State machine websocket not connected (status: ${websocket.connectionStatus})`);
        if (!reconnectUnderwayRef.current) {
          attemptWebsocketReconnect();
        }
        throw error;
      }

      try {
        await websocket.sendCommand("command", {
          type: "initializeConnection",
          accessToken: accessToken,
          payload: { sessionID: sessionID, gameID: game?.gameID },
        });
      } catch (error) {
        console.error("failed to send init command", error);
        setProcessingUnderway(false);
        throw error;
      }
}

const onRequestAudioControl = (action, playerInstance, params) => {
  audioManagerRef.current.requestAudioControl(action, playerInstance, params);
}

const handleAudioStateChange = (audioType, newState) => {
  audioManagerRef.current.handleAudioStateChange(audioType, newState);
}

  const useWebsocketInputTransport = Constants.config?.inputTransport?.websocketEnabled === true;

  const blobToBase64 = async (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.substring(commaIndex + 1) : result);
    };
    reader.onerror = (event) => reject(event?.target?.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });

  const serializeMediaTypesForWebsocket = async (mediaTypes) => {
    const entries = Object.entries(mediaTypes ?? {});
    const result = {};

    for (const [type, info] of entries) {
      if (!info) {
        continue;
      }

      if (info.source === 'blob' && info.data instanceof Blob) {
        const base64Data = await blobToBase64(info.data);
        result[type] = {
          mimeType: info.mimeType,
          data: base64Data,
          source: 'base64',
        };
      } else {
        result[type] = { ...info };
      }
    }

    return result;
  };

  const sendUserInputOverWebsocket = async (mediaTypes, mode) => {
    if (!stateMachineWebsocket.current) {
      throw new Error('WebSocket connection not established');
    }

    const serialized = await serializeMediaTypesForWebsocket(mediaTypes);
    const payload = {
      sessionID,
      nodeInstanceID: inputNodeInstanceID,
      mediaTypes: serialized,
    };

    if (mode) {
      payload.inputMode = mode;
    }

    await stateMachineWebsocket.current.sendCommand("command", {
      type: "userInput",
      accessToken,
      payload,
    });
  };

  const sendMessage = async (mediaTypes, options = {}) => {
    if (!waitingForInput) {
      console.warn("sendMessage called while not waiting for input; ignoring request.");
      return;
    }
    if (connectionStatus !== 'connected') {
      console.warn(`sendMessage called while websocket status is ${connectionStatus}; ignoring request.`);
      return;
    }
    if (!inputNodeInstanceID) {
      console.warn("sendMessage called without a pending nodeInstanceID; ignoring request.");
      return;
    }

    setWaitingForInput(false);
    let inputMode = options.mode;
    if (!inputMode) {
      if (mediaTypes?.audio) {
        inputMode = supportedInputModes.includes('stt') ? 'stt' : 'audio';
      } else if (supportedInputModes.includes('text')) {
        inputMode = 'text';
      } else {
        inputMode = null;
      }
    }

    if (!useWebsocketInputTransport) {
      console.error("WebSocket input transport is disabled; unable to send user input.");
      setWaitingForInput(true);
      showAlert(
        "Unable to send input",
        "Realtime input transport is disabled for this session. Please enable WebSocket input support."
      );
      return;
    }

    try {
      await sendUserInputOverWebsocket(mediaTypes, inputMode);
    } catch (error) {
      console.error("Failed to send user input over websocket", error);
      setWaitingForInput(true);
      showAlert(
        "Unable to send input",
        error?.message || "The server could not accept this input. Please try again."
      );
      return;
    }

    await sendContinuationRequest();
  }

  async function handleResponseFeedback(params) {
    const {
      recordID,
      isPlayerRating,
      rating
    } = params;

    try {
      let result =  await callSubmitMessageRating(sessionID, recordID, isPlayerRating ? rating : undefined, !isPlayerRating ? rating : undefined);
      // Messages will be updated async via websockets
    } catch (error) { 
      console.warn("Error submitting rating: " + error.message);
    }
  }

  async function showRecordResultFields(props) {
     const { recordID, fields, label } = props;
     let text = await callGetRecordResultField(sessionID, recordID, fields);
     if (typeof text == 'object') {
        if (Array.isArray(text)) {
          text = text.join("\n");
        } else {
          text = JSON.stringify(text, null, 2);
        }
     }
     if (text) {
      const screenReadyText = text.replace(/\\n/gi, '\n'); 
      setDocPreviewText(label + "\n\n" + screenReadyText);
      setIsDocPreviewOpen(true);
     }
  }


  async function handleCardActionSelected(action, props) {
    console.log("handleCardActionSelected - ", action);
    switch(action) {
      case "suggestion":
        const { suggestion } = props;
        console.log("handleCardActionSelected ", suggestion);
        return sendMessage({
          "text": {
            data: suggestion, 
            mimeType: "text",
            source: "blob",
          }
        });
      case "showRecordResultFields":
        return await showRecordResultFields(props);
      case "responseFeedback":
        return await handleResponseFeedback(props);
    }
  }

  async function handleMessageDelete(index) {
      console.log("handleMessageDelete ", index)

      try {

        const message = messages[index];
        if (!message?.recordID) {
          console.warn("handleMessageDelete: unable to determine recordID for message at index", index);
          return;
        }
        const retryResponse = await callRetryRecord(sessionID, message.recordID, account.preferences?.debugSettings?.singleStep ? account.preferences.debugSettings.singleStep : false);

        const deletedRecordIDs = Array.isArray(retryResponse?.recordIDsDeleted)
          ? retryResponse.recordIDsDeleted.filter((recordID) => recordID !== null && recordID !== undefined)
          : [];
        if (deletedRecordIDs.length && typeof removeMessagesByRecordIDs === 'function') {
          const { changed } = removeMessagesByRecordIDs(deletedRecordIDs);
          if (changed) {
            scrollToBottom();
          }
        }

        const retryWsInfo = retryResponse?.websocket;
        if (retryWsInfo?.host) {
          preferredWsOptionsRef.current = {
            wsHost: retryWsInfo.host,
            wsPort: retryWsInfo.port ?? undefined,
            protocol: retryWsInfo.protocol,
            path: retryWsInfo.path,
          };
          if (!stateMachineWebsocket.current || stateMachineWebsocket.current.connectionStatus !== 'connected') {
            attemptWebsocketReconnect();
          }
        }
      } catch (err) {

          console.log("error deleting message(s): ", err.message, err.stack);
          alert("Error deleting message(s): " + err.message);
          return;
      };

  }

  function renderWithFormatting(children) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center px-6"
        style={{ backgroundColor: themeToUse.colors.messagesAreaBackgroundColor }}
      >
        <div className="max-w-lg rounded-3xl border border-white/15 bg-white/5 px-10 py-12 text-center text-sm text-white/90 shadow-2xl backdrop-blur-2xl">
          {children}
        </div>
      </div>
    );
  }

  const onDebugSingleStep = () => {
    console.log("onDebugSingleStep");
    sendContinuationRequest();
  }

  const onToggleSingleStep = (value) => {
    console.log("onToggleSingleStep ", value);

    if (value) {
      //
      // If we turn on single step debugging, pause execution
      //
      onHaltRequest();
    } else {
      //
      // If we turn off single step debugging, begin executing like normal
      //
      sendContinuationRequest(true);
    }
  }


  const handleRequestStateChange = async (state) => {
    console.log("handleRequestStateChange ", state);
    if (connectionStatus !== 'connected') {
      console.warn(`handleRequestStateChange ignored because websocket status is ${connectionStatus}`);
      return;
    }

    switch(state) {
      case "play":
        sendContinuationRequest();
        break;
      case "pause":
        onHaltRequest();
        break;
      case "restart":
        startNewGameSession();
        break;
    }
  }

  function renderSlowServerWarning() {
    if (messages.length == 0) {
      return (<React.Fragment />);
    }

    // See if any recent messages fit the criteria

    const slowServerThreshold = 30 * 1000; 

    let mostRecentExecutionTime = undefined;
    let mostRecentMessageWithExecutionTime = undefined;
    for (let i = messages.length-1; i >= 0; i--) {
      const message = messages[i];
      const elapsedTimeSinceMessage = new Date() - new Date(message.timestamp);

      // If more than 15 mins ago then we're done
      if (elapsedTimeSinceMessage > (15 * 60 * 1000)) {
        break;
      }

      // Check to see if there is execution time, and it's higher than
      // the threshold
      if (typeof message.executionTime !== 'undefined' && 
          message.executionTime > slowServerThreshold) {

            mostRecentExecutionTime = message.executionTime;
            mostRecentMessageWithExecutionTime = message;
        break;
      }
    }
    
    // if executionTime isn't define, then we can't tell if the server is slow
    if (typeof mostRecentExecutionTime === 'undefined' || typeof mostRecentMessageWithExecutionTime === 'undefined') {
      return (<React.Fragment />);
    }

    return (
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.35em] text-amber-200 shadow-inner">
        The AI is responding slowly to PlayDay's requests.
      </div>
    );
  }  const versionString = version?.versionName ? `Version: ${version.versionName}` : ``;

  if (!session) {
    return renderWithFormatting(<h1>Loading</h1>);
  } else {

    return (
    <React.Fragment key={sessionID}>
          <ChatBotView   
              key={sessionID}
              url={url}
              title={title}
              onSendMessage={sendMessage} 
              onHaltRequest={onHaltRequest}
              waitingForProcessingToComplete={processingUnderway}
              waitingForInput={waitingForInput}
              connectionStatus={connectionStatus}
              theme={themeToUse}
              inputLength={maximumInputLength}
              conversational={conversational}
              autoSendAudioOnSpeechEnd={autoSendAudioOnSpeechEnd}
              editMode={editMode && gamePermissions && gamePermissions.includes('game_edit')}
              supportsSuggestions={supportsSuggestions}
              supportedMediaTypes={supportedMediaTypes}
              supportedInputModes={supportedInputModes}
              audioState={audioState}
              processingUnderway={processingUnderway}
              onRequestStateChange={handleRequestStateChange}
              sessionID={sessionID}
              onGetAudioController={(controller) => audioControllerRef.current = controller}
              onAudioStateChange={handleAudioStateChange}
              debugSettings={debugSettings}
              onDebugSingleStep={onDebugSingleStep}
              onToggleSingleStep={onToggleSingleStep}
          >

                    <FilteredMessageList
                        key={sessionID}
                        theme={themeToUse}
                        messages={messages}
                        responseFeedbackMode={{user: "edit", admin: null}}
                        waitingForProcessingToComplete={processingUnderway}
                        onMessageDelete={handleMessageDelete}
                        editMode={editMode && gamePermissions && gamePermissions.includes('game_edit')}
                        onCardActionSelected={handleCardActionSelected}
                        sessionID={sessionID}
                        onRequestAudioControl={onRequestAudioControl}
                        onDebugSingleStep={onDebugSingleStep}
                        onToggleSingleStep={onToggleSingleStep}
                        playbackState={audioState}
                        showHidden={editMode && debugSettings?.showHidden}
                    />

                    {renderSlowServerWarning()}

                    {versionString && (
                      <span
                        className='self-end pr-5 text-[10px] uppercase tracking-[0.35em]'
                        style={{ color: themeToUse.colors.inputTextDisabledColor }}
                      >
                        {versionString}
                      </span>
                    )}

                    <div ref={scrollRef} />
          </ChatBotView>
          <TextPreviewModal isOpen={isDocPreviewOpen} text={docPreviewText} onClose={() => setIsDocPreviewOpen(false)} />  
          <EditorPreferencesCheck />
        </React.Fragment>
    );
  }
}






export default memo(ChatBot);
