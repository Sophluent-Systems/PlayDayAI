import { RabbitMQPubSubChannel } from './rabbitmqpubsub.js';

export async function openPubSubChannel(channelName, sessionID, options = {}) {
    const channelOptions = { ...options };
    const newChannel = new RabbitMQPubSubChannel(channelName, sessionID, channelOptions);
    await newChannel.connect();
    return newChannel;
}
