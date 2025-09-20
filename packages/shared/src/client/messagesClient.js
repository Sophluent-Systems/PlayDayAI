"use client";
import React, { useState, useEffect, useRef } from 'react';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { stateManager } from '@src/client/statemanager';

const RECONNECT_THRESHOLDS = [
  { threshold: 3, delay: 1000 },  // First 3 attempts: retry after 1s
  { threshold: 6, delay: 5000 },  // Next 3 attempts: retry after 5s
  { threshold: 10, delay: 30000 } // Final 4 attempts: retry after 30s
];
export function useMessagesClient({ sessionID, onMessage, onMessageUpdate, onMessageComplete, debug }) {
  const { accessToken, refreshAccessToken } = React.useContext(stateManager);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isReloadingRef = useRef(false);
  const [error, setError] = useState(null);
  const currentSessionID = useRef(null);
  const currentAccessToken = useRef(null);
  const wsRef = useRef(null);
  const messagesRef = useRef([]);
  const messageIndexMapRef = useRef({});
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);

  useEffect(() => {
    const handleBeforeUnload = () => {
      isReloadingRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      console.log("useMessagesClient cleanup --> Disconnecting");
      disconnect();
    };
  }, []);
  
  useEffect(() => {

    if (sessionID !== currentSessionID.current ||
        accessToken !== currentAccessToken.current) {

        console.log("useMessagesClient: sessionID or accessToken changed - disconnecting\sessionID: ", sessionID, "\naccessToken: ", accessToken);
        disconnect();
        
        if (sessionID && accessToken) {
          currentSessionID.current = sessionID;
          currentAccessToken.current = accessToken;
          connect();
        }
    }
  }, [sessionID, accessToken]);

  function getWSUrl() {
    return process.env.NEXT_PUBLIC_SPARRING_PARTNER_URL;
  }

  const connect = async () => {
    if (wsRef.current) {
      return; // Already connected
    }

    try {
      const ws = new WebSocketChannel();

      ws.setConnectionCallbacks({
        onError: (error) => {
          console.warn("WebSockets Network error: ", error);
        },
        onClosed: () => {
          console.warn("WebSockets closed");
          if (!isReloadingRef.current) {
            console.log("WebSockets closed - request retry");
            attemptReconnect();
          } else {
            console.log("WebSockets closed but we're reloading so ignoring");
          }
        },
      });

      ws.subscribe({
        "messages_synced": (command, data) => {
          console.log("MESSAGE CLIENT INIT COMPLETE");
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
        },
        "error": (command, data) => {
          console.log("ERROR: ", data);
          setError(data);
        },
        "networkError": (command, data) => {
          console.log("Network error: ", data);
          setError(data);
        },
        "authError": (command, data) => {
          console.log("Auth error: ", data, " ... refreshing access token.");
          refreshAccessToken();
        },
        "sessionStatusUpdate": (command, data) => {
          console.log("sessionStatusUpdate: ", data);
          if (typeof data?.state != 'string') {
            throw new Error("sessionStatusUpdate: data is not a string: " + JSON.stringify(data));
          }
          if (sessionID != data.sessionID) {
            console.log("Ignoring state machine status update for sessionID ", data.sessionID, " - expected ", sessionID);
            return;
          }
          switch(data.state) {
            case "processing":
              setIsProcessing(true);
            break;
            case "completed":
              setIsProcessing(false);
              break;
            case "error":
              console.error("sessionStatusUpdate errordetails:", data)
                setIsProcessing(false);
                setError(data);
            break;
            default:
                console.error("Unknown state: ", data.state);
                throw new Error("Unknown state: " + data.state);
          }
        },
        'message:array': (cmd, payload, { verification }) => {
          if (verification.sessionID !== sessionID) return;
          replaceMessages(payload);
          onMessage?.(payload);
        },
        'message:start': (cmd, payload, { verification }) => {
          if (verification.sessionID !== sessionID) return;
          addMessage(payload);
          onMessage?.(payload);
        },
        'message:field': (cmd, { messageID, field, value }, { verification }) => {
          if (verification.sessionID !== sessionID) return;
          updateMessageField(messageID, field, value);
          onMessageUpdate?.(messageID, field, value);
        },
        'message:appendstring': (cmd, { messageID, value }, { verification }) => {
          if (verification.sessionID !== sessionID) return;
          appendMessageContent(messageID, value);
          onMessageUpdate?.(messageID, 'content', value);
        },
        'message:end': (cmd, { messageID }, { verification }) => {
          if (verification.sessionID !== sessionID) return;
          finalizeMessage(messageID);
          onMessageComplete?.(messageID);
        }
      });

      const wsUrl = getWSUrl();
      await ws.connect({ url: wsUrl });
      
      // Initialize connection with test run ID
      await ws.sendCommand("command", {type: "initializeConnection", accessToken: accessToken, payload: { sessionID }})
      
      wsRef.current = ws;

      console.log("messagesClient: wsRef.current set to ", wsRef.current ? "not null" : "null");

    } catch (error) {
      console.error('Failed to connect:', error);
      if (!isReloadingRef.current) {
        attemptReconnect();
      }
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      console.log("messagesClient: closing WebSockets connection");
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsProcessing(false);
  };

  const attemptReconnect = () => {
    if (isReconnectingRef.current || isReloadingRef.current) return;
    
    isReconnectingRef.current = true;
    reconnectAttemptsRef.current++;

    // Find appropriate delay based on retry attempts
    let delay = RECONNECT_THRESHOLDS[RECONNECT_THRESHOLDS.length - 1].delay;
    for (const threshold of RECONNECT_THRESHOLDS) {
      if (reconnectAttemptsRef.current <= threshold.threshold) {
        delay = threshold.delay;
        break;
      }
    }

    if (reconnectAttemptsRef.current > RECONNECT_THRESHOLDS[RECONNECT_THRESHOLDS.length - 1].threshold) {
      console.error('Max reconnection attempts reached');
      return;
    }

    setTimeout(async () => {
      try {
        await connect();
      } finally {
        isReconnectingRef.current = false;
      }
    }, delay);
  };

  // Message management methods
  const replaceMessages = (newMessages) => {
    messageIndexMapRef.current = {};
    if (!newMessages || !newMessages.length) {
      messagesRef.current = [];
      setMessages([]);
      return;
    }

    newMessages.forEach((msg, index) => {
      messageIndexMapRef.current[msg.messageID] = index;
    });
    messagesRef.current = newMessages;
    setMessages(newMessages);
  };

  const addMessage = (message) => {
    const index = messageIndexMapRef.current[message.messageID];
    if (typeof index === 'number') {
      // Update existing
      const newMessages = [...messagesRef.current];
      newMessages[index] = message;
      messagesRef.current = newMessages;
      setMessages(newMessages);
    } else {
      // Add new
      const newMessages = [...messagesRef.current, message];
      messageIndexMapRef.current[message.messageID] = newMessages.length - 1;
      messagesRef.current = newMessages;
      setMessages(newMessages);
    }
  };

  const updateMessageField = (messageID, field, value) => {
    const index = messageIndexMapRef.current[messageID];
    if (typeof index !== 'number') return;

    const newMessages = [...messagesRef.current];
    newMessages[index] = {
      ...newMessages[index],
      [field]: value
    };
    messagesRef.current = newMessages;
    setMessages(newMessages);
  };

  const appendMessageContent = (messageID, content) => {
    const index = messageIndexMapRef.current[messageID];
    if (typeof index !== 'number') return;

    const newMessages = [...messagesRef.current];
    newMessages[index] = {
      ...newMessages[index],
      content: (newMessages[index].content || '') + content
    };
    messagesRef.current = newMessages;
    setMessages(newMessages);
  };

  const finalizeMessage = (messageID) => {
    const index = messageIndexMapRef.current[messageID];
    if (typeof index !== 'number') return;

    const newMessages = [...messagesRef.current];
    newMessages[index] = {
      ...newMessages[index],
      isComplete: true
    };
    messagesRef.current = newMessages;
    setMessages(newMessages);
  };

  const sendHalt = async () => {
    if (!wsRef.current) {
      console.error("messagesClient: WebSockets not connected trying to send halt command");
      return;
    }
    await wsRef.current.sendCommand("command", {type: "halt", accessToken: accessToken, payload: { sessionID }})
    console.log("Sent halt command");
  }

  return {
    messages,
    isConnected,
    isProcessing,
    error,
    sendHalt,
  };
}
