import { RabbitMQPubSubChannel } from './rabbitmqpubsub.js';

export async function openPubSubChannel(channelName, sessionID) {
    let newChannel = new RabbitMQPubSubChannel(channelName, sessionID);
    await newChannel.connect();
    return newChannel;
}
