import amqp from 'amqplib';
import { Constants } from "@src/common/defaultconfig";
import { MessagesPubServer } from './messagespubserver';
import { v4 as uuidv4 } from 'uuid';
import { nullUndefinedOrEmpty } from '../objects.js';


const DEFAULT_MESSAGE_RETENTION = 5 * 60 * 1000;  // How long to keep individual messages (5 mins)
const DEFAULT_CLEANUP_INTERVAL = 60 * 1000;       // How often to run cleanup (1 min)
export const DEFAULT_SESSION_QUEUE_INACTIVITY_TIMEOUT = 10 * 60 * 1000;

export class RabbitMQPubSubChannel extends MessagesPubServer {
    constructor(channelName=null, sessionID=null, options = {}) {
        const synchronize = options.synchronize ? true : false;
        const inactivityTimeout = (typeof options.inactivityTimeout === 'number') ? options.inactivityTimeout : DEFAULT_SESSION_QUEUE_INACTIVITY_TIMEOUT;

        super(channelName, sessionID, synchronize);
        
        this.rabbitMQConnection = null;
        this.channelName = channelName;
        this.channel = null;
        this.subscribed = false;
        this.reconnecting = false;
        this.messageBuffer = new Map();
        this.lastProcessedSequence = 0;
        this.isSessionComplete = false;
        this.lastActivityTimestamp = Date.now();
        this.cleanupInterval = null;
        this.consumerTag = null;
        this.sessionID = sessionID || '';
        this.inactivityTimeout = inactivityTimeout;
        
        // Configuration
        this.MESSAGE_RETENTION = options.messageRetention || DEFAULT_MESSAGE_RETENTION;
        this.CLEANUP_INTERVAL = options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL;
    }



    async connect(params = {}) {
        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect ",this.channelName, this.clientID);
        await super.connect(params);
        const { existingConnection } = params;

        if (existingConnection) {
            throw new Error('RabbitMQPubSubChannel.connect: existingConnection not supported');
        }

        try {
            Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: amqp.connect");
            this.rabbitMQConnection = await amqp.connect(process.env.RABBITMQ_URL);
            this.rabbitMQConnection.on('error', error => {
                Constants.debug.logRabbitMQ && console.error('RabbitMQ Connection Error:', error);
                this.onerror(error);
            });
            this.rabbitMQConnection.on('close', () => {
                Constants.debug.logRabbitMQ && console.error('RabbitMQ Connection Closed');
            });
            
            Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: createChannel");
            this.channel = await this.rabbitMQConnection.createChannel();

            // Create the exchange
            await this.channel.assertExchange(this.channelName, 'fanout', { 
                durable: false,
                autoDelete: false 
            });

            Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: channel configure");
            this.channel.on('error', (error) => {
                this.onerror(error);
                // Reconnect just to be sure (is this right? who knows..)
                console.error('RabbitMQ Channel Error (reconnecting):', error);
                this.reconnect(params);
            });
    
            this.channel.on('close', () => {
                console.log('RabbitMQ Channel Closed: ', this.channelName);
                this.onclose();
                this.subscribed = false;
                this.channel = null;
            });

            //
            // Here is the main queue for the channel.  This is where messages are sent and received.
            //

            //
            // USE THIS LINE TEMPORARILY IF QUEUE SETTINGS CHANGE
            //   (it cleans up the queue on startup, which is useful for testing)
            //
            //await this.channel.deleteQueue(this.channelName);
            
            // Declare a callback queue for receiving acknowledgments
            let rabbitArgs = {
                'x-message-ttl': this.MESSAGE_RETENTION,  // Messages expire after 5 mins
            };
            if (this.inactivityTimeout > 0) {
                rabbitArgs['x-expires'] = this.inactivityTimeout;
            }
            
            await this.channel.assertQueue(this.channelName, {
                durable: false,
                autoDelete: false,
                arguments: rabbitArgs
            });

            if (this.inactivityTimeout > 0) {
                // Start the cleanup interval
                this.startCleanupInterval();
            }

            if (this.eventCallbacks?.onConnect) {
                await this.eventCallbacks.onConnect();
            }

            Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: done");
        } catch (error) {
            Constants.debug.logRabbitMQ && console.error("Error in connect:", error);
            throw error;
        }
    }

    async reconnect(params) {
        if (this.reconnecting) return;  // Prevent multiple reconnection attempts
        this.reconnecting = true;
    
        console.warn('Attempting to reconnect to RabbitMQ...');

        let backoffTime = 250;  // Start with a 250ms backoff time
        const maxBackoffTime = 30000;  // Maximum backoff time set to 30 seconds
    
        while (this.reconnecting) {
            try {
                await this.internal_closeAndCleanupResources();
                await this.connect(params);
                this.reconnecting = false;  // Connection successfully re-established
                Constants.debug.logRabbitMQ && console.error('Successfully reconnected to RabbitMQ');
                return;
            } catch (error) {
                Constants.debug.logRabbitMQ && console.error('Failed to reconnect to RabbitMQ:', error);
                await new Promise(resolve => setTimeout(resolve, backoffTime));  // Wait for backoffTime before next attempt
                backoffTime = Math.min(backoffTime * 2, maxBackoffTime);  // Exponentially increase the backoff time, up to a maximum
            }
        }
    }
    

    startCleanupInterval() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cleanupInterval = setInterval(() => {
            this.checkAndCleanup();
        }, this.CLEANUP_INTERVAL);
    }

    updateActivityTimestamp() {
        this.lastActivityTimestamp = Date.now();
    }

    async checkAndCleanup() {
        if (this.inactivityTimeout == 0) {
            // No inactivity timeout set, so no need to check
            return;
        }

        const currentTime = Date.now();
        const timeSinceLastActivity = currentTime - this.lastActivityTimestamp;

        if (this.isSessionComplete || timeSinceLastActivity > this.inactivityTimeout) {
            await this.internal_closeAndCleanupResources();
        }
    }

    async subscribe(handlers) {
        super.subscribe(handlers);
        
        if (!this.subscribed) {
            
            let rabbitArgs = {
                'x-message-ttl': this.MESSAGE_RETENTION,  // Messages expire after 5 mins
            };
            if (this.inactivityTimeout > 0) {
                rabbitArgs['x-expires'] = this.inactivityTimeout;
            }

            await this.channel.assertQueue(this.clientID, { 
                exclusive: false,
                autoDelete: false,
                durable: false,
                arguments: rabbitArgs
            });
        
            // Bind to the queue
            await this.channel.bindQueue(this.clientID, this.channelName, '');

            let consumeResult;
            try {
                consumeResult = await this.channel.consume(this.clientID, async (msg) => {
                    if (msg === null) return;

                    try {
                        this.updateActivityTimestamp();
                        const messageContent = msg.content.toString();
                        const messageData = JSON.parse(messageContent);
                        Constants.debug.logStreamingMessages && Constants.debug.logRabbitMQ && console.error("[rabbit recv] ", messageContent);

                        if (messageData.command === 'session_complete' && this.inactivityTimeout > 0) {
                            if (this.channel) {
                                try {
                                    this.channel.ack(msg);
                                } catch (ackError) {
                                    Constants.debug.logRabbitMQ && console.error('Failed to ack session_complete message:', ackError);
                                }
                            }
                            this.isSessionComplete = true;
                            await this.checkAndCleanup();
                            return;
                        }

                        // Process the message
                        const handlerResult = await this.onmessage(messageContent);

                        if (!nullUndefinedOrEmpty(msg.properties.correlationId) && this.channel) {
                            const ackMessage = JSON.stringify({ acknowledged: true, result: handlerResult });
                            try {
                                this.channel.sendToQueue(
                                    msg.properties.replyTo,
                                    Buffer.from(ackMessage),
                                    {
                                        correlationId: msg.properties.correlationId,
                                        result: handlerResult
                                    }
                                );
                            } catch (sendError) {
                                Constants.debug.logRabbitMQ && console.error('Failed to send ack message:', sendError);
                            }
                        }

                        if (this.channel) {
                            try {
                                this.channel.ack(msg);
                            } catch (ackError) {
                                Constants.debug.logRabbitMQ && console.error('Failed to ack message:', ackError);
                            }
                        }

                    } catch (error) {
                        Constants.debug.logRabbitMQ && console.error('Error processing message:', error);
                        if (this.channel) {
                            try {
                                this.channel.nack(msg, false, false);
                            } catch (nackError) {
                                Constants.debug.logRabbitMQ && console.error('Failed to nack message:', nackError);
                            }
                        }
                    }

                }, { noAck: false });
            } catch (consumeError) {
                Constants.debug.logRabbitMQ && console.error('Failed to start consumer:', consumeError);
                throw consumeError;
            }

            this.consumerTag = consumeResult?.consumerTag ?? null;
            
            this.subscribed = true;
        }
    }

    async publish(message, params = {}) {
        await super.publish(message);

        this.updateActivityTimestamp();

        this.channel.publish(this.channelName, '', Buffer.from(message), {
            persistent: false,
            expiration: this.MESSAGE_RETENTION.toString()
        });
    }

    async endSession() {
        if (!this.isSessionComplete) {
            await this.publish(JSON.stringify({
                command: 'session_complete',
                data: { sessionID: this.sessionID }
            }));
            this.isSessionComplete = true;
        }
    }

    async internal_closeAndCleanupResources() {
        console.error("internal_closeAndCleanupResources");
        try {
            // Clear message buffer
            this.messageBuffer?.clear();
            
            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }

            // Close and cleanup channel
            if (this.channel) {
                if (this.consumerTag) {
                    try {
                        await this.channel.cancel(this.consumerTag);
                    } catch (cancelError) {
                        Constants.debug.logRabbitMQ && console.error('Failed to cancel consumer:', cancelError);
                    } finally {
                        this.consumerTag = null;
                    }
                }
                try {
                    await this.channel.close();
                } catch (error) {
                    // Channel may already be closed
                }
                this.channel = null;
                this.subscribed = false;
            }

            // Close connection
            if (this.rabbitMQConnection) {
                await this.rabbitMQConnection.close();
                this.rabbitMQConnection = null;
            }

        } catch (error) {
            Constants.debug.logRabbitMQ && console.error('Error during cleanup:', error);
        }
    }

    async close() {
        console.error("RabbitMQPubSubChannel.close\n", new Error().stack);
        try {
            Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.close");
            await this.internal_closeAndCleanupResources();
            super.close();
        } catch (error) {
            console.error('Error during RabbitMQ close:', error);
        }
    }
}

