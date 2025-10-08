import { Constants } from "@src/common/defaultconfig";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { PubSubChannel } from '@src/common/pubsub/pubsubchannel';

//
// Sends messages but also ensures consistency across servers and clients
//
export class MessagesPubServer extends PubSubChannel {
    constructor(channelName, sessionID, synchronize = false) {
        super(channelName);
        this.sessionID = sessionID;
        this.initialized = !synchronize;
        this.outgoingQueue = []; // messages to send before initialization
        this.messages = [];
        this.knownMessages = {};
    }

    requireSynchronization() {
        this.initialized = false;
    }

    async sendCommand(command, data, params) {
        if (nullUndefinedOrEmpty(command)) {
            throw new Error("sendCommand: attempted to send an empty command");
        }
        const verification = {clientID: this.clientID, sessionID: this.sessionID, messageIndex: this.messageIndex++}
        const message = JSON.stringify({ command, data, verification});
        Constants.debug.logStreamingMessages && console.error(`[sendCommand]: ${message}`);
        return await this.publish(message, params);
    }

    async drainQueue() {
        this.outgoingQueue.forEach(async (message) => {
            const { command, data, params } = message;
            await this.sendCommand(command, data, params);
        });
        this.outgoingQueue = [];
    }

    async enqueueCommand(command, data, params) {
        const dataWithSessionID = {sessionID: this.sessionID, ...data};
        if (!this.initialized) {
            this.outgoingQueue.push({ command, data: dataWithSessionID, params });
            return true;
        } else if (this.outgoingQueue.length > 0){
            await this.drainQueue();
        }
        
        return await this.sendCommand(command, dataWithSessionID, params);
    }

    async initializeAndSendMessageHistory(messageHistory) {

        this.initialized = false;

        this.messages = messageHistory;

        await this.sendCommand("message:array", messageHistory);

        this.initialized = true;
        await this.drainQueue() ;
        
        await this.sendCommand("messages_synced", "success");
    }

    async sendMessageStart(message, params) {
        if (!message || (nullUndefinedOrEmpty(message.recordID))) {
            throw new Error("sendMessageStart: message must have a recordID");
        }

        return await this.enqueueCommand('message:start', message, params);
    }
    
    async sendMessageEnd(recordID, params) {
        return await this.enqueueCommand('message:end', { recordID }, params);
    }
    
    async sendField(recordID, fieldName, value, params) {        
        return await this.enqueueCommand('message:field', { recordID, field: fieldName, value: value }, params);
    }

    async appendTextContent(recordID, value, params) {
        Constants.debug.logStreamingMessages && console.error(`[appendTextContent]: ${value}`);
        console.log('[appendTextContent DEBUG] recordID:', recordID, 'value:', JSON.stringify(value), 'value length:', value?.length);
        return await this.enqueueCommand('message:appendstring', { recordID, value: value }, params);
    }

    async appendDataContent(recordID, value, params) {
        return await this.enqueueCommand('message:appenddata', { recordID, value: value }, params);
    }

    async deleteMessages(recordIDsDeleted, params) {
        if (!Array.isArray(recordIDsDeleted) || recordIDsDeleted.length === 0) {
            return false;
        }

        const sanitizedIDs = recordIDsDeleted.filter((recordID) => !nullUndefinedOrEmpty(recordID));
        if (sanitizedIDs.length === 0) {
            return false;
        }

        const idsToDelete = new Set(sanitizedIDs.map(String));

        if (Array.isArray(this.messages) && this.messages.length > 0) {
            this.messages = this.messages.filter((message) => {
                const candidate = message?.recordID ?? message?.messageID;
                if (nullUndefinedOrEmpty(candidate)) {
                    return true;
                }
                return !idsToDelete.has(String(candidate));
            });
        }

        if (Array.isArray(this.outgoingQueue) && this.outgoingQueue.length > 0) {
            this.outgoingQueue = this.outgoingQueue.filter(({ command, data }) => {
                if (!data || command === 'message:delete') {
                    return true;
                }

                const candidateIDs = [];
                if (!nullUndefinedOrEmpty(data.recordID)) {
                    candidateIDs.push(String(data.recordID));
                }
                if (!nullUndefinedOrEmpty(data.messageID)) {
                    candidateIDs.push(String(data.messageID));
                }
                if (Array.isArray(data.recordIDsDeleted)) {
                    data.recordIDsDeleted.forEach((id) => {
                        if (!nullUndefinedOrEmpty(id)) {
                            candidateIDs.push(String(id));
                        }
                    });
                }

                return candidateIDs.every((id) => !idsToDelete.has(id));
            });
        }

        sanitizedIDs.forEach((recordID) => {
            delete this.knownMessages[recordID];
        });

        return await this.enqueueCommand('message:delete', { recordIDsDeleted: Array.from(idsToDelete) }, params);
    }
        
    async sendFullMessage(message, params) {
        await this.sendMessageStart(message, params);
        return await this.sendMessageEnd(message.recordID, params);
    }

    async proxyCommand(command, data, params) {
        if (nullUndefinedOrEmpty(command) || nullUndefinedOrEmpty(data, true)) {
            throw new Error(`MessagesPubServer.proxyCommandInvalid invalid message: command='${command}' data='${data}'`);
        }
        
        switch (command){
            case 'message:start':
                await this.sendMessageStart(data, params);
                break;
            case 'message:end':
                await this.sendMessageEnd(data.recordID, params);
                break;
            case 'message:field':
                await this.sendField(data.recordID, data.field, data.value, params);
                break;
            case 'message:appendstring':
                await this.appendTextContent(data.recordID, data.value, params);
                break;
            case 'message:appenddata':
                await this.appendDataContent(data.recordID, data.value, params);
                break;
            case 'message:delete':
                await this.deleteMessages(data.recordIDsDeleted, params);
                break;
            default:
                await this.enqueueCommand(command, data, params);
        }
    }
}

