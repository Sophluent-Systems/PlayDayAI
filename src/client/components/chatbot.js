import React, { useState, useEffect, useRef, memo } from 'react';
import ChatBotView from './chatbotview';
import { useRouter } from 'next/router';
import { callGetMostRecentSave } from '@src/client/gameplay';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { InfoBubble } from '@src/client/components/standard/infobubble';
import { callRetryRecord } from '@src/client/editor';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { useConfig } from '@src/client/configprovider';
import { callSubmitMessageRating } from '@src/client/responseratings';
import { callGetRecordResultField } from '@src/client/editor';
import TextPreviewModal from './standard/textpreviewmodal';
import { useAlert } from './standard/useAlert';
import { defaultAppTheme } from '@src/common/theme';
import { stateManager } from '@src/client/statemanager';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { callStateMachineContinuationRequest } from '@src/client/gameplay';
import { useMessagesClient } from '../messagesClient';
import { callSendInputData, callStateMachineHaltRequest } from '@src/client/gameplay';
import { FilteredMessageList } from './filteredmessagelist';
import { makeStyles } from "tss-react/mui";
import { 
  Typography,
} from '@mui/material';
import { analyticsReportEvent} from "@src/client/analytics";
import { useRecoilState } from 'recoil';
import { vhState, editorSaveRequestState, dirtyEditorState } from '@src/client/states';
import { AudioManager } from '@src/client/audiomanager'
import { EditorPreferencesCheck } from '@src/client/components/editorpreferencescheck';

const reconnectThresholds = [
  {threshold: 10, delay: 1000}, // 1 sec
  {threshold: 20, delay: 5000},  // 5 sec
  {threshold: 30, delay: 100000}, // 1 min
  {threshold: 40, delay: 1000000}, // 10 min
]

const useStyles = makeStyles()((theme, pageTheme) => {
  const { colors, fonts } = pageTheme;
  return {
    container: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    feedbackDescriptionText: {
      color: colors.chatbotMessageTextColor,
      fontFamily: fonts.fontFamily,
    },
    image: {
      width: "100%",
      height: "auto",
      maxHeight: "600px",
      maxWidth: "800px",
      objectFit: "contain",
    },
    spinnerBox: {
      width: "100%",
      height: "auto",
      maxHeight: "600px",
      maxWidth: "800px",
      objectFit: "contain",
      padding: 20,
    },
  };
});


function ChatBot(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { versionName, sessionID } = router.query;
  const { url, title, theme } = props;
  const { classes } = useStyles(theme);
  const { account, game, version, session, editMode, gamePermissions,refreshAccessToken, startNewGameSession,switchSessionID, accessToken } = React.useContext(stateManager);
  const loadedSessionID = useRef(null);
  const [processingUnderway, setProcessingUnderway] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const isReloadingRef = useRef(false);
  const [retryTimeout, setRetryTimeout] = useState(null);
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(false);
  const [docPreviewText, setDocPreviewText] = useState("");
  const [maximumInputLength, setMaximumInputLength] = useState(Constants.defaults.userTokenLimit);
  const [conversational, setConversational] = useState(false);
  const [inputNodeInstanceID, setInputNodeInstanceID] = useState(null);
  const [scrollingMode, setScrollingMode] = useState(Constants.defaultScrollingMode);
  const stateMachineWebsocket = useRef(null);
  const [editorSaveRequest, setEditorSaveRequest] = useRecoilState(editorSaveRequestState);
  const [dirtyEditor, setDirtyEditor] = useRecoilState(dirtyEditorState);
  const [supportedMediaTypes, setSupportedMediaTypes] = useState([]);
  const scrollRef = useRef(null);
  const showAlert = useAlert();
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
 const { messages, subscribeMessageClient, clearMessageHistory } = useMessagesClient({handlers: messageUpdateHandlers, sessionID});
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
        setRetryTimeout(null);
      }
    };
  }, [retryTimeout]); 

  useEffect(() => {
    Constants.debug.logSessionRestart && console.log("ChatBot: useEffect sessionID=", sessionID);
    if (versionName && !sessionID) {
      findOrCreateGameSession();
    }
  }, [versionName, sessionID]);

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
        subscribeForStateMachineUpdates();

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
  }, [game, version, session]);


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
      const gameSaveSessionInfo = await callGetMostRecentSave(null, game.gameID, versionName);

      const savedSessionID = gameSaveSessionInfo?.session?.sessionID;
      Constants.debug.logSessionRestart && console.log("findOrCreateGameSession - previous SessionID=", savedSessionID);
      
      clearMessageHistory();

      if (savedSessionID) {
        //
        // Load the session we have
        //
        await switchSessionID(savedSessionID, game.gameID);
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
    const taskCreationResult = await callStateMachineContinuationRequest(sessionID, {
      continuation: true,
      singleStep: singleStep,
    });

    if (taskCreationResult.error) {
      console.log("Error sending continuation request: ", taskCreationResult);
      if (taskCreationResult.statusCode == 403) {
        refreshAccessToken();
      } else {
        throw new Error("Error sending continuation request: " +  taskCreationResult.error?.message);
      }
    } else {
      Constants.debug.logTaskSystem && console.log("Continuation successful new taskID=", taskCreationResult.taskID);
    }
  }

  function getWSUrl() {

    // Check if the host is a variation of localhost
    if (window.location.hostname.includes("localhost") || 
        window.location.hostname.includes("127.0.0.1")) {

      // development
      const protocol = 'ws:';
      const host = window.location.hostname; // Includes hostname no port
      const path = ''; // The path to your WebSocket server endpoint
      const wsPort = parseInt(process.env.LOCALHOST_WEBSOCKET_PORT, 10) || 3005;
      const url = `${protocol}//${host}:${wsPort}${path}`;
      return url;
      
    } else if (window.location.protocol === 'https:') {

      // prod - HTTPS
      const protocol = 'wss:';
      const host = window.location.hostname; // Includes hostname no port
      const path = '/ws'; // The path to your WebSocket server endpoint
      const wsPort = parseInt(process.env.EXTERNAL_HTTPS_PORT, 10) || 443;
      const url = `${protocol}//${host}:${wsPort}${path}`;
      return url;

    } else {

      // prod - HTTP
      const protocol = 'ws:';
      const host = window.location.hostname; // Includes hostname no port
      const path = ''; // The path to your WebSocket server endpoint
      const wsPort = parseInt(process.env.EXTERNAL_HTTP_PORT, 10) || 3005;
      const url = `${protocol}//${host}:${wsPort}${path}`;
      return url;
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
          console.error('Reconnection attempt failed:', err);
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
    console.log("subscribeForStateMachineUpdates");

      const commandHandlers = {
        "initcomplete": (command, data) => {
          console.log("CHATBOT INIT COMPLETE");
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
        "statemachinestatusupdate": (command, data) => {
          if (typeof data?.state != 'string') {
            throw new Error("statemachinestatusupdate: data is not a string: " + JSON.stringify(data));
          }
          if (sessionID != data.sessionID) {
            console.log("Ignoring state machine status update for sessionID ", data.sessionID, " - expected ", sessionID);
            return;
          }
          switch(data.state) {
            case "started":
              setProcessingUnderway(true);
            break;
            case "waitingForExternalInput":
              if (data.nodeInstanceID) {
                console.log("Waiting for user input: ", data.waitingFor.join(", "));
                setSupportedMediaTypes(data.waitingFor);
                setInputNodeInstanceID(data.nodeInstanceID);
                setWaitingForInput(true);
              } else {
                setInputNodeInstanceID(null);
              }
              if (data.waitingFor.includes("text")) {
                if (data.maximumInputLength) {
                  setMaximumInputLength(data.maximumInputLength);
                }
              }
              if (data.waitingFor.includes("audio")) {
                if (data.conversational) {
                  setConversational(true);
                }
              }
              break;
            case "stopped":
              setProcessingUnderway(false);
              if (scrollingMode == 'lineByLine' || scrollingMode == 'messageComplete') {
                scrollToBottom();
              }
              break;
            case "error":
              console.error("statemachinestatusupdate errordetails:", data)
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
        
      let newConnection = nullUndefinedOrEmpty(stateMachineWebsocket.current);
      if (!newConnection) {
        console.log("Attempted to subscribe for state machine updates while already subscribed -- reusing connection");
      } else {
        stateMachineWebsocket.current = new WebSocketChannel();
      }

      //
      // Set all callbacks
      //
      stateMachineWebsocket.current.subscribe(commandHandlers);
      subscribeMessageClient(stateMachineWebsocket.current);
      stateMachineWebsocket.current.setConnectionCallbacks(connectionCallbacks);

      if (newConnection) {
        const url = getWSUrl();
        console.log("Connecting to: ", url)
        await stateMachineWebsocket.current.connect({url});
        console.log("Connected to state machine websocket");
      }

      // Assume this process will kick the state machine into action
      // until we hear otherwise
      setProcessingUnderway(true);

      return new Promise((resolve, reject) => {
        try {
            console.log("connected")
            stateMachineWebsocket.current.sendCommand("command", {type: "initializeConnection", accessToken: accessToken, payload: {sessionID: sessionID, gameID: game?.gameID}}).then(() => {
              console.log("sent init command")
              resolve();
            }).catch((error) => {
              console.log("failed to send init command")
              reject(error);
            });
        } catch (error) {
          reject(error);
        }
      });
}

const onRequestAudioControl = (action, playerInstance, params) => {
  audioManagerRef.current.requestAudioControl(action, playerInstance, params);
}

const handleAudioStateChange = (audioType, newState) => {
  audioManagerRef.current.handleAudioStateChange(audioType, newState);
}

  const sendMessage = async (mediaTypes) => {
    console.log("sendMessage ", mediaTypes, " singleStep=", account.preferences?.debugSettings?.singleStep);
    
    setWaitingForInput(false);
    await callSendInputData(
      sessionID, 
      inputNodeInstanceID, 
      mediaTypes,
      { singleStep: account.preferences?.debugSettings?.singleStep ? account.preferences.debugSettings.singleStep : false });
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
        await callRetryRecord(sessionID, message.recordID, account.preferences?.debugSettings?.singleStep ? account.preferences.debugSettings.singleStep : false);
        // this sends a continuation request, preserving the original seed

      } catch (err) {

          console.log("error deleting message(s): ", err.message, err.stack);
          alert("Error deleting message(s): " + err.message);
          return;
      };

  }

  function renderWithFormatting(children) {
    return (
      <StandardContentArea>
          <InfoBubble>
            {children}
          </InfoBubble>
      </StandardContentArea>
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
      <Typography 
        variant="bold"
        textAlign={'center'}
        className={classes.feedbackDescriptionText}
        sx={{ 
          color:'rgba(255, 0, 0, 0.6)',
          }}
      >
          {"The AI is responding slowly to PlayDay's requests."}
      </Typography>
    );
  }

  const themeToUse = theme ? theme : defaultAppTheme;
  const versionString = version?.versionName ? `Version: ${version.versionName}` : ``;

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
              theme={themeToUse}
              inputLength={maximumInputLength}
              conversational={conversational}
              editMode={editMode && gamePermissions && gamePermissions.includes('game_edit')}
              supportsSuggestions={supportsSuggestions}
              supportedMediaTypes={supportedMediaTypes}
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

                    <Typography sx={{ alignSelf: 'flex-end',  marginRight: 5, color: themeToUse.colors.inputTextDisabledColor}}>{versionString}</Typography>

                    <div ref={scrollRef} />
          </ChatBotView>
          <TextPreviewModal isOpen={isDocPreviewOpen} text={docPreviewText} onClose={() => setIsDocPreviewOpen(false)} />  
          <EditorPreferencesCheck />
        </React.Fragment>
    );
  }
}






export default memo(ChatBot);
