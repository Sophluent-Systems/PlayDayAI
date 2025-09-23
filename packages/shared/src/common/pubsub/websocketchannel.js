import { Constants } from "@src/common/defaultconfig";
import { MessagesPubServer } from './messagespubserver';

let WebSocket;

if (typeof window !== 'undefined' && window.WebSocket) {
  // Browser environment with WebSocket support
  WebSocket = window.WebSocket;
} else {
  // Node.js environment or browser without WebSocket
  import('ws').then(ws => {
    WebSocket = ws.default;
  }).catch(err => {
    console.error('Failed to load WebSocket module:', err);
  });
}

export class WebSocketChannel extends MessagesPubServer {
  constructor(channelName=null, sessionID=null, synchronize = false, isServer = false) {
    super(channelName, sessionID, synchronize);
    this.ws = null;
    this.keepAliveTimer = null;
    this.connectionStatus = 'disconnected';
    this.isServer = isServer;
    this.clientPingInterval = 30000; // 30 seconds
    this.serverPingInterval = 45000; // 45 seconds
  }

  async connect(params) {
    await super.connect(params);
    const { existingConnection, url } = params;
    let ws = null;
    if (existingConnection) {
      Constants.debug.logPubSub && console.log("WebSocketChannel.connect: Reusing existing connection");
      ws = existingConnection;
    }
    return new Promise((resolve, reject) => {
      Constants.debug.logPubSub && console.log('WebSocketChannel.connect');

      try {
        const needToConnect = !ws;
        if (needToConnect) {
          if (this.isServer) {
            if (!existingConnection) {
              reject('Server mode requires an existing connection');
              return;
            }
            ws = existingConnection;
          } else {
            if (!url) {
              console.error('WebSocketChannel.connect: No URL provided: ', new Error().stack);
              reject('WebSocketChannel.connect: No URL provided');
              return;
            }
            ws = new WebSocket(url);
          }

          // Add connection timeout for client-side connections
          let connectionTimeout;
          if (!this.isServer) {
            connectionTimeout = setTimeout(() => {
              if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                this.updateConnectionStatus('timeout');
                reject('Connection timeout');
              }
            }, 10000); // 10 seconds timeout
          }

          ws.onopen = async () => {
            if (!this.isServer) {
              clearTimeout(connectionTimeout);
            }
            if (this.connectionCallbacks?.onConnect) {
              await this.connectionCallbacks?.onConnect();
            }
            this.ws = ws;
            this.updateConnectionStatus('connected');
            this.startKeepAliveTimer();
            resolve();
          };
        }

        ws.onmessage = async (event) => {
          try {
            this.startKeepAliveTimer();
            if (event.data === 'ping') {
              this.handlePing();
            } else if (event.data === 'pong') {
              this.handlePong();
            } else {
              await this.onmessage(event.data);
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };
        
        ws.onerror = this.onerror.bind(this);
      
        ws.onclose = (event) => {
          Constants.debug.logPubSub && console.log(">>>>>>>>> SOCKET CLOSED (onclose) <<<<<<<<<<");
          this.stopKeepAliveTimer();
          this.ws = null;
          this.updateConnectionStatus('disconnected');
          this.onclose(event);
        };

        if (!needToConnect) {
          this.ws = ws;
          this.startKeepAliveTimer();
          this.updateConnectionStatus('connected');
          if (this.connectionCallbacks?.onConnect) {
            this.connectionCallbacks?.onConnect().then(() => {
              resolve();
            }).catch((error) => {
              reject(error);
            });
          } else {
            resolve();
          }
        }
      } catch (error) {
        console.error('WebsocketChannel.connect failed: ', error);
        console.error(">>>>>>>>> SOCKET CLOSED (try/catch) <<<<<<<<<<");
        this.ws = null;
        this.updateConnectionStatus('error');
        reject(error);
      }
    });
  }

  startKeepAliveTimer() {
    this.stopKeepAliveTimer(); // Clear any existing timer
    const interval = this.isServer ? this.serverPingInterval : this.clientPingInterval;
    this.keepAliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, interval);
  }

  stopKeepAliveTimer() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  updateConnectionStatus(status) {
    this.connectionStatus = status;
    if (this.connectionCallbacks?.onStatusChange) {
      this.connectionCallbacks.onStatusChange(status);
    }
  }

  onerror(error) {
    this.updateConnectionStatus('error');
    super.onerror(error);
  }

  safeSend(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(message);
        this.startKeepAliveTimer();
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        this.handleSendFailure(error);
        return false;
      }
    } else {
      this.handleSendFailure(new Error('WebSocket is not open'));
      return false;
    }
  }

  async publish(message, params) {
    await super.publish(message);
    return this.safeSend(message);
  }

  sendPing() {
    return this.safeSend('ping');
  }

  handlePing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.safeSend('pong');
    }
  }

  handlePong() {
    this.startKeepAliveTimer();
  }

  handleSendFailure(error) {
    this.onerror(error);
    this.close();
  }

  close() {
    super.close();
    this.stopKeepAliveTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.updateConnectionStatus('disconnected');
  }
}