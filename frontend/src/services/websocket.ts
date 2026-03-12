import type { WSMessage } from "../types";

type WSHandler = (message: WSMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<WSHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private url: string;
  private _connected = false;

  constructor() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.url = `${protocol}//${window.location.host}/ws/dashboard`;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this._connected = true;
      this.connectionHandlers.forEach((h) => h(true));
    };

    this.ws.onmessage = (event) => {
      const message: WSMessage = JSON.parse(event.data);
      const handlers = this.handlers.get(message.event);
      if (handlers) {
        handlers.forEach((handler) => handler(message));
      }
      // Also notify wildcard listeners
      const wildcardHandlers = this.handlers.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.connectionHandlers.forEach((h) => h(false));

      // Exponential backoff: 1s -> 2s -> 4s -> 8s -> ... -> 30s cap
      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelay
      );
      this.reconnectAttempts++;
      console.log(`[WS] Disconnected, reconnecting in ${delay / 1000}s...`);
      this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    };

    this.ws.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.connectionHandlers.forEach((h) => h(false));
  }

  on(event: string, handler: WSHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: WSHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    // Immediately fire with current status
    handler(this._connected);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  send(event: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    }
  }
}

export const wsService = new WebSocketService();
