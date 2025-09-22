import { RabbitMQPubSubChannel } from './rabbitmqpubsub.js';
import { Constants } from '@src/common/defaultconfig';

export const DEFAULT_SESSION_QUEUE_INACTIVITY_TIMEOUT = 10 * 60 * 1000;

const getDefaultSessionTimeout = () => {
  const configuredTimeout = Constants?.config?.sessionPubSub?.inactivityTimeout;
  return (typeof configuredTimeout === 'number') ? configuredTimeout : DEFAULT_SESSION_QUEUE_INACTIVITY_TIMEOUT;
};

export class SessionPubSubChannel extends RabbitMQPubSubChannel {
  constructor(sessionID, options = {}) {
    if (!sessionID) {
      throw new Error('SessionPubSubChannel requires a sessionID');
    }

    const defaultTimeout = getDefaultSessionTimeout();
    const mergedOptions = {
      ...options,
      inactivityTimeout: (typeof options.inactivityTimeout === 'number')
        ? options.inactivityTimeout
        : defaultTimeout,
    };

    super(`session_${sessionID}`, sessionID, mergedOptions);
  }
}
