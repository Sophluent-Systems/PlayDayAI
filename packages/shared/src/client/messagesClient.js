"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketChannel } from '@src/common/pubsub/websocketchannel';
import { buildWebsocketUrl } from '@src/client/utils/wsUrl';
import { stateManager } from '@src/client/statemanager';

const RECONNECT_THRESHOLDS = [
  { threshold: 3, delay: 1000 },  // First 3 attempts: retry after 1s
  { threshold: 6, delay: 5000 },  // Next 3 attempts: retry after 5s
  { threshold: 10, delay: 30000 } // Final 4 attempts: retry after 30s
]

const parseMessageTimeValue = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const getMessageSortTime = (message) => {
  if (!message) {
    return 0;
  }
  const completion = parseMessageTimeValue(message?.completionTime);
  if (completion !== null) {
    return completion;
  }
  const start = parseMessageTimeValue(message?.startTime);
  if (start !== null) {
    return start;
  }
  const timestamp = parseMessageTimeValue(message?.timestamp);
  if (timestamp !== null) {
    return timestamp;
  }
  return 0;
};

const getMessageSecondarySortTime = (message) => {
  const start = parseMessageTimeValue(message?.startTime);
  if (start !== null) {
    return start;
  }
  const timestamp = parseMessageTimeValue(message?.timestamp);
  if (timestamp !== null) {
    return timestamp;
  }
  const completion = parseMessageTimeValue(message?.completionTime);
  if (completion !== null) {
    return completion;
  }
  return 0;
};

const getMessageStableKey = (message) => {
  const key = message?.messageID ?? message?.recordID ?? null;
  return key == null ? '' : String(key);
};

const sortMessagesForDisplay = (messages) => {
  return [...messages].sort((a, b) => {
    const primary = getMessageSortTime(a) - getMessageSortTime(b);
    if (primary !== 0) {
      return primary;
    }
    const secondary = getMessageSecondarySortTime(a) - getMessageSecondarySortTime(b);
    if (secondary !== 0) {
      return secondary;
    }
    const keyA = getMessageStableKey(a);
    const keyB = getMessageStableKey(b);
    if (keyA && keyB) {
      return keyA.localeCompare(keyB);
    }
    if (keyA) {
      return -1;
    }
    if (keyB) {
      return 1;
    }
    return 0;
  });
};


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

  const commitMessages = useCallback((messageList) => {
    if (!Array.isArray(messageList) || messageList.length === 0) {
      messageIndexMapRef.current = {};
      messagesRef.current = [];
      setMessages([]);
      return { ordered: [], indexMap: {} };
    }
    const ordered = sortMessagesForDisplay(messageList);
    const indexMap = {};
    ordered.forEach((msg, index) => {
      const key = resolveMessageKey(msg);
      if (key) {
        indexMap[key] = index;
      }
    });
    messageIndexMapRef.current = indexMap;
    messagesRef.current = ordered;
    setMessages(ordered);
    return { ordered, indexMap };
  }, [resolveMessageKey]);

  // Message management methods
  const replaceMessages = (newMessages) => {
    if (!Array.isArray(newMessages) || newMessages.length === 0) {
      commitMessages([]);
      return [];
    }

    const { ordered } = commitMessages(newMessages);
    return ordered;
  };

  const addMessage = (message) => {
    const key = resolveMessageKey(message);
    if (!key) return { message: null, isNew: false };

    const existingIndex = messageIndexMapRef.current[key];
    const baseMessages = [...messagesRef.current];
    const isNew = typeof existingIndex !== 'number';

    if (isNew) {
      baseMessages.push(message);
    } else {
      baseMessages[existingIndex] = message;
    }

    const { ordered, indexMap } = commitMessages(baseMessages);
    const index = indexMap[key];
    return {
      message: typeof index === 'number' ? ordered[index] : null,
      isNew,
    };
  };

  const updateMessageField = (messageID, field, value) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const baseMessages = [...messagesRef.current];
    const updatedMessage = {
      ...baseMessages[index],
      [field]: value
    };
    baseMessages[index] = updatedMessage;

    const { ordered, indexMap } = commitMessages(baseMessages);
    const updatedIndex = indexMap[key];
    return typeof updatedIndex === 'number' ? ordered[updatedIndex] : null;
  };

  const appendMessageContent = (messageID, content) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const baseMessages = [...messagesRef.current];
    const currentMessage = baseMessages[index];
    const currentContent = currentMessage.content;

    // DEBUG: Log what we're appending and the current structure
    console.log('[appendMessageContent DEBUG] Appending to messageID:', messageID);
    console.log('[appendMessageContent DEBUG] Content to append:', JSON.stringify(content));
    console.log('[appendMessageContent DEBUG] Current message.content:', JSON.stringify(currentContent));
    console.log('[appendMessageContent DEBUG] Current message.content type:', typeof currentContent);

    // Handle content properly - it should be an object with media type keys (e.g., { text: "..." })
    let updatedContent;
    if (typeof currentContent === 'object' && currentContent !== null) {
      // Content is an object (e.g., { text: "previous text" })
      // We need to append to the text field specifically
      updatedContent = { ...currentContent };
      if (updatedContent.text !== undefined) {
        updatedContent.text = (updatedContent.text || '') + content;
      } else {
        // If no text field exists yet, create it
        updatedContent.text = content;
      }
    } else {
      // Fallback: if content is a string or null/undefined, treat as string concatenation
      updatedContent = (currentContent || '') + content;
    }

    console.log('[appendMessageContent DEBUG] Updated message.content:', JSON.stringify(updatedContent));

    const updatedMessage = {
      ...currentMessage,
      content: updatedContent
    };

    baseMessages[index] = updatedMessage;

    const { ordered, indexMap } = commitMessages(baseMessages);
    const updatedIndex = indexMap[key];
    return typeof updatedIndex === 'number' ? ordered[updatedIndex] : null;
  };

  const finalizeMessage = (messageID) => {
    const key = messageID == null ? null : String(messageID);
    if (!key) return null;

    const index = messageIndexMapRef.current[key];
    if (typeof index !== 'number') return null;

    const baseMessages = [...messagesRef.current];
    const updatedMessage = {
      ...baseMessages[index],
      isComplete: true
    };
    baseMessages[index] = updatedMessage;

    const { ordered, indexMap } = commitMessages(baseMessages);
    const updatedIndex = indexMap[key];
    return typeof updatedIndex === 'number' ? ordered[updatedIndex] : null;
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

    const { ordered } = commitMessages(filteredMessages);
    return { changed: true, messages: ordered };
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
        
        // DEBUG: Log field updates, especially ratings
        if (payload.field === 'ratings') {
          console.log('[message:field DEBUG] Ratings update received for key:', key);
          console.log('[message:field DEBUG] New ratings value:', JSON.stringify(payload.value));
        }
        
        const updatedMessage = updateMessageField(key, payload.field, payload.value);
        
        if (payload.field === 'ratings') {
          console.log('[message:field DEBUG] Updated message after ratings update:', JSON.stringify(updatedMessage));
        }
        
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

      const wsUrl = buildWebsocketUrl();
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
