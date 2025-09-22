import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { Constants } from "@src/common/defaultconfig";
import { MessagesPubServer } from './messagespubserver';
import { nullUndefinedOrEmpty } from '../objects.js';

const DEFAULT_MESSAGE_RETENTION = 5 * 60 * 1000;  // How long to keep individual messages (5 mins)
const DEFAULT_CLEANUP_INTERVAL = 60 * 1000;       // How often to run cleanup (1 min)
const DEFAULT_ACK_TIMEOUT_MS = 5 * 1000;

export class RabbitMQPubSubChannel extends MessagesPubServer {
    constructor(channelName=null, sessionID=null, options = {}) {
        const synchronize = options.synchronize ? true : false;
        const inactivityTimeout = (typeof options.inactivityTimeout === 'number') ? options.inactivityTimeout : 0;

        super(channelName, sessionID, synchronize);
        
        this.rabbitMQConnection = null;
        this.channelName = channelName;
        this.channel = null;
        this.subscribed = false;
        this.reconnecting = false;
        this.lastProcessedSequence = 0;
        this.isSessionComplete = false;
        this.lastActivityTimestamp = Date.now();
        this.consumerTag = null;
        this.sessionID = sessionID || '';
        this.inactivityTimeout = inactivityTimeout;
        
        this.primaryQueueName = null;
        this.replyQueueName = null;
        this.replyConsumerTag = null;
        this.pendingReplies = new Map();
        this.manuallyClosing = false;
        this.connectionClosePromise = null;
        this.defaultAckTimeout = (typeof options.defaultAckTimeout === 'number')
            ? options.defaultAckTimeout
            : DEFAULT_ACK_TIMEOUT_MS;
        
        // Configuration
        this.MESSAGE_RETENTION = options.messageRetention || DEFAULT_MESSAGE_RETENTION;
        this.CLEANUP_INTERVAL = options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL;
    }

    buildQueueArguments(overrides = {}) {
        const args = {
            'x-message-ttl': this.MESSAGE_RETENTION,
            ...overrides,
        };

        if (this.inactivityTimeout > 0) {
            args['x-expires'] = this.inactivityTimeout;
        }

        return args;
    }

    normalizePublishParams(params) {
        if (typeof params === 'number') {
            return {
                expectReply: true,
                timeoutMs: params,
                expiration: undefined,
                publishOptions: {},
            };
        }

        if (!params || typeof params !== 'object') {
            return {
                expectReply: false,
                timeoutMs: null,
                expiration: undefined,
                publishOptions: {},
            };
        }

        const {
            awaitAck,
            awaitReply,
            expectReply,
            timeoutMs,
            ackTimeoutMs,
            replyTimeoutMs,
            expiration,
            headers,
            priority,
            persistent,
            contentType,
            messageOptions,
            publishOptions,
        } = params;

        const replyRequested = (typeof awaitAck === 'boolean')
            ? awaitAck
            : (typeof awaitReply === 'boolean')
                ? awaitReply
                : (typeof expectReply === 'boolean')
                    ? expectReply
                    : (typeof timeoutMs === 'number'
                        || typeof ackTimeoutMs === 'number'
                        || typeof replyTimeoutMs === 'number');

        const resolvedTimeout = [
            timeoutMs,
            ackTimeoutMs,
            replyTimeoutMs,
        ].find((value) => typeof value === 'number');

        const options = {
            ...publishOptions,
            ...messageOptions,
        };

        if (headers) {
            options.headers = headers;
        }
        if (typeof priority === 'number') {
            options.priority = priority;
        }
        if (typeof persistent === 'boolean') {
            options.persistent = persistent;
        }
        if (!nullUndefinedOrEmpty(contentType)) {
            options.contentType = contentType;
        }

        return {
            expectReply: replyRequested,
            timeoutMs: resolvedTimeout ?? null,
            expiration,
            publishOptions: options,
        };
    }

    rejectAllPending(error) {
        if (!this.pendingReplies || this.pendingReplies.size === 0) {
            return;
        }

        for (const [correlationId, pending] of this.pendingReplies.entries()) {
            if (pending.timeoutHandle) {
                clearTimeout(pending.timeoutHandle);
            }
            try {
                if (pending.reject) {
                    pending.reject(error);
                }
            } catch (rejectError) {
                if (Constants.debug.logRabbitMQ) {
                    console.error('Error rejecting pending reply', rejectError);
                }
            }
        }

        this.pendingReplies.clear();
    }

    async setupReplyQueue() {
        if (!this.channel) {
            throw new Error('Cannot setup reply queue without an active channel');
        }

        if (this.replyConsumerTag) {
            try {
                await this.channel.cancel(this.replyConsumerTag);
            } catch (cancelError) {
                if (Constants.debug.logRabbitMQ) {
                    console.error('Failed to cancel existing reply consumer:', cancelError);
                }
            } finally {
                this.replyConsumerTag = null;
            }
        }

        const { queue } = await this.channel.assertQueue('', {
            exclusive: true,
            autoDelete: true,
            durable: false,
        });

        this.replyQueueName = queue;

        const consumeResult = await this.channel.consume(
            queue,
            (msg) => {
                if (!msg) {
                    return;
                }

                const correlationId = msg.properties?.correlationId;
                if (!correlationId) {
                    return;
                }

                const pending = this.pendingReplies.get(correlationId);
                if (!pending) {
                    return;
                }

                if (pending.timeoutHandle) {
                    clearTimeout(pending.timeoutHandle);
                }

                try {
                    const payload = msg.content?.length
                        ? JSON.parse(msg.content.toString())
                        : null;
                    if (pending.resolve) {
                        pending.resolve(payload);
                    }
                } catch (parseError) {
                    if (pending.reject) {
                        pending.reject(parseError);
                    }
                } finally {
                    this.pendingReplies.delete(correlationId);
                }
            },
            { noAck: true },
        );

        this.replyConsumerTag = consumeResult?.consumerTag ?? null;
    }

    async connect(params = {}) {
        if (this.channel) {
            return;
        }

        if (Constants.debug.logRabbitMQ) {
            console.error('RabbitMQPubSubChannel.connect', this.channelName, this.clientID);
        }
        await super.connect(params);
        const { existingConnection } = params;

        if (existingConnection) {
            throw new Error('RabbitMQPubSubChannel.connect: existingConnection not supported');
        }

        try {
            if (Constants.debug.logRabbitMQ) {
                console.error('RabbitMQPubSubChannel.connect: amqp.connect');
            }
            this.rabbitMQConnection = await amqp.connect(process.env.RABBITMQ_URL);
            this.rabbitMQConnection.on('error', (error) => {
                if (Constants.debug.logRabbitMQ) {
                    console.error('RabbitMQ Connection Error:', error);
                }
                this.rejectAllPending(error);
                this.onerror(error);
            });
            this.rabbitMQConnection.on('close', () => {
                if (Constants.debug.logRabbitMQ) {
                    console.error('RabbitMQ Connection Closed');
                }
                this.rejectAllPending(new Error('RabbitMQ connection closed'));
            });
            
            if (Constants.debug.logRabbitMQ) {
                console.error('RabbitMQPubSubChannel.connect: createChannel');
            }
            this.channel = await this.rabbitMQConnection.createChannel();

            await this.channel.assertExchange(this.channelName, 'fanout', { 
                durable: false,
                autoDelete: true,
            });

            this.channel.on('error', (error) => {
                this.onerror(error);
                if (!this.manuallyClosing) {
                    console.error('RabbitMQ Channel Error (reconnecting):', error);
                    this.reconnect(params);
                }
            });
    
            this.channel.on('close', () => {
                console.log('RabbitMQ Channel Closed: ', this.channelName);
                this.rejectAllPending(new Error('Channel ' + this.channelName + ' closed'));
                this.onclose();
                this.subscribed = false;
                this.channel = null;
                this.replyQueueName = null;
                this.replyConsumerTag = null;
                this.primaryQueueName = null;

                if (this.rabbitMQConnection) {
                    void this.ensureConnectionClosed('channel close');
                }
            });

            const queueArgs = this.buildQueueArguments();
            const { queue } = await this.channel.assertQueue(this.channelName, {
                durable: false,
                autoDelete: false,
                arguments: queueArgs,
            });
            this.primaryQueueName = queue;
            await this.channel.bindQueue(this.primaryQueueName, this.channelName, '');

            await this.setupReplyQueue();

            if (this.eventCallbacks?.onConnect) {
                await this.eventCallbacks.onConnect();
            }

            if (Constants.debug.logRabbitMQ) {
                console.error('RabbitMQPubSubChannel.connect: done');
            }
        } catch (error) {
            if (Constants.debug.logRabbitMQ) {
                console.error('Error in connect:', error);
            }
            await this.internal_closeAndCleanupResources();
            throw error;
        }
    }

    async reconnect(params) {
        if (this.reconnecting) {
            return;
        }
        this.reconnecting = true;
    
        console.warn('Attempting to reconnect to RabbitMQ...');

        const hadSubscription = this.subscribed || (this.consumerTag != null);

        let backoffTime = 250;
        const maxBackoffTime = 30000;
    
        while (this.reconnecting) {
            try {
                await this.internal_closeAndCleanupResources();
                await this.connect(params);
                if (hadSubscription && Object.keys(this.commandHandlers || {}).length > 0) {
                    await this.subscribe();
                }
                this.reconnecting = false;
                if (Constants.debug.logRabbitMQ) {
                    console.error('Successfully reconnected to RabbitMQ');
                }
                return;
            } catch (error) {
                if (Constants.debug.logRabbitMQ) {
                    console.error('Failed to reconnect to RabbitMQ:', error);
                }
                await new Promise((resolve) => setTimeout(resolve, backoffTime));
                backoffTime = Math.min(backoffTime * 2, maxBackoffTime);
            }
        }
    }
    
    async subscribe(handlers) {
        super.subscribe(handlers);
        
        if (!this.channel) {
            throw new Error('Cannot subscribe before connecting to RabbitMQ');
        }

        if (!this.subscribed) {
            const queueArgs = this.buildQueueArguments();
            await this.channel.assertQueue(this.clientID, { 
                exclusive: true,
                autoDelete: true,
                durable: false,
                arguments: queueArgs,
            });
        
            await this.channel.bindQueue(this.clientID, this.channelName, '');

            let consumeResult;
            try {
                consumeResult = await this.channel.consume(this.clientID, async (msg) => {
                    if (msg === null) {
                        return;
                    }

                    try {
                        this.updateActivityTimestamp();
                        const messageContent = msg.content.toString();
                        if (Constants.debug.logStreamingMessages && Constants.debug.logRabbitMQ) {
                            console.error('[rabbit recv] ', messageContent);
                        }

                        const handlerResult = await this.onmessage(messageContent);

                        if (!nullUndefinedOrEmpty(msg.properties.correlationId) && this.channel && msg.properties.replyTo) {
                            const ackMessage = JSON.stringify({ acknowledged: true, result: handlerResult });
                            try {
                                this.channel.sendToQueue(
                                    msg.properties.replyTo,
                                    Buffer.from(ackMessage),
                                    {
                                        correlationId: msg.properties.correlationId,
                                        contentType: 'application/json',
                                    }
                                );
                            } catch (sendError) {
                                if (Constants.debug.logRabbitMQ) {
                                    console.error('Failed to send ack message:', sendError);
                                }
                            }
                        }

                        if (this.channel) {
                            try {
                                this.channel.ack(msg);
                            } catch (ackError) {
                                if (Constants.debug.logRabbitMQ) {
                                    console.error('Failed to ack message:', ackError);
                                }
                            }
                        }

                    } catch (error) {
                        if (Constants.debug.logRabbitMQ) {
                            console.error('Error processing message:', error);
                        }
                        if (this.channel) {
                            try {
                                this.channel.nack(msg, false, false);
                            } catch (nackError) {
                                if (Constants.debug.logRabbitMQ) {
                                    console.error('Failed to nack message:', nackError);
                                }
                            }
                        }
                    }

                }, { noAck: false });
            } catch (consumeError) {
                if (Constants.debug.logRabbitMQ) {
                    console.error('Failed to start consumer:', consumeError);
                }
                throw consumeError;
            }

            this.consumerTag = consumeResult?.consumerTag ?? null;
            
            this.subscribed = true;
        }
    }

    updateActivityTimestamp() {
        this.lastActivityTimestamp = Date.now();
    }

    async publish(message, params = {}) {
        await super.publish(message);

        if (!this.channel) {
            throw new Error('Cannot publish without an active RabbitMQ channel');
        }

        this.updateActivityTimestamp();

        const normalized = this.normalizePublishParams(params);
        const expectReply = normalized.expectReply;
        const timeoutMs = expectReply
            ? (normalized.timeoutMs ?? this.defaultAckTimeout)
            : null;

        const publishOptions = {
            persistent: false,
            ...normalized.publishOptions,
        };

        const expirationToUse = normalized.expiration ?? this.MESSAGE_RETENTION;
        if (expirationToUse != null) {
            publishOptions.expiration = expirationToUse.toString();
        }

        let correlationId = null;
        let pendingPromise = null;

        if (expectReply) {
            if (!this.replyQueueName) {
                throw new Error('Reply queue not initialized');
            }

            correlationId = uuidv4();
            publishOptions.replyTo = this.replyQueueName;
            publishOptions.correlationId = correlationId;

            pendingPromise = new Promise((resolve, reject) => {
                let timeoutHandle = null;

                if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                    timeoutHandle = setTimeout(() => {
                        if (this.pendingReplies.has(correlationId)) {
                            this.pendingReplies.delete(correlationId);
                            reject(new Error('Ack not received within ' + timeoutMs + 'ms'));
                        }
                    }, timeoutMs);
                }

                this.pendingReplies.set(correlationId, { resolve, reject, timeoutHandle });
            });
        }

        try {
            const sent = this.channel.publish(this.channelName, '', Buffer.from(message), publishOptions);
            if (!sent) {
                await new Promise((resolve) => this.channel.once('drain', resolve));
            }
        } catch (error) {
            if (correlationId && this.pendingReplies.has(correlationId)) {
                const pending = this.pendingReplies.get(correlationId);
                if (pending.timeoutHandle) {
                    clearTimeout(pending.timeoutHandle);
                }
                this.pendingReplies.delete(correlationId);
                pending.reject(error);
            }
            throw error;
        }

        if (pendingPromise) {
            return pendingPromise;
        }

        return true;
    }

    async ensureConnectionClosed(reason) {
        if (!this.rabbitMQConnection) {
            return;
        }

        if (this.connectionClosePromise) {
            return this.connectionClosePromise;
        }

        const connection = this.rabbitMQConnection;
        const closePromise = connection.close()
            .catch((connectionError) => {
                if (Constants.debug.logRabbitMQ) {
                    const contextMessage = reason ? ` during ${reason}` : "";
                    console.error(`Failed to close RabbitMQ connection${contextMessage}:`, connectionError);
                }
            })
            .finally(() => {
                if (this.rabbitMQConnection === connection) {
                    this.rabbitMQConnection = null;
                }
                this.connectionClosePromise = null;
            });

        this.connectionClosePromise = closePromise;
        return closePromise;
    }

    async internal_closeAndCleanupResources() {
        this.rejectAllPending(new Error('RabbitMQ channel closing'));

        const channel = this.channel;
        this.channel = null;
        this.subscribed = false;

        if (channel) {
            if (this.replyConsumerTag) {
                try {
                    await channel.cancel(this.replyConsumerTag);
                } catch (cancelError) {
                    if (Constants.debug.logRabbitMQ) {
                        console.error('Failed to cancel reply consumer during cleanup:', cancelError);
                    }
                }
            }

            if (this.consumerTag) {
                try {
                    await channel.cancel(this.consumerTag);
                } catch (cancelError) {
                    if (Constants.debug.logRabbitMQ) {
                        console.error('Failed to cancel consumer during cleanup:', cancelError);
                    }
                }
            }

            try {
                await channel.close();
            } catch (error) {
                // Channel may already be closed
            }
        }

        this.replyConsumerTag = null;
        this.consumerTag = null;
        this.replyQueueName = null;
        this.primaryQueueName = null;

        await this.ensureConnectionClosed('internal cleanup');

        this.pendingReplies = new Map();
    }

    async close() {
        try {
            this.manuallyClosing = true;
            if (Constants.debug.logRabbitMQ) {
                console.error('RabbitMQPubSubChannel.close');
            }
            await this.internal_closeAndCleanupResources();
            super.close();
        } catch (error) {
            console.error('Error during RabbitMQ close:', error);
        } finally {
            this.reconnecting = false;
            this.manuallyClosing = false;
        }
    }
}
