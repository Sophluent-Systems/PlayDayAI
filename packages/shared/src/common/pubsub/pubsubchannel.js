import { Constants } from "@src/common/defaultconfig";
import { nullUndefinedOrEmpty } from '@src/common/objects';
import { v4 as uuidv4 } from 'uuid';

export class PubSubChannel {
    constructor(channelName) {
        this.channelName = channelName;
        this.clientID = uuidv4();
        this.messageIndex = 1;
        this.commandHandlers = {
        };
        this.connectionCallbacks = {}
        this.debugging = true;
    }

    setConnectionCallbacks(callbacks) {
        this.connectionCallbacks = callbacks;
    }

    async connect({existingConnection} = {}) {
    }

    subscribe(handlers) {
        if (handlers && (typeof handlers === 'object')) {
            this.commandHandlers = {...this.commandHandlers, ...handlers};
        }
    }

    unsubscribe(handlers) {
        if (handlers) {
            Object.keys(handlers).forEach(key => {
                delete this.commandHandlers[key];
            });
        }
    }

    async publish(data, params) {
        Constants.debug.logPubSub && console.log(`[${this.clientID}] OUT ${this.messageIndex}: `, data);
        // no-op for now
    }

    async onmessage(message) {
        let command = "";
        let data = null;
        let other = {};
        try {
          const parsed = JSON.parse(message);
          Constants.debug.logPubSub && console.log(`[${this.clientID}] IN: `, parsed);
          other = {
            verification: parsed.verification,
          }
          command = parsed.command;
          data = parsed.data;
        } catch (error) {
          console.error(`Error parsing pubsub message ${message}:`, error);
          this.commandHandlers.onError?.(error);
          return false;
        }
    
        if (nullUndefinedOrEmpty(command)) {
          throw new Error('WebSocket message missing command:' + JSON.stringify(message));
          return false;
        }
    
        Constants.debug.logStreamingMessages && console.log(command, ":", data);
    
        let result = undefined;
        if (this.commandHandlers[command]) {
          result = this.commandHandlers[command](command, data, other);
        }

        //
        // Special "all" handler, basically filters all commands
        //
        if (this.commandHandlers["*"]) {
          result = this.commandHandlers["*"](command, data, other);
        }

        return result;
    }
    
    onerror(error) {
        this.connectionCallbacks?.onError?.(error);
    }

    onclose() {
        this.connectionCallbacks?.onClosed?.();
    }

    async sendCommand(command, data, params) {
        if (nullUndefinedOrEmpty(command)) {
            throw new Error("sendCommand: attempted to send an empty command");
        }
        const verification = {clientID: this.clientID, messageIndex: this.messageIndex++}
        const message = JSON.stringify({ command, data, verification});
        Constants.debug.logStreamingMessages && console.error(`[worker -> listener]: ${message}`);
        return await this.publish(message, params);
    }
            
    close() {
        // no-op for now
    }
}
