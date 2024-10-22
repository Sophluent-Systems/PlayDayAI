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
        while (this.outgoingQueue.length > 0) {
            const { command, data, params } = this.outgoingQueue.shift();
            await this.sendCommand(command, data, params);
        }
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
        this.knownMessages = {};
        for (let i = 0; i < messageHistory.length; i++) {
            this.knownMessages[messageHistory[i].recordID] = true;
        }

        await this.sendCommand("message:array", messageHistory);

        this.initialized = true;
        await this.drainQueue() ;
    }

    async sendMessageStart(message, params) {
        if (!message || (nullUndefinedOrEmpty(message.recordID))) {
            throw new Error("sendMessageStart: message must have a recordID");
        }

        this.knownMessages[message.recordID] = true;

        return await this.enqueueCommand('message:start', message, params);
    }
    
    async sendMessageEnd(recordID, params) {
        if (!this.knownMessages[recordID]) {
            throw new Error("MessagesPubServer: recordID not found: " + recordID + " in sendMessageEnd");
        }

        return await this.enqueueCommand('message:end', { recordID }, params);
    }
    
    async sendField(recordID, fieldName, value, params) {
        if (!this.knownMessages[recordID] && !params?.bypassRecordExistenceCheck) {
            throw new Error("MessagesPubServer: recordID not found: " + recordID + " in sendField");
        }
        
        return await this.enqueueCommand('message:field', { recordID, field: fieldName, value: value }, params);
    }

    async appendTextContent(recordID, value, params) {
        if (!this.knownMessages[recordID]) {
            throw new Error("MessagesPubServer: recordID not found: " + recordID + " in appendTextContent");
        }
        
        Constants.debug.logStreamingMessages && console.error(`[appendTextContent]: ${value}`);
        return await this.enqueueCommand('message:appendstring', { recordID, value: value }, params);
    }

    async appendDataContent(recordID, value, params) {
        if (!this.knownMessages[recordID]) {
            throw new Error("MessagesPubServer: recordID not found: " + recordID + " in appendDataContent");
        }
        
        return await this.enqueueCommand('message:appenddata', { recordID, value: value }, params);
    }

    async deleteMessages(recordIDsDeleted, params) {
        //
        // Don't check IDs for existence here because this is called from
        // the backend of the server where we haven't initialized the
        // known messages yet.
        //

        // remove these messages from the hash
        recordIDsDeleted.map((recordID) => {
            // should never see this message again
            delete this.knownMessages[recordID];
        });
        
        return await this.enqueueCommand('message:delete', { recordIDsDeleted }, params);
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

