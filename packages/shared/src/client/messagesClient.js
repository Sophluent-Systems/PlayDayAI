"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { stateManager } from '@src/client/statemanager';

const RECONNECT_THRESHOLDS = [
  { threshold: 3, delay: 1000 },  // First 3 attempts: retry after 1s
  { threshold: 6, delay: 5000 },  // Next 3 attempts: retry after 5s
  { threshold: 10, delay: 30000 } // Final 4 attempts: retry after 30s
];
export function useMessagesClient({ sessionID, onMessage, onMessageUpdate, onMessageComplete, debug, handlers, autoConnect = true }) {
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
  const handlersRef = useRef(handlers);
  const callbacksRef = useRef({ onMessage, onMessageUpdate, onMessageComplete });
  const resolveMessageKey = useCallback((item) => {
    if (!item) return null;
    const key = item?.messageID ?? item?.recordID ?? null;
    return key == null ? null : String(key);
  }, []);
  const subscribedChannelRef = useRef(null);
  const channelHandlersRef = useRef(null);
  const ownedChannelRef = useRef(null);
  const isReconnectingRef = useRef(false);

  // Message management methods
  const replaceMessages = (newMessages) => {

    if (!Array.isArray(newMessages) || newMessages.length === 0) {
      messageIndexMapRef.current = {};
      messagesRef.current = [];
      setMessages([]);
      return [];
    }

    const indexedMessages = [...newMessages];
    const indexMap = {};
    indexedMessages.forEach((msg, index) => {
      const key = resolveMessageKey(msg);
      if (key) {
        indexMap[key] = index;
      }
    });
    messageIndexMapRef.current = indexMap;
    messagesRef.current = indexedMessages;
    setMessages(indexedMessages);
    return indexedMessages;
  };

  const addMessage = (message) => {
    const key = resolveMessageKey(message);
    if (!key) return { message: null, isNew: false };

    const index = messageIndexMapRef.current[key];
    if (typeof index === 'number') {
      const newMessages = [...messagesRef.current];
      newMessages[index] = message;
      messagesRef.current = newMessages;
      setMessages(newMessages);
      return { message: newMessages[index], isNew: false };
    }

    const newMessages = [...messagesRef.current, message];
    messageIndexMapRef.current[key] = newMessages.length - 1;
    messagesRef.current = newMessages;
    setMessages(newMessages);
    return { message, isNew: true };
  };

  const updateMessageField = (messageID, field, value) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const newMessages = [...messagesRef.current];
    const updatedMessage = {
      ...newMessages[index],
      [field]: value
    };
    newMessages[index] = updatedMessage;
    messagesRef.current = newMessages;
    setMessages(newMessages);
    return updatedMessage;
  };

  const appendMessageContent = (messageID, content) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const newMessages = [...messagesRef.current];
    const updatedMessage = {
      ...newMessages[index],
      content: (newMessages[index].content || '') + content
    };
    newMessages[index] = updatedMessage;
    messagesRef.current = newMessages;
    setMessages(newMessages);
    return updatedMessage;
  };

  const finalizeMessage = (messageID) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const newMessages = [...messagesRef.current];
    const updatedMessage = {
      ...newMessages[index],
      isComplete: true
    };
    newMessages[index] = updatedMessage;
    messagesRef.current = newMessages;
    setMessages(newMessages);
    return updatedMessage;
  };

  const removeMessagesByRecordIDs = (recordIDs) => {
    if (!Array.isArray(recordIDs) || recordIDs.length === 0) {
      return { changed: false, messages: messagesRef.current };
    }

    const idsToDelete = new Set(
      recordIDs
        .filter((id) => id !== null && id !== undefined)
        .map((id) => String(id))
    );

    if (idsToDelete.size === 0) {
      return { changed: false, messages: messagesRef.current };
    }

    const filteredMessages = messagesRef.current.filter((message) => {
      if (!message) {
        return true;
      }
      const recordKey = message.recordID != null ? String(message.recordID) : null;
      const messageKey = resolveMessageKey(message);
      if (recordKey && idsToDelete.has(recordKey)) {
        return false;
      }
      if (messageKey && idsToDelete.has(messageKey)) {
        return false;
      }
      return true;
    });

    if (filteredMessages.length === messagesRef.current.length) {
      return { changed: false, messages: messagesRef.current };
    }

    const newIndexMap = {};
    filteredMessages.forEach((message, index) => {
      const key = resolveMessageKey(message);
      if (key) {
        newIndexMap[key] = index;
      }
    });

    messageIndexMapRef.current = newIndexMap;
    messagesRef.current = filteredMessages;
    setMessages(filteredMessages);

    return { changed: true, messages: filteredMessages };
  };

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    callbacksRef.current = { onMessage, onMessageUpdate, onMessageComplete };
  }, [onMessage, onMessageUpdate, onMessageComplete]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      isReloadingRef.current = true;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  useEffect(() => {

    if (sessionID !== currentSessionID.current ||
        accessToken !== currentAccessToken.current) {

        if (currentSessionID.current && currentAccessToken.current) {
          disconnect();
        }

        // Set the current sessionID and accessToken
        currentSessionID.current = sessionID;
        currentAccessToken.current = accessToken;

        if (sessionID && accessToken) {
          if (autoConnect) {
            connect();
          }
        }
    }
  }, [sessionID, accessToken, autoConnect]);

  function getWSUrl() {
    return `${process.env.NEXT_PUBLIC_WS_BASE_URL}:${process.env.NEXT_PUBLIC_WS_PORT}/ws`;
  }

  const buildMessageHandlers = () => {
    const callbacks = callbacksRef.current || {};
    const externalHandlers = handlersRef.current || {};

    return {
      'message:array': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const updatedMessages = replaceMessages(payload);
        callbacks.onMessage?.(payload);
        externalHandlers.replaceMessageList?.(updatedMessages);
      },
      'message:start': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const { message, isNew } = addMessage(payload);
        if (!message) return;
        callbacks.onMessage?.(message);
        if (isNew) {
          externalHandlers.newMessage?.(message);
        } else {
          externalHandlers.updateMessage?.(message);
        }
      },
      'message:field': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const key = resolveMessageKey(payload);
        if (!key) return;
        const updatedMessage = updateMessageField(key, payload.field, payload.value);
        callbacks.onMessageUpdate?.(key, payload.field, payload.value);
        if (updatedMessage) {
          externalHandlers.updateMessage?.(updatedMessage);
        }
      },
      'message:appendstring': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const key = resolveMessageKey(payload);
        if (!key) return;
        const updatedMessage = appendMessageContent(key, payload.value);
        callbacks.onMessageUpdate?.(key, 'content', payload.value);
        if (updatedMessage) {
          externalHandlers.updateMessage?.(updatedMessage);
        }
      },
      'message:end': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const key = resolveMessageKey(payload);
        if (!key) return;
        const updatedMessage = finalizeMessage(key);
        callbacks.onMessageComplete?.(key);
        if (updatedMessage) {
          externalHandlers.messageComplete?.(updatedMessage);
        }
      },
      'message:delete': (cmd, payload, { verification }) => {
        if (verification?.sessionID !== sessionID) return;
        const { changed, messages: updatedMessages } = removeMessagesByRecordIDs(payload?.recordIDsDeleted);
        if (changed) {
          externalHandlers.replaceMessageList?.(updatedMessages);
        }
      }
    };
  };

  const subscribeToChannel = (channel) => {
    if (!channel) {
      return () => {};
    }

    if (subscribedChannelRef.current && channelHandlersRef.current) {
      subscribedChannelRef.current.unsubscribe(channelHandlersRef.current);
      if (ownedChannelRef.current === subscribedChannelRef.current) {
        ownedChannelRef.current = null;
      }
    }

    const handlers = buildMessageHandlers();
    channel.subscribe(handlers);
    subscribedChannelRef.current = channel;
    channelHandlersRef.current = handlers;

    return () => {
      if (channel && handlers) {
        channel.unsubscribe(handlers);
      }
      if (subscribedChannelRef.current === channel) {
        subscribedChannelRef.current = null;
        channelHandlersRef.current = null;
      }
    };
  };

  const connect = async () => {
    if (wsRef.current) {
      return; // Already connected
    }

    let ws = null;

    try {
      ws = new WebSocketChannel();

      ws.setConnectionCallbacks({
        onError: (error) => {
          console.warn("WebSockets Network error: ", error);
        },
        onClosed: () => {
          console.warn("WebSockets closed");
          if (!isReloadingRef.current) {
            attemptReconnect();
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
              console.error("sessionStatusUpdate errordetails:", data);
              setIsProcessing(false);
              setError(data);
              break;
            default:
              console.error("Unknown state: ", data.state);
              throw new Error("Unknown state: " + data.state);
          }
        }
      });

      subscribeToChannel(ws);

      const wsUrl = getWSUrl();
      await ws.connect({ url: wsUrl });

      await ws.sendCommand("command", { type: "initializeConnection", accessToken: accessToken, payload: { sessionID } });

      wsRef.current = ws;
      ownedChannelRef.current = ws;

      console.log("messagesClient: wsRef.current set to ", wsRef.current ? "not null" : "null");
    } catch (error) {
      console.error('Failed to connect:', error);
      if (ws && subscribedChannelRef.current === ws && channelHandlersRef.current) {
        ws.unsubscribe(channelHandlersRef.current);
        subscribedChannelRef.current = null;
        channelHandlersRef.current = null;
      }
      if (ws && ownedChannelRef.current === ws) {
        ownedChannelRef.current = null;
      }
      if (!isReloadingRef.current) {
        attemptReconnect();
      }
    }
  };
  const disconnect = () => {
    if (subscribedChannelRef.current && channelHandlersRef.current) {
      subscribedChannelRef.current.unsubscribe(channelHandlersRef.current);
      subscribedChannelRef.current = null;
      channelHandlersRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    ownedChannelRef.current = null;
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

  const subscribeMessageClient = (channel) => {
    return subscribeToChannel(channel);
  };

  const clearMessageHistory = () => {
    replaceMessages([]);
    handlersRef.current?.replaceMessageList?.([]);
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
    subscribeMessageClient,
    clearMessageHistory,
    removeMessagesByRecordIDs,
  };
}
