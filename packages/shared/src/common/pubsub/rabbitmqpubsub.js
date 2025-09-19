import amqp from 'amqplib';
import { Constants } from "@src/common/defaultconfig";
import { MessagesPubServer } from './messagespubserver';
import { v4 as uuidv4 } from 'uuid';
import { nullUndefinedOrEmpty } from '../objects.js';

export class RabbitMQPubSubChannel extends MessagesPubServer {
    constructor(channelName=null, sessionID=null, synchronize = false) {
      super(channelName, sessionID, synchronize);
        this.rabbitMQConnection = null;
        this.channelName = channelName;
        this.channel = null;
        this.subscribed = false;
        this.reconnecting = false;
        this.acknowledgments = {};
    }

    async connect(params = {}) {
        Constants.debug.logRabbitMQ && Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect ",this.channelName, this.clientID);
        await super.connect(params);
        const { existingConnection } = params;

        if (existingConnection) {
            throw new Error('RabbitMQPubSubChannel.connect: existingConnection not supported');
        }

        this.acknowledgments = {};

        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: amqp.connect");
        this.rabbitMQConnection = await amqp.connect(process.env.RABBITMQ_URL);
        this.rabbitMQConnection.on('error', this.reconnect.bind(this, params));
        this.rabbitMQConnection.on('close', this.reconnect.bind(this, params));
        
        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: createChannel");
        this.channel = await this.rabbitMQConnection.createChannel();

        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: assertExchange");
        // Declare a fanout exchange
        await this.channel.assertExchange(this.channelName, 'fanout', { durable: false });

        // Declare a callback queue for receiving acknowledgments
        this.callbackQueue = await this.channel.assertQueue('', { exclusive: true });
        
        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: consume");
        // Listen for acknowledgments on the callback queue
        this.channel.consume(this.callbackQueue.queue, (msg) => {
            // Handle acknowledgment message
            const ack = msg.content.toString();
            const correlationId = msg.properties.correlationId;

            // Store the acknowledgment in a way that the publish method can access it
            // For simplicity, let's store it in an object
            this.acknowledgments[correlationId] = ack;
        }, { noAck: true });

        // await this.channel.prefetch(1); // only one message at a time

        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: channel configure");
        this.channel.on('error', (error) => {
            this.onerror(error);
            // Reconnect just to be sure (is this right? who knows..)
            Constants.debug.logRabbitMQ && console.error('RabbitMQ Channel Error (reconnecting):', error);
            this.reconnect(params);
        });

        this.channel.on('close', () => {
            this.onclose();
            this.subscribed = false;
            this.channel = null;
        });

        await this.channel.assertQueue(this.channelName, {
            durable: false,  // The queue will not be saved to disk
            autoDelete: true // The queue will be deleted when no consumers are connected
        });

        if (this.eventCallbacks?.onConnect) {
            await this.eventCallbacks.onConnect();
        }

        this.channel.on('error', (error) => {
            Constants.debug.logRabbitMQ && console.error('RabbitMQ Channel Error:', error);
            this.onerror(error);
        });

        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.connect: done");
    }

    async reconnect(params) {
        if (this.reconnecting) return;  // Prevent multiple reconnection attempts
        this.reconnecting = true;
    
        let backoffTime = 250;  // Start with a 250ms backoff time
        const maxBackoffTime = 30000;  // Maximum backoff time set to 30 seconds
    
        while (this.reconnecting) {
            try {
                // Safely check if anything is still open and active and cleanup if so
                this.internal_closeAndCleanupResources();
    
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

    async subscribe(handlers) {
        super.subscribe(handlers);
        
        if (!this.subscribed) {
            // Declare a temporary queue
            const q = await this.channel.assertQueue(this.clientID, { exclusive: true });
        
            // Bind the queue to the exchange
            await this.channel.bindQueue(q.queue, this.channelName,'');

            this.channel.consume(q.queue, async (msg) => {
                const messageContent = msg.content.toString();
                Constants.debug.logStreamingMessages && Constants.debug.logRabbitMQ && console.error("[rabbit recv] ", messageContent);
                
                // Process the message
                const consumeResult = await this.onmessage(messageContent);

                if (!nullUndefinedOrEmpty(msg.properties.correlationId)) {
                    // Send an acknowledgment back to the publisher
                    const ackMessage = JSON.stringify({ acknowledged: true, result: consumeResult });
                    ; // This could be any message indicating successful processing
                    this.channel.sendToQueue(msg.properties.replyTo, Buffer.from(ackMessage), {
                        correlationId: msg.properties.correlationId,
                        result: consumeResult
                    });
                }

                // Acknowledge the message
                this.channel.ack(msg);
            }, 
            { noAck: false }); // Changed to false to manually handle ACKs
            this.subscribed = true;
        }
    }
    
    async publish(message, params) {
        const receiptTimeout = params?.receiptTimeout || 0;
        await super.publish(message);

        if (typeof receiptTimeout != 'number' || receiptTimeout < 0) {
            Constants.debug.logRabbitMQ && console.error("rabbitmq receiptTimeout must be a positive number or zero: ", receiptTimeout);
            throw new Error('RabbitMQPubSubChannel.publish: receiptTimeout must be a positive number');
        }

        if (receiptTimeout == 0) {
         this.channel.publish(this.channelName, '', Buffer.from(message), { persistent: false });
        } else if (receiptTimeout > 0) {

            // Generate a unique correlation ID for this message
            const correlationId = uuidv4();

            const publishOptions = {
                persistent: false,
                correlationId: correlationId,
                replyTo: this.callbackQueue.queue // Specify the callback queue for the acknowledgment
            };

            // Publish the message with the options
            this.channel.publish(this.channelName, '', Buffer.from(message), publishOptions);

            if (receiptTimeout > 0) {
                // Wait for the acknowledgment or timeout
                const startTime = Date.now();

                while ((Date.now() - startTime) < receiptTimeout) {
                    // Check if the acknowledgment has been received
                    if (this.acknowledgments.hasOwnProperty(correlationId)) {
                        const acknowledgement = this.acknowledgments[correlationId];
                        Constants.debug.logRabbitMQ && console.error("rabbitmq acknowledgment received: ", acknowledgement)
                        delete this.acknowledgments[correlationId]; // Clean up
                        return { acknowledged : true, result: acknowledgement?.result ?  acknowledgement.result : null}; // Return true if acknowledged, false otherwise
                    }

                    // Pause briefly to prevent a tight loop
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                Constants.debug.logRabbitMQ && console.error("rabbitmq acknowledgment timed out: false")
                // Timeout reached without receiving acknowledgment
                return { acknowledged: false };
            }
        }
    }

    internal_closeAndCleanupResources() {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        if (this.rabbitMQConnection) {
            this.rabbitMQConnection.close();
            this.rabbitMQConnection = null;
        }
    }

    close() {
        Constants.debug.logRabbitMQ && console.error("RabbitMQPubSubChannel.close NO ERROR, STACK: ", (new Error()).stack);
        super.close();
        this.internal_closeAndCleanupResources();
    }
}
