import React, { useState, useEffect, useRef, use } from 'react';
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { ImportError } from '@src/common/errors';
    
export function useMessagesClient(props) {
    const { handlers, sessionID } = props;
    const [messages, setMessages] = useState([]);
    const messagesRef = useRef([]);
    const recordIDIndexHash = useRef({});

    function clearMessageHistory() {
        recordIDIndexHash.current = {};
        setMessages([]);
    }

    useEffect(() => {
        return () => {
            clearMessageHistory();
        }
    }, []);


    function subscribeMessageClient(channel) {

        if (!channel) {
            return;
        }

        clearMessageHistory();
        
        console.log("subscribeMessageClient: sessionID=", sessionID)

        const commandHandlers = {
            "reconnect": (command, payload) => {},
            "message:array": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const newMessages = payload;
                replaceMessages(newMessages);
                handlers?.replaceMessageList?.(newMessages);
            },
            "message:start": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const message = payload;
                addMessage(message);
                handlers?.newMessage?.(message);
            },
            "message:field": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const { recordID, field, value } = payload;
                const message = updateMessageField(recordID, field, value);
                handlers?.updateMessage?.(message);
            },
            "message:appendstring": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const { recordID, value } = payload;
                const message = appendMessageTextContent(recordID, value);
                handlers?.updateMessage?.(message);
            },
            "message:appenddata": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const { recordID, value } = payload;
                const message = appendMessageDataContent(recordID, value);
                handlers?.updateMessage?.(message);
            },
            "message:end": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const { recordID } = payload;
                const message = finalizeMessageUpdate(recordID);
                handlers?.messageComplete?.(message);
            },
            "message:delete": (command, payload, {verification}) => {
                if (verification.sessionID !== sessionID) { throw new Error(`sessionID mismatch expected ${sessionID} received ${verification.sessionID}`); }
                const { recordIDsDeleted } = payload;
                if (!Array.isArray(recordIDsDeleted)) {
                    console.error("message:delete: recordIDsDeleted is not an array: ", recordIDsDeleted);
                    throw new Error("message:delete: recordIDsDeleted is not an array: " + JSON.stringify(recordIDsDeleted));
                }
                messagesDeleted(recordIDsDeleted);
                for (let i=0; i<recordIDsDeleted.length; i++) {
                    const deletedRecordID = recordIDsDeleted[i];
                    handlers?.messageDeleted?.(deletedRecordID);
                }
            }
        };

        channel.subscribe(commandHandlers);
    }

    function replaceMessages(newMessages) {
        recordIDIndexHash.current = {};
        for (let i=0; i<newMessages.length; i++) {
            recordIDIndexHash.current[newMessages[i].recordID] = i;
        }
        messagesRef.current = newMessages;
        setMessages(newMessages);
    }

    function addMessage(messageToAdd) {
        let newMessage = {...messageToAdd};
        if (!nullUndefinedOrEmpty(newMessage.error)) {
            console.log("addMessage: ImportError: ", newMessage.error)
            newMessage.error = ImportError(newMessage.error);
        }
        const currentIndex = recordIDIndexHash.current[newMessage.recordID];
        let newMessages = [...messagesRef.current];
        if (typeof currentIndex == 'number') {
            // If the message exists, update it without directly mutating the state
            newMessages[currentIndex] = newMessage;
        } else {
            // If the message does not exist, add it to the end of the array
            newMessages.push(newMessage);
        }
        newMessages.sort((a, b) => a.startTime - b.startTime);
        recordIDIndexHash.current = {};
        for (let i=0; i<newMessages.length; i++) {
            recordIDIndexHash.current[newMessages[i].recordID] = i;
        }
        setMessages((prevMessages) => newMessages);
        messagesRef.current = newMessages;
    }

    function updateMessageField(recordID, field, data) {
        let index = recordIDIndexHash.current[recordID];
        if (typeof index === 'undefined') {
            console.error("updateMessageField: recordID not found: ", recordID, " in ", recordIDIndexHash.current);
            // Probably just from a now-deleted record or a stopped session
            // Just ignore it
            return;
        }
        let updatedMessage = {...messagesRef.current[index]};
        let finalFieldData = data;
        if (field === "error") {
            console.log("updateMessageField: ImportError: ", data)
            finalFieldData = ImportError(data);
        }
        updatedMessage[field] = finalFieldData;
        messagesRef.current[index] = updatedMessage;
        setMessages((prevMessages) => {
            let newMessages = [...prevMessages];
            newMessages[index] = updatedMessage;
            return newMessages;
        });
        return updatedMessage;
    }

    function appendMessageTextContent(recordID, data) {
        let index = recordIDIndexHash.current[recordID];
        if (typeof index === 'undefined') {
            throw new Error("appendMessageTextContent: recordID not found: " + recordID + " data=" + data);
        }

        let updatedMessage = {...messagesRef.current[index]};
        // find the text content field
        if (nullUndefinedOrEmpty(updatedMessage.content)) {
            updatedMessage.content = { "text": "" }
        } else {
            updatedMessage.content = {...updatedMessage.content};

            if (nullUndefinedOrEmpty(updatedMessage.content.text)) {
                updatedMessage.content.text = "";
            }
        }

        updatedMessage.content.text += data;

        messagesRef.current[index] = updatedMessage;
        setMessages((prevMessages) => {
            let newMessages = [...prevMessages];
            newMessages[index] = updatedMessage;
            return newMessages;
        });

        return updatedMessage;
    }

    function appendMessageDataContent(recordID, data) {
        let index = recordIDIndexHash.current[recordID];
        if (typeof index === 'undefined') {
            throw new Error("appendMessageTextContent: recordID not found: " + recordID);
        }

        
        let updatedMessage = {...messagesRef.current[index]};
        // find the text content field
        if (nullUndefinedOrEmpty(updatedMessage.content)) {
            updatedMessage.content = {"data": {}}
        } else {
            updatedMessage.content = {...updatedMessage.content}

            if (nullUndefinedOrEmpty(updatedMessage.content.data)) {
                updatedMessage.content.data = {};
            }
        }
        
        updatedMessage.content.data = { ...updatedMessage.content.data, ...data}

        messagesRef.current[index] = updatedMessage;
        setMessages((prevMessages) => {
            let newMessages = [...prevMessages];
            newMessages[index] = updatedMessage;
            return newMessages;
        });

        return updatedMessage;
    }
    
    function finalizeMessageUpdate(recordID) {
        let index = recordIDIndexHash.current[recordID];
        if (typeof index === 'undefined') {
            throw new Error("finalizeMessageUpdate: recordID not found: " + recordID);
        }
        const message = messagesRef.current[index];
        return message;
    }

    function messagesDeleted(recordIDsDeleted) {
        let newMessages = [];
        recordIDIndexHash.current = {};
        for (let j=0; j<messagesRef.current.length; j++) {
            const record = messagesRef.current[j];
            if (recordIDsDeleted.includes(record.recordID)) {
                continue;
            }
            newMessages.push(record);
            recordIDIndexHash.current[record.recordID] = newMessages.length - 1; 
        }
        messagesRef.current = newMessages;
        setMessages((prevMessages) => [...messagesRef.current]);
    }

    return {
        messages: messages,
        subscribeMessageClient,
        clearMessageHistory
    }
};

