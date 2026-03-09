const CHANNEL_NAME = 'electric-sheep';

export class StateBridge {
  constructor() {
    this._channel = new BroadcastChannel(CHANNEL_NAME);
    this._handlers = new Map();

    this._channel.onmessage = (event) => {
      const { type, payload } = event.data;
      const handler = this._handlers.get(type);
      if (handler) handler(payload);
    };
  }

  send(type, payload = {}) {
    this._channel.postMessage({ type, payload });
  }

  on(type, handler) {
    this._handlers.set(type, handler);
  }

  off(type) {
    this._handlers.delete(type);
  }

  dispose() {
    this._channel.close();
    this._handlers.clear();
  }
}
